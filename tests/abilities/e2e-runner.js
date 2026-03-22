#!/usr/bin/env node
/**
 * End-to-End Conversation Test Runner
 *
 * Mirrors the browser's exact flow using copied logic from:
 * - react-agent.js: system prompt, JSON parser, ReAct loop, tool result formatter
 * - message-router.js: routing decisions (ReAct vs conversational)
 * - chat-session.js: conversation history formatting
 *
 * Uses Ollama as the LLM engine and the WP REST API for real tool execution.
 *
 * Usage:
 *   npm run test:e2e -- --file tests/abilities/e2e-conversations.test.js
 *   npm run test:e2e -- --file tests/abilities/e2e-conversations.test.js --wp-url https://mysite.local --wp-user admin --wp-pass xxxx
 *
 * @since 0.10.0
 */

const { execSync, spawn } = require( 'child_process' );
const path = require( 'path' );
const fs = require( 'fs' );

// Allow self-signed certs for local dev (e.g. *.local with mkcert)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice( 2 );
const fileIndex = args.indexOf( '--file' );
const modelIndex = args.indexOf( '--model' );
const wpUrlIndex = args.indexOf( '--wp-url' );
const wpUserIndex = args.indexOf( '--wp-user' );
const wpPassIndex = args.indexOf( '--wp-pass' );
const verbose = args.includes( '--verbose' );
const noThink = ! args.includes( '--think' );

if ( fileIndex === -1 || ! args[ fileIndex + 1 ] ) {
	console.error( 'Usage: node e2e-runner.js --file <test-file.js> [options]' );
	console.error( '' );
	console.error( 'Options:' );
	console.error( '  --file <path>       Path to test file (required)' );
	console.error( '  --model <id>        Ollama model (default: qwen3:1.7b)' );
	console.error( '  --think             Enable thinking (default: off)' );
	console.error( '  --wp-url <url>      WordPress URL (default: https://wp-agentic-admin.local)' );
	console.error( '  --wp-user <user>    WP application password username' );
	console.error( '  --wp-pass <pass>    WP application password' );
	console.error( '  --verbose           Show full LLM responses and API results' );
	process.exit( 1 );
}

const testFilePath = path.resolve( args[ fileIndex + 1 ] );
const modelId = modelIndex !== -1 && args[ modelIndex + 1 ] ? args[ modelIndex + 1 ] : 'qwen3:1.7b';
const wpUrl = ( wpUrlIndex !== -1 && args[ wpUrlIndex + 1 ] ? args[ wpUrlIndex + 1 ] : 'https://wp-agentic-admin.local' ).replace( /\/$/, '' );
const wpUser = wpUserIndex !== -1 ? args[ wpUserIndex + 1 ] : '';
// Application passwords have spaces — collect all args until the next flag
let wpPass = '';
if ( wpPassIndex !== -1 ) {
	const passArgs = [];
	for ( let i = wpPassIndex + 1; i < args.length; i++ ) {
		if ( args[ i ].startsWith( '--' ) ) {
			break;
		}
		passArgs.push( args[ i ] );
	}
	wpPass = passArgs.join( ' ' );
}

if ( ! fs.existsSync( testFilePath ) ) {
	console.error( `Test file not found: ${ testFilePath }` );
	process.exit( 1 );
}

// ---------------------------------------------------------------------------
// Config — copied from react-agent.js REACT_CONFIG
// ---------------------------------------------------------------------------

const REACT_CONFIG = {
	maxIterations: 10,
	temperature: 0.3,
	maxTokens: 1024,
	maxToolResultLength: 3000,
	disableThinking: noThink,
	disableThinkingAfterTool: noThink,
};

// ---------------------------------------------------------------------------
// Ollama setup helpers
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
		console.error( 'Auto-install only supported on macOS. Install Ollama manually.' );
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
		return ( await fetch( `${ OLLAMA_BASE }/api/tags` ) ).ok;
	} catch {
		return false;
	}
}

