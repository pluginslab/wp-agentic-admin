/**
 * Message Router Tests
 *
 * Tests the 3-tier routing logic:
 * 1. Workflow mode (keyword-based detection)
 * 2. ReAct mode (tool keyword + action intent, with/without thinking)
 * 3. Conversational mode (no tool relevance or pure knowledge questions)
 */

import { route, isWorkflowQuery } from '../message-router';
import workflowRegistry from '../workflow-registry';
import toolRegistry from '../tool-registry'; // eslint-disable-line no-unused-vars -- Required for jest.mock() to resolve.
import instructionRegistry from '../instruction-registry'; // eslint-disable-line no-unused-vars -- Required for jest.mock() to resolve.

// Mock workflow registry
jest.mock( '../workflow-registry', () => ( {
	detectWorkflow: jest.fn(),
} ) );

// Mock instruction registry
jest.mock( '../instruction-registry', () => ( {
	detectInstructions: jest.fn( ( message ) => {
		const matches = [];
		if (
			message.includes( 'plugin' ) ||
			message.includes( 'extensions' )
		) {
			matches.push( 'plugins' );
		}
		if ( message.includes( 'cache' ) || message.includes( 'transient' ) ) {
			matches.push( 'cache' );
		}
		if (
			message.includes( 'health' ) ||
			message.includes( 'error' ) ||
			message.includes( 'log' ) ||
			message.includes( 'slow' )
		) {
			matches.push( 'diagnostics' );
		}
		if ( message.includes( 'rewrite' ) ) {
			matches.push( 'routing' );
		}
		if (
			message.includes( 'database' ) ||
			message.includes( 'db' ) ||
			message.includes( 'optimize' )
		) {
			matches.push( 'database' );
		}
		return matches;
	} ),
} ) );

// Mock tool registry with representative keywords
jest.mock( '../tool-registry', () => ( {
	getAll: jest.fn( () => [
		{
			id: 'wp-agentic-admin/plugin-list',
			keywords: [ 'plugin', 'plugins', 'installed', 'extensions' ],
		},
		{
			id: 'wp-agentic-admin/error-log-read',
			keywords: [
				'error',
				'errors',
				'log',
				'logs',
				'broken',
				'white screen',
				'crash',
				'not working',
				'debug',
			],
		},
		{
			id: 'wp-agentic-admin/site-health',
			keywords: [
				'health',
				'version',
				'php',
				'info',
				'status',
				'server',
				'memory',
			],
		},
		{
			id: 'wp-agentic-admin/cache-flush',
			keywords: [ 'cache', 'flush', 'clear', 'purge' ],
		},
		{
			id: 'wp-agentic-admin/db-optimize',
			keywords: [
				'database',
				'db',
				'optimize',
				'slow',
				'performance',
				'speed',
			],
		},
		{
			id: 'wp-agentic-admin/transient-flush',
			keywords: [ 'transient', 'transients' ],
		},
		{
			id: 'wp-agentic-admin/rewrite-list',
			keywords: [ 'rewrite', 'rewrite rules' ],
		},
	] ),
} ) );

// Mock logger to suppress console output
jest.mock( '../../utils/logger', () => ( {
	createLogger: () => ( {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	} ),
} ) );

