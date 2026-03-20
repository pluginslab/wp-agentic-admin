/**
 * Utility "test" to print the system prompt to the terminal.
 *
 * Run with: npm test -- --testPathPattern=print-system-prompt
 */

import { ReactAgent } from '../react-agent';
import instructionRegistry from '../instruction-registry';
import { ToolRegistry } from '../tool-registry';
import { registerAllInstructions } from '../../instructions';

jest.mock( '../../utils/logger', () => ( {
	createLogger: () => ( {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	} ),
} ) );

// Minimal mock tools matching the ability IDs used by instructions
const MOCK_TOOLS = [
	{ id: 'wp-agentic-admin/plugin-list', label: 'List Plugins', description: 'List all installed plugins', keywords: [ 'plugin' ], execute: jest.fn() },
	{ id: 'wp-agentic-admin/plugin-activate', label: 'Activate Plugin', description: 'Activate a plugin by name', keywords: [ 'activate' ], execute: jest.fn() },
	{ id: 'wp-agentic-admin/plugin-deactivate', label: 'Deactivate Plugin', description: 'Deactivate a plugin by name', keywords: [ 'deactivate' ], execute: jest.fn() },
	{ id: 'wp-agentic-admin/cache-flush', label: 'Flush Cache', description: 'Clear all object caches', keywords: [ 'cache' ], execute: jest.fn() },
	{ id: 'wp-agentic-admin/transient-flush', label: 'Flush Transients', description: 'Delete expired transients', keywords: [ 'transient' ], execute: jest.fn() },
	{ id: 'wp-agentic-admin/db-optimize', label: 'Optimize Database', description: 'Optimize database tables', keywords: [ 'database' ], execute: jest.fn() },
	{ id: 'wp-agentic-admin/revision-cleanup', label: 'Clean Revisions', description: 'Delete old post revisions', keywords: [ 'revision' ], execute: jest.fn() },
	{ id: 'wp-agentic-admin/site-health', label: 'Site Health', description: 'Run site health check', keywords: [ 'health' ], execute: jest.fn() },
	{ id: 'wp-agentic-admin/error-log-read', label: 'Read Error Log', description: 'Read PHP error log', keywords: [ 'error' ], execute: jest.fn() },
	{ id: 'core/get-site-info', label: 'Site Info', description: 'Get site name, URL, version', keywords: [ 'site' ], execute: jest.fn() },
	{ id: 'core/get-environment-info', label: 'Environment Info', description: 'Get environment type', keywords: [ 'environment' ], execute: jest.fn() },
	{ id: 'wp-agentic-admin/rewrite-list', label: 'List Rewrites', description: 'List rewrite rules', keywords: [ 'rewrite' ], execute: jest.fn() },
	{ id: 'wp-agentic-admin/rewrite-flush', label: 'Flush Rewrites', description: 'Regenerate rewrite rules', keywords: [ 'permalink' ], execute: jest.fn() },
	{ id: 'wp-agentic-admin/cron-list', label: 'List Cron', description: 'List scheduled cron events', keywords: [ 'cron' ], execute: jest.fn() },
];

function makeAgent() {
	const toolRegistry = new ToolRegistry();
	MOCK_TOOLS.forEach( ( t ) => toolRegistry.register( t ) );

	return new ReactAgent(
		{ getEngine: jest.fn() },
		toolRegistry,
		{},
		instructionRegistry
	);
}

function printPrompt( label, prompt ) {
	// Use process.stdout to bypass @wordpress/jest-console
	process.stdout.write( `\n=== ${ label } ===\n\n${ prompt }\n\n=== END ===\n\n` );
}

beforeAll( () => {
	instructionRegistry.clear();
	registerAllInstructions();
} );

afterAll( () => {
	instructionRegistry.clear();
} );

describe( 'Print System Prompt', () => {
	it( 'no instructions active', () => {
		const agent = makeAgent();
		const prompt = agent.buildSystemPromptPromptBased();

		printPrompt( 'NO INSTRUCTIONS ACTIVE', prompt );

		expect( prompt ).toContain( 'AVAILABLE INSTRUCTIONS' );
	} );

	it( 'with "diagnostics" pre-loaded', () => {
		const agent = makeAgent();
		agent.activeInstructions.add( 'diagnostics' );

		const prompt = agent.buildSystemPromptPromptBased();

		printPrompt( 'DIAGNOSTICS ACTIVE', prompt );

		expect( prompt ).toContain( 'error-log-read' );
		expect( prompt ).toContain( 'Start with error-log-read' );
	} );

	it( 'with "plugins" + "database" pre-loaded', () => {
		const agent = makeAgent();
		agent.activeInstructions.add( 'plugins' );
		agent.activeInstructions.add( 'database' );

		const prompt = agent.buildSystemPromptPromptBased();

		printPrompt( 'PLUGINS + DATABASE ACTIVE', prompt );

		expect( prompt ).toContain( 'plugin-list' );
		expect( prompt ).toContain( 'revision-cleanup' );
		expect( prompt ).toContain(
			'Run revision-cleanup before db-optimize'
		);
	} );
} );