function startOllamaServe() {
	console.log( '  Starting Ollama server...' );
	const child = spawn( 'ollama', [ 'serve' ], { stdio: 'ignore', detached: true } );
	child.unref();
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
		const data = await ( await fetch( `${ OLLAMA_BASE }/api/tags` ) ).json();
		return ( data.models || [] ).some( ( m ) => m.name === model || m.name === `${ model }:latest` || m.name.startsWith( model ) );
	} catch {
		return false;
	}
}

async function pullModel( model ) {
	console.log( `  Pulling model ${ model }...` );
	return new Promise( ( resolve, reject ) => {
		const child = spawn( 'ollama', [ 'pull', model ], { stdio: 'inherit' } );
		child.on( 'close', ( code ) => code === 0 ? resolve() : reject( new Error( `exit ${ code }` ) ) );
	} );
}

// ---------------------------------------------------------------------------
// Ollama LLM call
// ---------------------------------------------------------------------------

async function chatCompletion( messages ) {
	const res = await fetch( `${ OLLAMA_BASE }/v1/chat/completions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( {
			model: modelId,
			messages,
			temperature: REACT_CONFIG.temperature,
			max_tokens: REACT_CONFIG.maxTokens,
			stream: false,
		} ),
	} );
	if ( ! res.ok ) {
		throw new Error( `Ollama ${ res.status }: ${ await res.text() }` );
	}
	return ( await res.json() ).choices[ 0 ].message.content;
}

// ---------------------------------------------------------------------------
// WP REST API — real tool execution
// ---------------------------------------------------------------------------

async function wpExecuteTool( toolId, toolArgs = {} ) {
	const parts = toolId.includes( '/' ) ? toolId.split( '/' ) : [ 'wp-agentic-admin', toolId ];
	const baseEndpoint = `${ wpUrl }/wp-json/wp-abilities/v1/abilities/${ parts[ 0 ] }/${ parts[ 1 ] }/run`;
	const headers = {};

	if ( wpUser && wpPass ) {
		headers.Authorization = 'Basic ' + Buffer.from( `${ wpUser }:${ wpPass }` ).toString( 'base64' );
	}

	const hasArgs = toolArgs && typeof toolArgs === 'object' && Object.keys( toolArgs ).length > 0;

	// Build query string for GET requests (mirrors abilities-api.js buildInputQueryString)
	function buildQueryString( input ) {
		const params = new URLSearchParams();
		for ( const [ key, val ] of Object.entries( input ) ) {
			params.append( `input[${ key }]`, String( val ) );
		}
		return '?' + params.toString();
	}

	// Try GET first (with args as query params), fall back to POST.
	// This mirrors the browser's logic: read-only abilities use GET.
	const getEndpoint = hasArgs ? baseEndpoint + buildQueryString( toolArgs ) : baseEndpoint;

	let res = await fetch( getEndpoint, { method: 'GET', headers } );

	// If GET fails (405 or 400), retry with POST
	if ( res.status === 405 || res.status === 400 ) {
		headers[ 'Content-Type' ] = 'application/json';
		res = await fetch( baseEndpoint, {
			method: 'POST',
			headers,
			body: JSON.stringify( { input: toolArgs } ),
		} );
	}

	if ( ! res.ok ) {
		const text = await res.text();
		throw new Error( `WP API ${ res.status }: ${ text.substring( 0, 200 ) }` );
	}
	return await res.json();
}

// ---------------------------------------------------------------------------
// System prompt — copied from react-agent.js buildSystemPromptPromptBased()
// ---------------------------------------------------------------------------

function buildReactSystemPrompt( abilities ) {
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

User: "what environment is this?"
{"action": "tool_call", "tool": "core/get-environment-info", "args": {}}

User: "what is a transient?"
{"action": "final_answer", "content": "A transient is temporary cached data in WordPress..."}${ REACT_CONFIG.disableThinking ? '\n\n/nothink' : '' }`;
}

function buildConversationalPrompt() {
	return 'You are a helpful WordPress assistant embedded in the wp-admin dashboard. Answer questions about WordPress clearly and concisely. If you don\'t know something, say so honestly.';
}

// ---------------------------------------------------------------------------
// JSON parser — copied from react-agent.js parseActionFromResponse()
// ---------------------------------------------------------------------------

function parseActionFromResponse( content ) {
	try {
		let text = content.trim();

		// Strip <think> blocks
		text = text.replace( /<think>[\s\S]*?<\/think>\s*/g, '' ).trim();
		if ( text.startsWith( '<think>' ) ) {
			const jsonStart = text.indexOf( '{' );
			if ( jsonStart > 0 ) {
				text = text.substring( jsonStart );
			} else {
				return null;
			}
		}

		// Remove markdown code blocks
		if ( text.startsWith( '```json' ) ) {
			text = text.replace( /^```json\s*/, '' ).replace( /\s*```$/, '' );
		} else if ( text.startsWith( '```' ) ) {
			text = text.replace( /^```\s*/, '' ).replace( /\s*```$/, '' );
		}

		// Sanitize control characters
		text = text.replace( /[\x00-\x1F]/g, ( match ) => {
			if ( match === '\n' || match === '\r' || match === '\t' ) {
				return ' ';
			}
			return '';
		} );

		// Try clean parse first
		try {
			const action = JSON.parse( text );
			if ( action.action ) {
				return action;
			}
		} catch {
			// Try fixes
		}

		// Fix common JSON issues
		const jsonText = text
			.replace( /(?<=[[{,:\s])'|'(?=[}\],:\s])/g, '"' )
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

		// Extract first valid JSON by counting braces
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
					try {
						const action = JSON.parse( jsonText.substring( firstBrace, i + 1 ) );
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
// Tool result message — copied from react-agent.js buildToolResultMessage()
// ---------------------------------------------------------------------------

function buildToolResultMessage( toolResult, truncatedResult ) {
	let message;
	if ( toolResult.result_for_llm ) {
		message = `Tool interpretation: ${ toolResult.result_for_llm }`;
		if ( ! REACT_CONFIG.disableThinkingAfterTool ) {
			message += `\n\nRaw data: ${ truncatedResult }`;
		}
	} else {
		message = `Tool result: ${ truncatedResult }`;
	}
	const suffix = '\n\nRemember: Respond with ONLY a JSON object. Either call another tool or provide final_answer.';
	const nothink = REACT_CONFIG.disableThinkingAfterTool ? '\n\n/nothink' : '';
	return message + suffix + nothink;
}

// ---------------------------------------------------------------------------
// Router — copied from message-router.js
// ---------------------------------------------------------------------------

const ACTION_WORDS = [
	'list', 'show', 'check', 'flush', 'clear', 'purge', 'optimize',
	'activate', 'deactivate', 'enable', 'disable', 'turn on', 'turn off',
	'read', 'run', 'delete', 'clean', 'fix', 'refresh', 'regenerate',
	'reset', 'view',
];

const QUESTION_WORDS = [
	'what is', 'what are', 'what does', 'explain', 'define',
	'difference between', 'tell me about', 'meaning of',
];

function routeMessage( message, abilities ) {
	const lower = message.toLowerCase().trim();

	// Check tool keywords
	let hasKeyword = false;
	for ( const ability of abilities ) {
		if ( ! ability.keywords ) {
			continue;
		}
		for ( const kw of ability.keywords ) {
			if ( lower.includes( kw.toLowerCase() ) ) {
				hasKeyword = true;
				break;
			}
		}
		if ( hasKeyword ) {
			break;
		}
	}

	const hasAction = ACTION_WORDS.some( ( w ) => lower.includes( w ) );
	const isQuestion = QUESTION_WORDS.some( ( w ) => lower.startsWith( w ) );

	// Keyword + action → ReAct without thinking
	if ( hasKeyword && hasAction ) {
		return { type: 'react', disableThinking: true };
	}
	// Keyword + knowledge question → conversational
	if ( hasKeyword && isQuestion ) {
		return { type: 'conversational' };
	}
	// Keyword but ambiguous → ReAct with thinking
	if ( hasKeyword ) {
		return { type: 'react', disableThinking: false };
	}
	// No keyword → conversational
	return { type: 'conversational' };
}

// ---------------------------------------------------------------------------
// ReAct loop — copied from react-agent.js executeWithPromptBased()
// ---------------------------------------------------------------------------

async function executeReactLoop( userMessage, conversationHistory, systemPrompt ) {
	const toolsUsed = [];
	const observations = [];
	let iteration = 0;

	const messages = [
		{ role: 'system', content: systemPrompt },
		...conversationHistory,
		{ role: 'user', content: userMessage },
	];

	while ( iteration < REACT_CONFIG.maxIterations ) {
		iteration++;

		if ( verbose ) {
			console.log( `      [ReAct iteration ${ iteration }]` );
		}

		const response = await chatCompletion( messages );

		if ( verbose ) {
			const clean = response.replace( /<think>[\s\S]*?<\/think>\s*/g, '' ).trim();
			console.log( `      LLM: ${ clean.length > 120 ? clean.substring( 0, 120 ) + '...' : clean }` );
		}

		// Strip think blocks for parsing
		const content = response.replace( /<think>[\s\S]*?<\/think>\s*/g, '' ).trim();
		const action = parseActionFromResponse( content );

		// No valid JSON → treat as final answer
		if ( ! action ) {
			if ( toolsUsed.length > 0 ) {
				return { success: true, finalAnswer: content, iterations: iteration, toolsUsed, observations };
			}
			return { success: false, finalAnswer: content || 'Failed to parse response', iterations: iteration, toolsUsed, observations };
		}

		// Final answer
		if ( action.action === 'final_answer' ) {
			return { success: true, finalAnswer: action.content || action.answer || 'Task completed.', iterations: iteration, toolsUsed, observations };
		}

		// Tool call
		if ( action.action === 'tool_call' ) {
			const toolName = action.tool;
			const toolArgs = action.args || {};

			// Detect repeated tool call
			if ( toolsUsed.length > 0 && toolsUsed[ toolsUsed.length - 1 ] === toolName ) {
				return { success: true, finalAnswer: 'Data gathered but stopped due to repeated tool call.', iterations: iteration, toolsUsed, observations };
			}

			// Execute via WP REST API
			let toolResult;
			try {
				toolResult = await wpExecuteTool( toolName, toolArgs );
				if ( verbose ) {
					const preview = JSON.stringify( toolResult );
					console.log( `      Tool ${ toolName }: ${ preview.length > 100 ? preview.substring( 0, 100 ) + '...' : preview }` );
				}
			} catch ( err ) {
				toolResult = { success: false, error: err.message };
				if ( verbose ) {
					console.log( `      Tool ${ toolName } ERROR: ${ err.message }` );
				}
			}

			toolsUsed.push( toolName );
			observations.push( { tool: toolName, args: toolArgs, result: toolResult } );

			// Truncate and feed result back to LLM
			const resultStr = JSON.stringify( toolResult );
			const truncated = resultStr.length > REACT_CONFIG.maxToolResultLength
				? resultStr.substring( 0, REACT_CONFIG.maxToolResultLength ) + '...[truncated]'
				: resultStr;

			messages.push( { role: 'assistant', content } );
			messages.push( { role: 'user', content: buildToolResultMessage( toolResult, truncated ) } );

			continue;
		}

		// Unknown action
		return { success: false, finalAnswer: 'Unknown action type', iterations: iteration, toolsUsed, observations };
	}

	return { success: false, finalAnswer: 'Max iterations reached', iterations: iteration, toolsUsed, observations };
}

// ---------------------------------------------------------------------------
// Conversational LLM call (no tools)
// ---------------------------------------------------------------------------

async function executeConversational( userMessage, conversationHistory ) {
	const messages = [
		{ role: 'system', content: buildConversationalPrompt() },
		...conversationHistory,
		{ role: 'user', content: userMessage },
	];

	const response = await chatCompletion( messages );
	const clean = response.replace( /<think>[\s\S]*?<\/think>\s*/g, '' ).trim();

	if ( verbose ) {
		console.log( `      LLM (conv): ${ clean.length > 120 ? clean.substring( 0, 120 ) + '...' : clean }` );
	}

	return { success: true, finalAnswer: clean, iterations: 1, toolsUsed: [], observations: [] };
}

// ---------------------------------------------------------------------------
// Format tool result for conversation history (mirrors chat-session.js)
// ---------------------------------------------------------------------------

function formatToolResultForHistory( toolId, result ) {
	const str = JSON.stringify( result, null, 2 );
	const truncated = str.length > 1000 ? str.substring( 0, 1000 ) + '...(truncated)' : str;
	return `[Tool Result from ${ toolId }]:\n${ truncated }`;
}

// ---------------------------------------------------------------------------
// Turn evaluation
// ---------------------------------------------------------------------------

function evaluateTurn( turn, result ) {
	// Normalize tool names
	const toolsUsed = result.toolsUsed.map( ( t ) => t.includes( '/' ) ? t : `wp-agentic-admin/${ t }` );
	const firstTool = toolsUsed[ 0 ] || null;

	// Check tool expectation
	if ( turn.expectTool !== undefined ) {
		if ( turn.expectTool === null ) {
			if ( firstTool !== null ) {
				return { passed: false, reason: `Expected no tool, got: ${ firstTool }` };
			}
		} else if ( Array.isArray( turn.expectTool ) ) {
			if ( ! turn.expectTool.includes( firstTool ) ) {
				return { passed: false, reason: `Expected [${ turn.expectTool.join( '|' ) }], got: ${ firstTool || '(none)' }` };
			}
		} else if ( firstTool !== turn.expectTool ) {
			return { passed: false, reason: `Expected ${ turn.expectTool }, got: ${ firstTool || '(none)' }` };
		}
	}

	// Check answer pattern
	if ( turn.expectAnswer ) {
		const pattern = turn.expectAnswer instanceof RegExp ? turn.expectAnswer : new RegExp( turn.expectAnswer, 'i' );
		if ( ! pattern.test( result.finalAnswer || '' ) ) {
			const preview = ( result.finalAnswer || '' ).substring( 0, 80 );
			return { passed: false, reason: `Answer didn't match ${ pattern }: "${ preview }..."` };
		}
	}

	return { passed: true };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

( async () => {
	console.log( '' );
	console.log( '╔══════════════════════════════════════════════╗' );
	console.log( '║   WP Agentic Admin — E2E Test Runner        ║' );
	console.log( '║   Ollama + WP REST API (real tool calls)    ║' );
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
			console.error( '  Failed to start Ollama.' );
			process.exit( 1 );
		}
	}
	console.log( '  ✓ Ollama running' );
	if ( ! ( await isModelPulled( modelId ) ) ) {
		await pullModel( modelId );
	}
	console.log( `  ✓ Model ready: ${ modelId }` );

	// Test WP API connectivity
	try {
		const headers = {};
		if ( wpUser && wpPass ) {
			headers.Authorization = 'Basic ' + Buffer.from( `${ wpUser }:${ wpPass }` ).toString( 'base64' );
		}
		const wpTest = await fetch( `${ wpUrl }/wp-json/wp-abilities/v1/abilities`, { headers } );
		if ( wpTest.ok ) {
			console.log( `  ✓ WP API connected (${ wpUrl })` );
		} else {
			console.error( `  ✗ WP API returned ${ wpTest.status }. Check --wp-url, --wp-user, --wp-pass` );
			process.exit( 1 );
		}
	} catch ( err ) {
		console.error( `  ✗ WP API unreachable: ${ err.message }` );
		process.exit( 1 );
	}

	// Load test file
	const testConfig = require( testFilePath );
	const abilities = testConfig.abilities;
	const conversations = testConfig.conversations || [];

	if ( ! abilities || ! conversations.length ) {
		console.error( 'Test file must export { abilities, conversations }' );
		process.exit( 1 );
	}

	console.log( '' );
	console.log( `  Model:          ${ modelId }` );
	console.log( `  Thinking:       ${ noThink ? 'DISABLED' : 'enabled' }` );
	console.log( `  WP URL:         ${ wpUrl }` );
	console.log( `  Test file:      ${ path.relative( process.cwd(), testFilePath ) }` );
	console.log( `  Conversations:  ${ conversations.length }` );
	console.log( `  Total turns:    ${ conversations.reduce( ( s, c ) => s + c.turns.length, 0 ) }` );

	const reactPrompt = buildReactSystemPrompt( abilities );

	// Run conversations
	console.log( '' );
	const allResults = [];
	const startTime = Date.now();

	for ( let ci = 0; ci < conversations.length; ci++ ) {
		const convo = conversations[ ci ];
		const label = convo.name || `Conversation ${ ci + 1 }`;
		console.log( `  ── ${ label } (${ convo.turns.length } turns) ──` );

		// Conversation history — accumulates across turns like the browser
		const history = [];

		for ( let ti = 0; ti < convo.turns.length; ti++ ) {
			const turn = convo.turns[ ti ];
			process.stdout.write( `    [${ ci + 1 }.${ ti + 1 }] "${ turn.input }" ... ` );

			try {
				// Always use ReAct prompt — the LLM decides tool_call vs final_answer.
				// This mirrors the browser's most common path and lets us test both
				// tool selection AND conversational answers in the same loop.
				const result = await executeReactLoop( turn.input, history, reactPrompt );

				// Evaluate
				const evalResult = evaluateTurn( turn, result );
				allResults.push( {
					conversation: label,
					turn: ti + 1,
					input: turn.input,
					route: 'react',
					toolsUsed: result.toolsUsed,
					iterations: result.iterations,
					passed: evalResult.passed,
					reason: evalResult.reason || null,
				} );

				if ( evalResult.passed ) {
					const toolInfo = result.toolsUsed.length > 0 ? ` [${result.toolsUsed.join(', ')}]` : '';
					console.log( `✓${ toolInfo } (${ result.iterations } iter)` );
				} else {
					console.log( `✗ (${ evalResult.reason })` );
				}

				// Update conversation history for next turn
				// Add user message
				history.push( { role: 'user', content: turn.input } );

				// Add tool results (if any)
				for ( const obs of result.observations ) {
					history.push( {
						role: 'assistant',
						content: formatToolResultForHistory( obs.tool, obs.result ),
					} );
				}

				// Add final answer
				if ( result.finalAnswer ) {
					history.push( { role: 'assistant', content: result.finalAnswer } );
				}

			} catch ( err ) {
				allResults.push( {
					conversation: label,
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

	// Summary
	console.log( `  ${ '─'.repeat( 60 ) }` );

	const failures = allResults.filter( ( r ) => ! r.passed );
	if ( failures.length > 0 ) {
		console.log( '' );
		console.log( '  Failures:' );
		for ( const f of failures ) {
			console.log( `    ✗ [${ f.conversation } T${ f.turn }] "${ f.input }"` );
			console.log( `      ${ f.reason }` );
		}
	}

	const passed = allResults.filter( ( r ) => r.passed ).length;
	const total = allResults.length;
	const pct = total > 0 ? Math.round( ( passed / total ) * 100 ) : 0;

	console.log( '' );
	console.log( `  ${ passed }/${ total } turns passed (${ pct }%) in ${ ( totalTime / 1000 ).toFixed( 1 ) }s` );
	console.log( '' );

	process.exit( passed === total ? 0 : 1 );
} )();