describe( 'MessageRouter', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	describe( 'Workflow Routing (Priority 1)', () => {
		it( 'should route workflow keywords to workflow mode', () => {
			const mockWorkflow = {
				id: 'site-cleanup',
				label: 'Full Site Cleanup',
			};
			workflowRegistry.detectWorkflow.mockReturnValue( mockWorkflow );

			const result = route( 'full site cleanup' );

			expect( result.type ).toBe( 'workflow' );
			expect( result.workflow ).toBe( mockWorkflow );
			expect( workflowRegistry.detectWorkflow ).toHaveBeenCalledWith(
				'full site cleanup'
			);
		} );

		it( 'should use isWorkflowQuery utility', () => {
			workflowRegistry.detectWorkflow.mockReturnValue( { id: 'test' } );
			expect( isWorkflowQuery( 'full cleanup' ) ).toBe( true );

			workflowRegistry.detectWorkflow.mockReturnValue( null );
			expect( isWorkflowQuery( 'list plugins' ) ).toBe( false );
		} );
	} );

	describe( 'ReAct Routing — keyword + action (thinking disabled)', () => {
		beforeEach( () => {
			workflowRegistry.detectWorkflow.mockReturnValue( null );
		} );

		it( 'should route action + keyword to ReAct with thinking disabled', () => {
			const result = route( 'list plugins' );
			expect( result.type ).toBe( 'react' );
			expect( result.disableThinking ).toBe( true );
		} );

		it( 'should route clear action commands to ReAct without thinking', () => {
			expect( route( 'check site health' ).type ).toBe( 'react' );
			expect( route( 'check site health' ).disableThinking ).toBe( true );

			expect( route( 'flush cache' ).type ).toBe( 'react' );
			expect( route( 'flush cache' ).disableThinking ).toBe( true );

			expect( route( 'show error log' ).type ).toBe( 'react' );
			expect( route( 'show error log' ).disableThinking ).toBe( true );

			expect( route( 'clear the cache' ).type ).toBe( 'react' );
			expect( route( 'optimize the database' ).type ).toBe( 'react' );
		} );
	} );

	describe( 'ReAct Routing — keyword but ambiguous (thinking enabled)', () => {
		beforeEach( () => {
			workflowRegistry.detectWorkflow.mockReturnValue( null );
		} );

		it( 'should route ambiguous keyword-only messages to ReAct with thinking', () => {
			// "my site is slow" has keyword "slow" but no action word
			const result = route( 'my site is slow' );
			expect( result.type ).toBe( 'react' );
			expect( result.disableThinking ).toBe( false );
		} );

		it( 'should route symptom descriptions to ReAct with thinking', () => {
			expect( route( 'something is broken' ).type ).toBe( 'react' );
			expect( route( 'something is broken' ).disableThinking ).toBe(
				false
			);

			expect( route( "I'm getting a white screen" ).type ).toBe(
				'react'
			);
			expect(
				route( "I'm getting a white screen" ).disableThinking
			).toBe( false );
		} );
	} );

	describe( 'Conversational Routing — knowledge questions', () => {
		beforeEach( () => {
			workflowRegistry.detectWorkflow.mockReturnValue( null );
		} );

		it( 'should route knowledge questions about tool topics to conversational', () => {
			// Has keyword "transient" but is a knowledge question
			expect( route( 'what is a transient?' ).type ).toBe(
				'conversational'
			);
			expect( route( 'explain what transients are' ).type ).toBe(
				'conversational'
			);
		} );

		it( 'should route pure questions with no tool relevance to conversational', () => {
			expect(
				route( 'explain the difference between posts and pages' ).type
			).toBe( 'conversational' );
			expect( route( 'what is WordPress?' ).type ).toBe(
				'conversational'
			);
			expect( route( 'tell me about hooks' ).type ).toBe(
				'conversational'
			);
		} );

		it( 'should route "how many" questions with keywords to ReAct', () => {
			// "how many plugins do I have?" — has keyword + implicit action
			// "how do" is a question word but "plugins" is a keyword without action word
			// This is ambiguous, so it gets ReAct with thinking
			const result = route( 'how many plugins do I have?' );
			expect( result.type ).toBe( 'react' );
			expect( result.disableThinking ).toBe( false );
		} );

		it( 'should route "how many rewrite rules" to ReAct', () => {
			const result = route( 'how many rewrite rules do I have?' );
			expect( result.type ).toBe( 'react' );
			expect( result.disableThinking ).toBe( false );
		} );
	} );

	describe( 'Edge Cases', () => {
		it( 'should handle null/undefined messages', () => {
			expect( route( null ).type ).toBe( 'react' );
			expect( route( undefined ).type ).toBe( 'react' );
			expect( route( '' ).type ).toBe( 'react' );
		} );

		it( 'should handle non-string messages', () => {
			expect( route( 123 ).type ).toBe( 'react' );
			expect( route( {} ).type ).toBe( 'react' );
		} );

		it( 'should route questions with workflow keywords to workflow', () => {
			const mockWorkflow = { id: 'plugin-audit', label: 'Plugin Audit' };
			workflowRegistry.detectWorkflow.mockReturnValue( mockWorkflow );

			expect( route( 'what is a plugin audit?' ).type ).toBe(
				'workflow'
			);
		} );
	} );

	describe( 'Instruction Preloading', () => {
		beforeEach( () => {
			workflowRegistry.detectWorkflow.mockReturnValue( null );
		} );

		it( 'should preload plugins instruction for "list plugins"', () => {
			const r = route( 'list plugins' );
			expect( r.preloadInstructions ).toContain( 'plugins' );
		} );

		it( 'should preload multiple instructions for "flush cache and list plugins"', () => {
			const r = route( 'flush cache and list plugins' );
			expect( r.preloadInstructions ).toContain( 'plugins' );
			expect( r.preloadInstructions ).toContain( 'cache' );
		} );

		it( 'should preload diagnostics for "my site is slow"', () => {
			const r = route( 'my site is slow' );
			expect( r.preloadInstructions ).toContain( 'diagnostics' );
		} );

		it( 'should not include preloadInstructions on conversational route', () => {
			const r = route( 'hello' );
			expect( r.type ).toBe( 'conversational' );
			expect( r.preloadInstructions ).toBeUndefined();
		} );
	} );

	describe( 'Real-World Test Cases', () => {
		beforeEach( () => {
			workflowRegistry.detectWorkflow.mockReturnValue( null );
		} );

		it( '"list plugins" → ReAct (no thinking)', () => {
			const r = route( 'list plugins' );
			expect( r.type ).toBe( 'react' );
			expect( r.disableThinking ).toBe( true );
		} );

		it( '"show error log" → ReAct (no thinking)', () => {
			const r = route( 'show error log' );
			expect( r.type ).toBe( 'react' );
			expect( r.disableThinking ).toBe( true );
		} );

		it( '"check site health" → ReAct (no thinking)', () => {
			const r = route( 'check site health' );
			expect( r.type ).toBe( 'react' );
			expect( r.disableThinking ).toBe( true );
		} );

		it( '"flush cache" → ReAct (no thinking)', () => {
			const r = route( 'flush cache' );
			expect( r.type ).toBe( 'react' );
			expect( r.disableThinking ).toBe( true );
		} );

		it( '"my site is slow" → ReAct (with thinking)', () => {
			const r = route( 'my site is slow' );
			expect( r.type ).toBe( 'react' );
			expect( r.disableThinking ).toBe( false );
		} );

		it( '"something is broken" → ReAct (with thinking)', () => {
			const r = route( 'something is broken' );
			expect( r.type ).toBe( 'react' );
			expect( r.disableThinking ).toBe( false );
		} );

		it( '"I\'m getting a white screen" → ReAct (with thinking)', () => {
			const r = route( "I'm getting a white screen" );
			expect( r.type ).toBe( 'react' );
			expect( r.disableThinking ).toBe( false );
		} );

		it( '"what is a transient?" → conversational', () => {
			expect( route( 'what is a transient?' ).type ).toBe(
				'conversational'
			);
		} );

		it( '"why is my site so slow?" → ReAct (with thinking)', () => {
			// "slow" is a keyword, "why is" isn't in QUESTION_WORDS that trigger conversational
			const r = route( 'why is my site so slow?' );
			expect( r.type ).toBe( 'react' );
			expect( r.disableThinking ).toBe( false );
		} );

		it( '"full site cleanup" → Workflow', () => {
			const mockWorkflow = { id: 'site-cleanup' };
			workflowRegistry.detectWorkflow.mockReturnValue( mockWorkflow );
			expect( route( 'full site cleanup' ).type ).toBe( 'workflow' );
		} );

		it( '"check my site and optimize if needed" → ReAct (no thinking)', () => {
			// Has keyword "optimize" + action word "check"
			const r = route( 'check my site and optimize if needed' );
			expect( r.type ).toBe( 'react' );
			expect( r.disableThinking ).toBe( true );
		} );

		it( '"hello" → conversational', () => {
			expect( route( 'hello' ).type ).toBe( 'conversational' );
		} );

		it( '"thank you" → conversational', () => {
			expect( route( 'thank you' ).type ).toBe( 'conversational' );
		} );
	} );
} );
