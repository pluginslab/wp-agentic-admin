#!/usr/bin/env node
/**
 * Multi-Turn Conversation Test Runner — Ollama Backend
 *
 * Tests multi-turn conversations that mirror the browser's actual flow:
 * tool selection → mock tool result → follow-up question → web search context.
 *
 * Each test is a conversation with multiple turns. Each turn can:
 * - Expect a tool call (like the single-turn runner)
 * - Inject a mock tool result into history
 * - Inject web search results into history
 * - Expect a conversational answer matching a regex
 *
 * Usage:
 *   npm run test:conversations -- --file tests/abilities/conversations.test.js
 *   node tests/abilities/multi-turn-runner.js --file tests/abilities/conversations.test.js
 *
 * @since 0.10.0
 */

const { execSync, spawn } = require( 'child_process' );
const path = require( 'path' );
const fs = require( 'fs' );

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice( 2 );
const fileIndex = args.indexOf( '--file' );
const modelIndex = args.indexOf( '--model' );
const verbose = args.includes( '--verbose' );
const noThink = ! args.includes( '--think' );

if ( fileIndex === -1 || ! args[ fileIndex + 1 ] ) {
	console.error(
		'Usage: node multi-turn-runner.js --file <test-file.js> [--model <ollama-model>]'
	);
	console.error( '' );
	console.error( 'Options:' );
	console.error( '  --file <path>       Path to test file (required)' );
	console.error(
		'  --model <id>        Ollama model (default: qwen3:1.7b)'
	);
	console.error(
		'  --think             Enable Qwen 3 thinking (default: off to match browser)'
	);
	console.error( '  --verbose           Show full LLM responses' );
	process.exit( 1 );
}

const testFilePath = path.resolve( args[ fileIndex + 1 ] );
const modelId =
	modelIndex !== -1 && args[ modelIndex + 1 ]
		? args[ modelIndex + 1 ]
		: 'qwen3:1.7b';

if ( ! fs.existsSync( testFilePath ) ) {
	console.error( `Test file not found: ${ testFilePath }` );
	process.exit( 1 );
}

// ---------------------------------------------------------------------------
// Ollama setup helpers (shared with runner.js)
// ---------------------------------------------------------------------------

const OLLAMA_BASE = 'http://localhost:11434';

function isOllamaInstalled() {
	try {
		execSync( 'which ollama', { stdio: 'ignore' } );
		return true;
	} catch {
		return false;
	}
}

function installOllama() {
	if ( process.platform !== 'darwin' ) {
		console.error(
			'Auto-install is only supported on macOS via Homebrew.'
		);
		process.exit( 1 );
	}
	try {
		execSync( 'which brew', { stdio: 'ignore' } );
	} catch {
		console.error( 'Homebrew not found. Install Ollama manually.' );
		process.exit( 1 );
	}
	console.log( '  Installing Ollama via Homebrew...' );
	execSync( 'brew install ollama', { stdio: 'inherit' } );
}

async function isOllamaRunning() {
	try {
		const res = await fetch( `${ OLLAMA_BASE }/api/tags` );
		return res.ok;
	} catch {
		return false;
	}
}

function startOllamaServe() {
	console.log( '  Starting Ollama server...' );
	const child = spawn( 'ollama', [ 'serve' ], {
		stdio: 'ignore',
		detached: true,
	} );
	child.unref();
	return child;
}

async function waitForOllama( maxWaitMs = 15000 ) {
	const start = Date.now();
	while ( Date.now() - start < maxWaitMs ) {
		if ( await isOllamaRunning() ) {
			return true;
		}
		await new Promise( ( r ) => setTimeout( r, 500 ) );
	}
	return false;
}

async function isModelPulled( model ) {
	try {
		const res = await fetch( `${ OLLAMA_BASE }/api/tags` );
		const data = await res.json();
		return ( data.models || [] ).some(
			( m ) =>
				m.name === model ||
				m.name === `${ model }:latest` ||
				m.name.startsWith( model )
		);
	} catch {
		return false;
	}
}

async function pullModel( model ) {
	console.log( `  Pulling model ${ model }...` );
	return new Promise( ( resolve, reject ) => {
		const child = spawn( 'ollama', [ 'pull', model ], {
			stdio: 'inherit',
		} );
		child.on( 'close', ( code ) => {
			if ( code === 0 ) {
				resolve();
			} else {
				reject( new Error( `ollama pull exited with code ${ code }` ) );
			}
		} );
	} );
}

