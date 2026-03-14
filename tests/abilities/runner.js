#!/usr/bin/env node
/**
 * Ability Test Runner — Ollama Backend
 *
 * Tests tool selection accuracy by sending prompts to a local Ollama instance
 * running Qwen 3 1.7B. Uses the same system prompt and JSON format as the
 * browser-based ReAct agent, but without WebLLM, WebGPU, or a browser.
 *
 * Prerequisites: Ollama (auto-installed via Homebrew if missing on macOS)
 *
 * Usage:
 *   npm run test:abilities -- --file tests/abilities/core-abilities.test.js
 *   node tests/abilities/runner.js --file tests/abilities/core-abilities.test.js
 *   node tests/abilities/runner.js --file tests/abilities/core-abilities.test.js --model qwen3:1.7b
 *
 * @since 0.7.0
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
const noThink = args.includes( '--no-think' );

if ( fileIndex === -1 || ! args[ fileIndex + 1 ] ) {
	console.error(
		'Usage: node runner.js --file <test-file.js> [--model <ollama-model>]'
	);
	console.error( '' );
	console.error( 'Options:' );
	console.error( '  --file <path>       Path to test file (required)' );
	console.error( '  --model <id>        Ollama model (default: qwen3:1.7b)' );
	console.error(
		'  --no-think          Append /nothink to disable Qwen 3 thinking'
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
		console.error(
			'Auto-install is only supported on macOS via Homebrew.'
		);
		console.error( 'Install Ollama manually: https://ollama.com/download' );
		process.exit( 1 );
	}

	try {
		execSync( 'which brew', { stdio: 'ignore' } );
	} catch {
		console.error(
			'Homebrew not found. Install Ollama manually: https://ollama.com/download'
		);
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
		await sleep( 500 );
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
	console.log(
		`  Pulling model ${ model } (this may take a few minutes)...`
	);
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

function sleep( ms ) {
	return new Promise( ( r ) => setTimeout( r, ms ) );
}

// ---------------------------------------------------------------------------
// System prompt builder — mirrors react-agent.js buildSystemPromptPromptBased()
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
// JSON parser — mirrors react-agent.js parseActionFromResponse()
// ---------------------------------------------------------------------------

function parseActionFromResponse( content ) {
	try {
		let text = content.trim();

		// Strip <think>...</think> blocks
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
			// Try with syntax fixes
		}

		// Fix common JSON issues from small models
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
// Test evaluation
// ---------------------------------------------------------------------------

function evaluateTest( test, action ) {
	const toolCalled =
		action && action.action === 'tool_call' ? action.tool : null;

	if ( test.expectTool === null ) {
		return { passed: toolCalled === null, toolCalled };
	}

	if ( Array.isArray( test.expectTool ) ) {
		return { passed: test.expectTool.includes( toolCalled ), toolCalled };
	}

	return { passed: toolCalled === test.expectTool, toolCalled };
}

// ---------------------------------------------------------------------------
// Table formatting
// ---------------------------------------------------------------------------

function pad( str, len ) {
	if ( str.length > len ) {
		return str.substring( 0, len - 3 ) + '...';
	}
	return str + ' '.repeat( len - str.length );
}

function printResults( results, totalTime ) {
	const COL_STATUS = 8;
	const COL_INPUT = 30;
	const COL_TOOL = 28;

	const divider = `  ${ '─'.repeat( COL_STATUS ) }┬${ '─'.repeat(
		COL_INPUT
	) }┬${ '─'.repeat( COL_TOOL ) }`;

	console.log( '' );
	console.log( `  ${ '─'.repeat( COL_STATUS + COL_INPUT + COL_TOOL + 2 ) }` );
	console.log(
		`  ${ pad( ' Status', COL_STATUS ) }│${ pad(
			' Input',
			COL_INPUT
		) }│${ pad( ' Tool Called', COL_TOOL ) }`
	);
	console.log( divider );

	for ( const r of results ) {
		const mark = r.passed ? '✓' : '✗';
		const status = r.passed ? ' PASS' : ' FAIL';
		const input = pad( ` ${ r.input }`, COL_INPUT );
		const tool = pad( ` ${ r.toolCalled || '(none)' }`, COL_TOOL );

		console.log(
			`  ${ pad(
				` ${ mark }${ status }`,
				COL_STATUS
			) }│${ input }│${ tool }`
		);

		if ( ! r.passed ) {
			const expectStr = Array.isArray( r.expectTool )
				? r.expectTool.join( ' | ' )
				: r.expectTool || '(none)';
			const expected = pad( ` expected: ${ expectStr }`, COL_TOOL );
			console.log(
				`  ${ pad( '', COL_STATUS ) }│${ pad(
					'',
					COL_INPUT
				) }│${ expected }`
			);
		}
	}

	console.log( `  ${ '─'.repeat( COL_STATUS + COL_INPUT + COL_TOOL + 2 ) }` );

	const passed = results.filter( ( r ) => r.passed ).length;
	const total = results.length;
	const pct = total > 0 ? Math.round( ( passed / total ) * 100 ) : 0;

	console.log( '' );
	console.log(
		`  ${ passed }/${ total } passed (${ pct }%) in ${ (
			totalTime / 1000
		).toFixed( 1 ) }s`
	);
	console.log( '' );

	return passed === total ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

( async () => {
	console.log( '' );
	console.log( '╔══════════════════════════════════════════════╗' );
	console.log( '║   WP Agentic Admin — Ability Test Runner    ║' );
	console.log( '║   Backend: Ollama (local)                   ║' );
	console.log( '╚══════════════════════════════════════════════╝' );
	console.log( '' );

	// Step 1: Ensure Ollama is installed
	if ( ! isOllamaInstalled() ) {
		console.log( '  Ollama not found.' );
		installOllama();
	} else {
		console.log( '  ✓ Ollama installed' );
	}

	// Step 2: Ensure Ollama is running
	if ( ! ( await isOllamaRunning() ) ) {
		startOllamaServe();
		const running = await waitForOllama();
		if ( ! running ) {
			console.error( '  Failed to start Ollama server after 15s.' );
			console.error(
				'  Try running `ollama serve` manually in another terminal.'
			);
			process.exit( 1 );
		}
	}
	console.log( '  ✓ Ollama running' );

	// Step 3: Ensure model is pulled
	if ( ! ( await isModelPulled( modelId ) ) ) {
		await pullModel( modelId );
	}
	console.log( `  ✓ Model ready: ${ modelId }` );

	// Step 4: Load test file
	const testConfig = require( testFilePath );
	const abilities = testConfig.abilities || [ testConfig.ability ];
	const tests = testConfig.tests || [];

	if ( ! abilities.length || ! tests.length ) {
		console.error( 'Test file must export { abilities, tests }' );
		process.exit( 1 );
	}

	console.log( '' );
	console.log( `  Model:      ${ modelId }` );
	console.log( `  Thinking:   ${ noThink ? 'DISABLED' : 'enabled' }` );
	console.log(
		`  Test file:  ${ path.relative( process.cwd(), testFilePath ) }`
	);
	console.log(
		`  Abilities:  ${ abilities.map( ( a ) => a.id ).join( ', ' ) }`
	);
	console.log( `  Tests:      ${ tests.length }` );

	// Step 5: Build system prompt
	const systemPrompt = buildSystemPrompt( abilities, noThink );

	if ( verbose ) {
		console.log( '' );
		console.log( '  ── System Prompt ──' );
		console.log(
			systemPrompt
				.split( '\n' )
				.map( ( l ) => `  │ ${ l }` )
				.join( '\n' )
		);
		console.log( '  ── End ──' );
	}

	// Step 6: Run tests
	console.log( '' );
	const results = [];
	const startTime = Date.now();

	for ( let i = 0; i < tests.length; i++ ) {
		const test = tests[ i ];
		const label = `${ i + 1 }/${ tests.length }`;

		process.stdout.write( `  [${ label }] "${ test.input }" ... ` );

		try {
			const messages = [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: test.input },
			];

			const response = await chatCompletion( messages, modelId );

			if ( verbose ) {
				console.log( '' );
				console.log( `    LLM: ${ response }` );
			}

			const action = parseActionFromResponse( response );
			const { passed, toolCalled } = evaluateTest( test, action );

			results.push( {
				input: test.input,
				expectTool: test.expectTool,
				toolCalled,
				action,
				rawResponse: response,
				passed,
			} );

			console.log(
				passed ? '✓' : `✗ (got: ${ toolCalled || '(none)' })`
			);
		} catch ( err ) {
			results.push( {
				input: test.input,
				expectTool: test.expectTool,
				toolCalled: null,
				error: err.message,
				passed: false,
			} );
			console.log( `ERROR: ${ err.message }` );
		}
	}

	const totalTime = Date.now() - startTime;

	// Step 7: Print results
	const exitCode = printResults( results, totalTime );
	process.exit( exitCode );
} )();
