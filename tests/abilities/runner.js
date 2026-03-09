#!/usr/bin/env node
/**
 * Ability Test Runner
 *
 * Launches headless Chrome with WebGPU, loads the test harness,
 * registers abilities, runs test cases, and prints results.
 *
 * The runner auto-detects the wp-agentic-admin plugin when the test file
 * lives under wp-content/plugins/. Third-party plugins can use this to
 * test their abilities without modifying wp-agentic-admin.
 *
 * Usage:
 *   npm run test:abilities -- --file tests/abilities/core-abilities.test.js
 *   node tests/abilities/runner.js --file /path/to/my-plugin/tests/my-test.js
 *   node tests/abilities/runner.js --file my-test.js --harness /path/to/wp-agentic-admin
 *
 * @since 0.5.0
 */

const puppeteer = require( 'puppeteer' );
const http = require( 'http' );
const path = require( 'path' );
const fs = require( 'fs' );

// Parse CLI arguments
const args = process.argv.slice( 2 );
const fileIndex = args.indexOf( '--file' );
const modelIndex = args.indexOf( '--model' );
const harnessIndex = args.indexOf( '--harness' );
const disableThinking = args.includes( '--no-think' );

if ( fileIndex === -1 || ! args[ fileIndex + 1 ] ) {
	console.error(
		'Usage: node runner.js --file <test-file.js> [--harness <wp-agentic-admin-path>]'
	);
	console.error( '' );
	console.error( 'Options:' );
	console.error( '  --file <path>       Path to test file (required)' );
	console.error(
		'  --model <id>        Model ID (default: Qwen3-1.7B-q4f16_1-MLC)'
	);
	console.error(
		'  --harness <path>    Path to wp-agentic-admin plugin directory'
	);
	console.error(
		'                      (auto-detected from test file location if omitted)'
	);
	console.error( '' );
	console.error( 'Examples:' );
	console.error(
		'  npm run test:abilities -- --file tests/abilities/core-abilities.test.js'
	);
	console.error(
		'  node runner.js --file ../my-seo-plugin/tests/abilities/seo.test.js'
	);
	process.exit( 1 );
}

const testFilePath = path.resolve( args[ fileIndex + 1 ] );
const modelId =
	modelIndex !== -1 && args[ modelIndex + 1 ]
		? args[ modelIndex + 1 ]
		: 'Qwen3-1.7B-q4f16_1-MLC';

if ( ! fs.existsSync( testFilePath ) ) {
	console.error( `Test file not found: ${ testFilePath }` );
	process.exit( 1 );
}

/**
 * Resolve the wp-agentic-admin plugin root.
 *
 * Priority:
 * 1. Explicit --harness flag
 * 2. Runner's own location (when run from wp-agentic-admin)
 * 3. Auto-detect by walking up from the test file to wp-content/plugins/
 *
 * @param {string} testFile Absolute path to the test file.
 * @return {string|null} Absolute path to the plugin root, or null.
 */
function resolvePluginRoot( testFile ) {
	// 1. Explicit --harness flag
	if ( harnessIndex !== -1 && args[ harnessIndex + 1 ] ) {
		const explicit = path.resolve( args[ harnessIndex + 1 ] );
		if (
			fs.existsSync(
				path.join( explicit, 'build-test-harness/test-harness.js' )
			)
		) {
			return explicit;
		}
		console.error( `Harness not found at: ${ explicit }` );
		console.error(
			'Expected build-test-harness/test-harness.js inside that directory.'
		);
		process.exit( 1 );
	}

	// 2. Runner's own location (this file lives in wp-agentic-admin/tests/abilities/)
	const runnerRoot = path.resolve( __dirname, '../..' );
	if (
		fs.existsSync(
			path.join( runnerRoot, 'build-test-harness/test-harness.js' )
		)
	) {
		return runnerRoot;
	}

	// 3. Auto-detect: walk up from test file looking for wp-content/plugins/wp-agentic-admin/
	let dir = path.dirname( testFile );
	while ( dir !== path.dirname( dir ) ) {
		const basename = path.basename( dir );
		if ( basename === 'plugins' ) {
			const candidate = path.join( dir, 'wp-agentic-admin' );
			if (
				fs.existsSync(
					path.join( candidate, 'build-test-harness/test-harness.js' )
				)
			) {
				return candidate;
			}
		}
		dir = path.dirname( dir );
	}

	return null;
}

