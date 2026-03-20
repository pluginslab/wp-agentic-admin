/**
 * Utility test to print the current system prompt to the terminal.
 *
 * Run with: npm test -- --testPathPattern=print-system-prompt --silent=false
 */

import { ReactAgent } from '../react-agent';

jest.mock( '../../utils/logger', () => ( {
	createLogger: () => ( {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	} ),
} ) );

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

describe( 'Print System Prompt', () => {
	it( 'prints the current system prompt', () => {
		const mockToolRegistry = {
			getAll: jest.fn( () => MOCK_TOOLS ),
			get: jest.fn( ( id ) => MOCK_TOOLS.find( ( t ) => t.id === id ) ),
		};

		const agent = new ReactAgent(
			{ getEngine: jest.fn() },
			mockToolRegistry
		);

		const prompt = agent.buildSystemPromptPromptBased();
		process.stdout.write( `\n=== SYSTEM PROMPT ===\n\n${ prompt }\n\n=== END ===\n\n` );

		expect( prompt ).toContain( 'TOOLS:' );
		expect( prompt ).toContain( 'FORMAT' );
		expect( prompt ).toContain( 'RULES:' );
	} );
} );
