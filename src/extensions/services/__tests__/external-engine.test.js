/**
 * External Engine Tests
 */

import { ExternalEngine } from '../external-engine';

// Mock logger
jest.mock( '../../utils/logger', () => ( {
	createLogger: () => ( {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	} ),
} ) );

describe( 'ExternalEngine', () => {
	let engine;
	const endpointUrl = 'https://api.openai.com';
	const modelId = 'o1-mini';
	const apiKey = 'test-key';

	beforeEach( () => {
		jest.clearAllMocks();

		// Mock window.wpAgenticAdmin
		global.window = {
			wpAgenticAdmin: {
				restUrl: 'https://example.com/wp-json/wp-abilities/v1',
				nonce: 'test-nonce',
			},
		};

		// Mock fetch
		global.fetch = jest.fn( () =>
			Promise.resolve( {
				ok: true,
				json: () => Promise.resolve( { choices: [] } ),
			} )
		);

		engine = new ExternalEngine( endpointUrl, modelId, apiKey );
	} );

	it( 'should map max_tokens to max_completion_tokens and delete unsupported params for o1-mini', async () => {
		await engine.chat.completions.create( {
			messages: [ { role: 'user', content: 'hello' } ],
			max_tokens: 100,
			stop: [ 'User:' ],
			temperature: 0.5,
		} );

		const fetchCall = global.fetch.mock.calls[ 0 ];
		const body = JSON.parse( fetchCall[ 1 ].body );

		expect( body.max_completion_tokens ).toBe( 100 );
		expect( body.max_tokens ).toBeUndefined();
		expect( body.temperature ).toBeUndefined();
		expect( body.stop ).toBeUndefined();
	} );

	it( 'should use max_tokens and temperature for non-o1 models', async () => {
		const gptEngine = new ExternalEngine( endpointUrl, 'gpt-4o', apiKey );
		await gptEngine.chat.completions.create( {
			messages: [ { role: 'user', content: 'hello' } ],
			max_tokens: 100,
			temperature: 0.7,
		} );

		const fetchCall = global.fetch.mock.calls[ 0 ];
		const body = JSON.parse( fetchCall[ 1 ].body );

		expect( body.max_tokens ).toBe( 100 );
		expect( body.temperature ).toBe( 0.7 );
		expect( body.max_completion_tokens ).toBeUndefined();
	} );

	it( 'should handle gpt-5 models correctly', async () => {
		const gpt5Engine = new ExternalEngine(
			endpointUrl,
			'gpt-5.1-preview',
			apiKey
		);
		await gpt5Engine.chat.completions.create( {
			messages: [ { role: 'user', content: 'hello' } ],
			max_tokens: 200,
		} );

		const fetchCall = global.fetch.mock.calls[ 0 ];
		const body = JSON.parse( fetchCall[ 1 ].body );

		expect( body.max_completion_tokens ).toBe( 200 );
		expect( body.max_tokens ).toBeUndefined();
	} );
} );