const pluginRoot = resolvePluginRoot( testFilePath );

if ( ! pluginRoot ) {
	console.error(
		'Could not find wp-agentic-admin plugin with a built test harness.'
	);
	console.error( '' );
	console.error( 'Options:' );
	console.error(
		'  1. Run from the wp-agentic-admin directory: npm run test:abilities -- --file <path>'
	);
	console.error(
		'  2. Specify the path explicitly: --harness /path/to/wp-agentic-admin'
	);
	console.error(
		'  3. Place your plugin under the same wp-content/plugins/ directory'
	);
	process.exit( 1 );
}

const buildPath = path.resolve(
	pluginRoot,
	'build-test-harness/test-harness.js'
);

if ( ! fs.existsSync( buildPath ) ) {
	console.error(
		'Test harness not built. Run `npm run build:test-harness` first.'
	);
	process.exit( 1 );
}

( async () => {
	console.log( '' );
	console.log( '╔══════════════════════════════════════════════╗' );
	console.log( '║     WP Agentic Admin — Ability Test Runner  ║' );
	console.log( '╚══════════════════════════════════════════════╝' );
	console.log( '' );
	console.log( `  Model:     ${ modelId }` );
	console.log( `  Thinking:  ${ disableThinking ? 'DISABLED' : 'enabled' }` );
	console.log( `  Test file: ${ testFilePath }` );
	console.log( `  Harness:   ${ pluginRoot }` );
	console.log( '' );

	// Load test file
	const testConfig = require( testFilePath );
	const abilities = testConfig.abilities || [ testConfig.ability ];
	const tests = testConfig.tests || [];

	if ( ! abilities.length || ! tests.length ) {
		console.error( 'Test file must export { ability|abilities, tests }' );
		process.exit( 1 );
	}

	console.log(
		`  Abilities: ${ abilities.map( ( a ) => a.id ).join( ', ' ) }`
	);
	console.log( `  Tests:     ${ tests.length }` );
	console.log( '' );

	// Launch browser with WebGPU support
	console.log( '  Launching Chrome with WebGPU...' );
	const browser = await puppeteer.launch( {
		headless: 'new',
		protocolTimeout: 20 * 60 * 1000, // 20 minutes — model download + inference
		args: [
			'--enable-unsafe-webgpu',
			'--enable-features=Vulkan',
			'--use-vulkan=swiftshader',
			'--enable-dawn-features=allow_unsafe_apis',
			'--no-sandbox',
			'--disable-setuid-sandbox',
		],
	} );

	const page = await browser.newPage();

	// Forward console messages from the page to Node
	const verbose = args.includes( '--verbose' );
	page.on( 'console', ( msg ) => {
		const text = msg.text();
		if ( text.startsWith( '[TestHarness]' ) ) {
			console.log( `  ${ text.replace( '[TestHarness] ', '' ) }` );
		} else if ( verbose ) {
			console.log( `  [browser] ${ text }` );
		}
	} );

	// Forward page errors
	page.on( 'pageerror', ( err ) => {
		console.error( `  Page error: ${ err.message }` );
	} );

	// Start a local HTTP server (needed for Cache API / model downloads)
	const MIME_TYPES = {
		'.html': 'text/html',
		'.js': 'application/javascript',
		'.wasm': 'application/wasm',
		'.mjs': 'application/javascript',
		'.css': 'text/css',
		'.json': 'application/json',
	};

	const server = http.createServer( ( req, res ) => {
		const filePath = path.join( pluginRoot, req.url );
		const ext = path.extname( filePath );
		const contentType = MIME_TYPES[ ext ] || 'application/octet-stream';

		if ( fs.existsSync( filePath ) && fs.statSync( filePath ).isFile() ) {
			res.writeHead( 200, { 'Content-Type': contentType } );
			fs.createReadStream( filePath ).pipe( res );
		} else {
			res.writeHead( 404 );
			res.end( 'Not found' );
		}
	} );

	await new Promise( ( resolve ) => server.listen( 0, resolve ) );
	const port = server.address().port;
	console.log( `  Local server on port ${ port }` );

	try {
		// Navigate to test page via HTTP (required for Cache API)
		const testPageUrl = `http://localhost:${ port }/tests/abilities/test-page.html`;
		await page.goto( testPageUrl, {
			waitUntil: 'domcontentloaded',
			timeout: 30000,
		} );

		// Verify test harness loaded
		const harnessLoaded = await page.evaluate(
			() => !! window.TestHarness
		);
		if ( ! harnessLoaded ) {
			throw new Error(
				'TestHarness not found on page. Is the build up to date?'
			);
		}

		// Inject test configuration
		// Note: functions can't be serialized, so we strip execute and pass only serializable data
		const serializableAbilities = abilities.map( ( a ) => ( {
			id: a.id,
			label: a.label || '',
			description: a.description || '',
			keywords: a.keywords || [],
			requiresConfirmation: false,
		} ) );

		await page.evaluate(
			( config ) => {
				window.__testConfig = config;
			},
			{
				modelId,
				abilities: serializableAbilities,
				tests,
				disableThinking,
			}
		);

		// Run tests (this loads the model + executes all test cases)
		console.log( '' );
		const timeoutMs = 20 * 60 * 1000; // 20 minutes for model download + load + tests
		const results = await page.evaluate( () => window.runTests(), {
			timeout: timeoutMs,
		} );

		if ( results.error ) {
			throw new Error( results.error );
		}

		// Print results table
		console.log( '' );
		console.log(
			'  ┌─────────────────────────────────────────────────────────┐'
		);
		console.log(
			'  │ Results                                                 │'
		);
		console.log(
			'  ├────────┬────────────────────────────┬───────────────────┤'
		);
		console.log(
			'  │ Status │ Input                      │ Tool Called        │'
		);
		console.log(
			'  ├────────┼────────────────────────────┼───────────────────┤'
		);

		for ( const r of results.results ) {
			const status = r.passed ? '  PASS' : '  FAIL';
			const input =
				r.input.length > 26
					? r.input.substring( 0, 23 ) + '...'
					: r.input.padEnd( 26 );
			const tool = ( r.actualTool || '(none)' ).padEnd( 17 );
			const mark = r.passed ? '✓' : '✗';
			console.log(
				`  │ ${ mark } ${ status } │ ${ input } │ ${ tool } │`
			);
			if ( ! r.passed ) {
				const expectStr = Array.isArray( r.expectTool )
					? r.expectTool.join( ' | ' )
					: r.expectTool || '(none)';
				const expected =
					expectStr.length > 17
						? expectStr.substring( 0, 14 ) + '...'
						: expectStr.padEnd( 17 );
				console.log(
					`  │        │   expected:                │ ${ expected } │`
				);
			}
		}

		console.log(
			'  └────────┴────────────────────────────┴───────────────────┘'
		);
		console.log( '' );
		console.log( `  ${ results.passed }/${ results.total } passed` );
		console.log( `  Mode: ${ results.mode || 'unknown' }` );
		console.log( '' );

		// Exit with appropriate code
		await browser.close();
		server.close();
		process.exit( results.passed === results.total ? 0 : 1 );
	} catch ( err ) {
		console.error( `\n  Error: ${ err.message }` );
		await browser.close();
		server.close();
		process.exit( 1 );
	}
} )();
