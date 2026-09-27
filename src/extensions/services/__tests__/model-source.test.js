/**
 * Model Source Tests
 *
 * The local engine must only download from the owner-configured source,
 * and the built bundle must not contain WebLLM's default addresses.
 */

import fs from 'fs';
import path from 'path';
import {
	MODEL_RECORDS,
	buildAppConfig,
	getModelSource,
	isModelSourceConfigured,
	setModelSource,
} from '../model-source';

const stripWebllmPrebuilt = require( '../../../../tools/strip-webllm-prebuilt-loader' );

describe( 'model-source', () => {
	beforeEach( () => {
		setModelSource( { weights_url: '', library_url: '' } );
	} );

	it( 'is not configured until both addresses are set', () => {
		expect( isModelSourceConfigured() ).toBe( false );
		setModelSource( {
			weights_url: 'https://models.example/w',
			library_url: '',
		} );
		expect( isModelSourceConfigured() ).toBe( false );
		setModelSource( {
			weights_url: 'https://models.example/w',
			library_url: 'https://models.example/lib',
		} );
		expect( isModelSourceConfigured() ).toBe( true );
	} );

	it( 'normalizes addresses to end with a slash', () => {
		setModelSource( {
			weights_url: ' https://models.example/w ',
			library_url: 'https://models.example/lib/',
		} );
		expect( getModelSource() ).toEqual( {
			weights_url: 'https://models.example/w/',
			library_url: 'https://models.example/lib/',
		} );
	} );

	it( 'builds every model URL from the configured source only', () => {
		setModelSource( {
			weights_url: 'https://models.example/w/',
			library_url: 'https://models.example/lib/',
		} );
		const config = buildAppConfig();

		expect( config.model_list ).toHaveLength( MODEL_RECORDS.length );
		for ( const record of config.model_list ) {
			expect( record.model ).toBe(
				`https://models.example/w/${ record.model_id }`
			);
			expect(
				record.model_lib.startsWith( 'https://models.example/lib/' )
			).toBe( true );
		}
	} );

	it( 'covers every model the loader offers', () => {
		const ids = MODEL_RECORDS.map( ( r ) => r.id );
		expect( ids ).toEqual(
			expect.arrayContaining( [
				'Qwen3-1.7B-q4f16_1-MLC',
				'Qwen3-1.7B-q4f32_1-MLC',
				'Qwen2.5-7B-Instruct-q4f16_1-MLC',
				'Qwen2.5-7B-Instruct-q4f32_1-MLC',
			] )
		);
	} );
} );

describe( 'strip-webllm-prebuilt-loader', () => {
	const webllmPath = path.resolve(
		__dirname,
		'../../../../node_modules/@mlc-ai/web-llm/lib/index.js'
	);

	it( 'removes every model download address from WebLLM', () => {
		const out = stripWebllmPrebuilt(
			fs.readFileSync( webllmPath, 'utf8' )
		);
		expect( out ).toContain( 'const modelLibURLPrefix = "";' );
		expect( out ).toMatch( /model_list: \[\]/ );
		expect( out ).not.toMatch(
			/["'`]https:\/\/(huggingface\.co|raw\.githubusercontent\.com)/
		);
	} );

	it( 'fails loudly when WebLLM changes shape', () => {
		expect( () => stripWebllmPrebuilt( 'const x = 1;' ) ).toThrow(
			/modelLibURLPrefix not found/
		);
	} );
} );