// ---------------------------------------------------------------------------
// System prompt builder — mirrors react-agent.js
// ---------------------------------------------------------------------------

function buildSystemPrompt( abilities, disableThinking ) {
	const toolsList = abilities
		.map( ( a ) => `- ${ a.id }: ${ a.description || a.label || '' }` )
		.join( '\n' );

	return `You are a WordPress assistant. Respond with ONLY a JSON object, nothing else.

TOOLS:
${ toolsList }

FORMAT — every response must be exactly one JSON object:

Call a tool: {"action": "tool_call", "tool": "tool-id", "args": {}}
Final answer: {"action": "final_answer", "content": "Your answer here"}

RULES:
- One JSON object per response. No text before or after.
- Summarize tool results for humans. Never copy raw JSON into final_answer.
- If a tool fails, explain the failure in a final_answer.
- Never retry a failed tool. Never invent tool names.
- If no tool is needed, answer directly via final_answer.

EXAMPLE:

User: "list plugins"
{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}

[Tool returns data]
{"action": "final_answer", "content": "You have 2 plugins: Akismet (active) and Hello Dolly (inactive)."}

User: "what is a transient?"
{"action": "final_answer", "content": "A transient is temporary cached data in WordPress..."}${
		disableThinking ? '\n\n/nothink' : ''
	}`;
}

// ---------------------------------------------------------------------------
// Conversational system prompt — mirrors chat-orchestrator getSystemPrompt()
// ---------------------------------------------------------------------------

function buildConversationalPrompt() {
	return `You are a helpful WordPress assistant embedded in the wp-admin dashboard. Answer questions about WordPress clearly and concisely. If you don't know something, say so honestly.`;
}

// ---------------------------------------------------------------------------
// JSON parser — mirrors react-agent.js parseActionFromResponse()
// ---------------------------------------------------------------------------

function parseActionFromResponse( content ) {
	try {
		let text = content.trim();
		text = text.replace( /<think>[\s\S]*?<\/think>\s*/g, '' ).trim();
		if ( text.startsWith( '<think>' ) ) {
			const jsonStart = text.indexOf( '{' );
			if ( jsonStart > 0 ) {
				text = text.substring( jsonStart );
			} else {
				return null;
			}
		}
		if ( text.startsWith( '```json' ) ) {
			text = text.replace( /^```json\s*/, '' ).replace( /\s*```$/, '' );
		} else if ( text.startsWith( '```' ) ) {
			text = text.replace( /^```\s*/, '' ).replace( /\s*```$/, '' );
		}
		text = text.replace( /[\x00-\x1F]/g, ( match ) => {
			if ( match === '\n' || match === '\r' || match === '\t' ) {
				return ' ';
			}
			return '';
		} );

		try {
			const action = JSON.parse( text );
			if ( action.action ) {
				return action;
			}
		} catch {
			// Try fixes
		}

		const jsonText = text
			.replace( /'/g, '"' )
			.replace( /,(\s*[}\]])/g, '$1' )
			.replace( /"(\w+):([^"])/g, '"$1": $2' );
		try {
			const action = JSON.parse( jsonText );
			if ( action.action ) {
				return action;
			}
		} catch {
			// Try brace extraction
		}

		const firstBrace = jsonText.indexOf( '{' );
		if ( firstBrace === -1 ) {
			return null;
		}
		let braceCount = 0;
		let inString = false;
		let escapeNext = false;
		for ( let i = firstBrace; i < jsonText.length; i++ ) {
			const char = jsonText[ i ];
			if ( char === '"' && ! escapeNext ) {
				inString = ! inString;
				escapeNext = false;
				continue;
			}
			if ( char === '\\' && inString ) {
				escapeNext = ! escapeNext;
				continue;
			}
			escapeNext = false;
			if ( inString ) {
				continue;
			}
			if ( char === '{' ) {
				braceCount++;
			} else if ( char === '}' ) {
				braceCount--;
				if ( braceCount === 0 ) {
					const jsonStr = jsonText.substring( firstBrace, i + 1 );
					try {
						const action = JSON.parse( jsonStr );
						if ( action.action ) {
							return action;
						}
					} catch {
						return null;
					}
				}
			}
		}
		return null;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Extract plain text from LLM response (strip think blocks)
// ---------------------------------------------------------------------------

function extractAnswer( content ) {
	let text = content.trim();
	text = text.replace( /<think>[\s\S]*?<\/think>\s*/g, '' ).trim();

	// Try to parse as JSON and extract content
	const action = parseActionFromResponse( content );
	if ( action && action.action === 'final_answer' && action.content ) {
		return action.content;
	}

	// Return raw text (conversational response)
	return text;
}

// ---------------------------------------------------------------------------
// Ollama inference
// ---------------------------------------------------------------------------

async function chatCompletion( messages, model ) {
	const res = await fetch( `${ OLLAMA_BASE }/v1/chat/completions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( {
			model,
			messages,
			temperature: 0.3,
			max_tokens: 1024,
			stream: false,
		} ),
	} );

	if ( ! res.ok ) {
		const text = await res.text();
		throw new Error( `Ollama API error ${ res.status }: ${ text }` );
	}

	const data = await res.json();
	return data.choices[ 0 ].message.content;
}

// ---------------------------------------------------------------------------
// Turn evaluation
// ---------------------------------------------------------------------------

function evaluateTurn( turn, action, rawResponse ) {
	const toolCalled =
		action && action.action === 'tool_call' ? action.tool : null;
	let normalizedTool = toolCalled;
	if ( normalizedTool && ! normalizedTool.includes( '/' ) ) {
		normalizedTool = `wp-agentic-admin/${ normalizedTool }`;
	}

	// Check tool expectation
	if ( turn.expectTool !== undefined ) {
		if ( turn.expectTool === null ) {
			if ( normalizedTool !== null ) {
				return {
					passed: false,
					reason: `Expected no tool, got: ${ normalizedTool }`,
				};
			}
		} else if ( Array.isArray( turn.expectTool ) ) {
			if ( ! turn.expectTool.includes( normalizedTool ) ) {
				return {
					passed: false,
					reason: `Expected one of [${ turn.expectTool.join(
						', '
					) }], got: ${ normalizedTool || '(none)' }`,
				};
			}
		} else if ( normalizedTool !== turn.expectTool ) {
			return {
				passed: false,
				reason: `Expected ${ turn.expectTool }, got: ${
					normalizedTool || '(none)'
				}`,
			};
		}
	}

	// Check answer pattern
	if ( turn.expectAnswer ) {
		const answer = extractAnswer( rawResponse );
		const pattern =
			turn.expectAnswer instanceof RegExp
				? turn.expectAnswer
				: new RegExp( turn.expectAnswer, 'i' );
		if ( ! pattern.test( answer ) ) {
			return {
				passed: false,
				reason: `Answer did not match ${ pattern }: "${
					answer.length > 80
						? answer.substring( 0, 80 ) + '...'
						: answer
				}"`,
			};
		}
	}

	return { passed: true };
}

// ---------------------------------------------------------------------------
// Format tool result for history (mirrors chat-session.js)
// ---------------------------------------------------------------------------

function formatToolResult( toolId, result ) {
	const resultStr = JSON.stringify( result, null, 2 );
	const truncated =
		resultStr.length > 1000
			? resultStr.substring( 0, 1000 ) + '...(truncated)'
			: resultStr;
	return `[Tool Result from ${ toolId }]:\n${ truncated }`;
}

function formatWebSearchResults( results ) {
	if ( ! results || results.length === 0 ) {
		return '[Web search returned no results]';
	}
	const formatted = results
		.map( ( r, i ) => `${ i + 1 }. ${ r.title }\n   ${ r.snippet }` )
		.join( '\n' );
	return `[Tool Result from wp-agentic-admin/web-search]:\n${ formatted }`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

( async () => {
	console.log( '' );
	console.log( '╔══════════════════════════════════════════════╗' );
	console.log( '║   WP Agentic Admin — Multi-Turn Test Runner ║' );
	console.log( '║   Backend: Ollama (local)                   ║' );
	console.log( '╚══════════════════════════════════════════════╝' );
	console.log( '' );

	// Setup Ollama
	if ( ! isOllamaInstalled() ) {
		installOllama();
	} else {
		console.log( '  ✓ Ollama installed' );
	}

	if ( ! ( await isOllamaRunning() ) ) {
		startOllamaServe();
		if ( ! ( await waitForOllama() ) ) {
			console.error( '  Failed to start Ollama server.' );
			process.exit( 1 );
		}
	}
	console.log( '  ✓ Ollama running' );

	if ( ! ( await isModelPulled( modelId ) ) ) {
		await pullModel( modelId );
	}
	console.log( `  ✓ Model ready: ${ modelId }` );

	// Load test file
	const testConfig = require( testFilePath );
	const abilities = testConfig.abilities;
	const conversations = testConfig.conversations || [];

	if ( ! abilities || ! conversations.length ) {
		console.error(
			'Test file must export { abilities, conversations: [...] }'
		);
		process.exit( 1 );
	}

	console.log( '' );
	console.log( `  Model:          ${ modelId }` );
	console.log( `  Thinking:       ${ noThink ? 'DISABLED' : 'enabled' }` );
	console.log(
		`  Test file:      ${ path.relative( process.cwd(), testFilePath ) }`
	);
	console.log( `  Conversations:  ${ conversations.length }` );
	console.log(
		`  Total turns:    ${ conversations.reduce(
			( sum, c ) => sum + c.turns.length,
			0
		) }`
	);

	const reactPrompt = buildSystemPrompt( abilities, noThink );
	const convPrompt = buildConversationalPrompt();

	// Run conversations
	console.log( '' );
	const allResults = [];
	const startTime = Date.now();

	for ( let ci = 0; ci < conversations.length; ci++ ) {
		const convo = conversations[ ci ];
		const convoLabel = convo.name || `Conversation ${ ci + 1 }`;

		console.log(
			`  ── ${ convoLabel } (${ convo.turns.length } turns) ──`
		);

		// Conversation history accumulates across turns
		const history = [];

		for ( let ti = 0; ti < convo.turns.length; ti++ ) {
			const turn = convo.turns[ ti ];
			const turnLabel = `${ ci + 1 }.${ ti + 1 }`;

			process.stdout.write(
				`    [${ turnLabel }] "${ turn.input }" ... `
			);

			try {
				// Determine which system prompt to use for this turn
				const isReactTurn =
					turn.expectTool !== undefined && turn.expectTool !== null;
				const systemPrompt = isReactTurn ? reactPrompt : convPrompt;

				// Add user message to history
				history.push( { role: 'user', content: turn.input } );

				// Build messages: system + accumulated history
				const messages = [
					{ role: 'system', content: systemPrompt },
					...history,
				];

				// Call LLM
				const response = await chatCompletion( messages, modelId );

				if ( verbose ) {
					console.log( '' );
					console.log( `      LLM: ${ response }` );
				}

				const action = parseActionFromResponse( response );
				const result = evaluateTurn( turn, action, response );

				allResults.push( {
					conversation: convoLabel,
					turn: ti + 1,
					input: turn.input,
					passed: result.passed,
					reason: result.reason || null,
				} );

				console.log(
					result.passed ? '✓' : `✗ (${ result.reason })`
				);

				// Add assistant response to history
				const answer = extractAnswer( response );
				history.push( { role: 'assistant', content: answer } );

				// Inject mock tool result into history if provided
				if ( turn.mockResult ) {
					const toolId =
						action && action.tool
							? action.tool
							: turn.expectTool || 'unknown';
					history.push( {
						role: 'assistant',
						content: formatToolResult( toolId, turn.mockResult ),
					} );
				}

				// Inject web search results into history if provided
				if ( turn.webSearchResults ) {
					history.push( {
						role: 'assistant',
						content: formatWebSearchResults(
							turn.webSearchResults
						),
					} );
				}
			} catch ( err ) {
				allResults.push( {
					conversation: convoLabel,
					turn: ti + 1,
					input: turn.input,
					passed: false,
					reason: `ERROR: ${ err.message }`,
				} );
				console.log( `ERROR: ${ err.message }` );
			}
		}

		console.log( '' );
	}

	const totalTime = Date.now() - startTime;

	// Print summary
	const passed = allResults.filter( ( r ) => r.passed ).length;
	const total = allResults.length;
	const pct = total > 0 ? Math.round( ( passed / total ) * 100 ) : 0;

	console.log( `  ${ '─'.repeat( 60 ) }` );

	// Show failures
	const failures = allResults.filter( ( r ) => ! r.passed );
	if ( failures.length > 0 ) {
		console.log( '' );
		console.log( '  Failures:' );
		for ( const f of failures ) {
			console.log(
				`    ✗ [${ f.conversation } T${ f.turn }] "${ f.input }"`
			);
			console.log( `      ${ f.reason }` );
		}
	}

	console.log( '' );
	console.log(
		`  ${ passed }/${ total } turns passed (${ pct }%) in ${ (
			totalTime / 1000
		).toFixed( 1 ) }s`
	);
	console.log( '' );

	process.exit( passed === total ? 0 : 1 );
} )();
