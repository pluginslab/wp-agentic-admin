/**
 * External Engine — OpenAI-compatible API wrapper (via WP REST proxy)
 *
 * Wraps fetch() calls through the WordPress REST API proxy endpoint to avoid
 * CORS issues when connecting to external LLM providers. The proxy is at:
 *   /wp-json/wp-agentic-admin/v1/llm-proxy/
 *
 * Exposes the same engine.chat.completions.create() interface that WebLLM uses,
 * so react-agent.js, chat-orchestrator.js, and workflow-orchestrator.js need
 * zero changes.
 *
 * @since 0.10.0
 */

import { createLogger } from '../utils/logger';

const log = createLogger( 'ExternalEngine' );

/**
 * Get the WP REST proxy base URL and nonce from wpAgenticAdmin globals.
 *
 * @return {Object} { proxyBase, nonce }
 */
function getProxyConfig() {
	const wpData = window.wpAgenticAdmin || {};
	// REST URL for abilities is like /wp-json/wp-abilities/v1
	// We need /wp-json/wp-agentic-admin/v1/llm-proxy
	const restBase = ( wpData.restUrl || '/wp-json/wp-abilities/v1' ).replace(
		/wp-abilities\/v1\/?$/,
		''
	);
	return {
		proxyBase: `${ restBase }wp-agentic-admin/v1/llm-proxy`,
		nonce: wpData.nonce || '',
	};
}

/**
 * Convert an SSE ReadableStream into an async iterable of parsed chunks.
 *
 * Yields objects matching the OpenAI ChatCompletionChunk shape:
 *   { choices: [{ delta: { content } }], usage? }
 *
 * @param {Response} response - fetch() Response with SSE body
 * @yield {Object} Parsed SSE chunk
 */
async function* sseToAsyncIterable( response ) {
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while ( true ) {
			const { done, value } = await reader.read();
			if ( done ) {
				break;
			}

			buffer += decoder.decode( value, { stream: true } );
			const lines = buffer.split( '\n' );
			// Keep the last (possibly incomplete) line in the buffer
			buffer = lines.pop() || '';

			for ( const line of lines ) {
				const trimmed = line.trim();
				if ( ! trimmed || ! trimmed.startsWith( 'data: ' ) ) {
					continue;
				}

				const data = trimmed.slice( 6 );
				if ( data === '[DONE]' ) {
					return;
				}

				try {
					yield JSON.parse( data );
				} catch ( e ) {
					log.debug( 'Failed to parse SSE chunk:', data );
				}
			}
		}

		// Process any remaining data in buffer
		if ( buffer.trim() ) {
			const trimmed = buffer.trim();
			if ( trimmed.startsWith( 'data: ' ) ) {
				const data = trimmed.slice( 6 );
				if ( data !== '[DONE]' ) {
					try {
						yield JSON.parse( data );
					} catch ( e ) {
						log.debug( 'Failed to parse final SSE chunk:', data );
					}
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}

/**
 * ExternalEngine class
 *
 * Mimics the WebLLM engine interface so consumers (react-agent, chat-orchestrator)
 * don't need any changes. Routes all requests through the WP REST proxy.
 *
 * @since 0.10.0
 */
class ExternalEngine {
	/**
	 * @param {string} endpointUrl - Base URL (e.g. "http://localhost:11434")
	 * @param {string} modelId     - Model identifier for the provider
	 * @param {string} apiKey      - Optional API key
	 */
	constructor( endpointUrl, modelId, apiKey = '' ) {
		this.endpointUrl = endpointUrl.replace( /\/+$/, '' );
		this.modelId = modelId;
		this.apiKey = apiKey;

		// Expose the same nested interface: engine.chat.completions.create()
		this.chat = {
			completions: {
				create: ( params ) => this._createCompletion( params ),
			},
		};
	}

	/**
	 * Create a chat completion via WP REST proxy — streaming or non-streaming.
	 *
	 * Returns an async iterable for streaming (matching WebLLM's interface),
	 * or a plain response object for non-streaming.
	 *
	 * @param {Object} params - OpenAI-compatible completion params
	 * @return {Promise<Object>} Stream (async iterable) or response object
	 */
	async _createCompletion( params ) {
		const { proxyBase, nonce } = getProxyConfig();
		const url = `${ proxyBase }/chat/completions`;
		const isStreaming = params.stream ?? false;

		const isModernModel =
			this.modelId.startsWith( 'o1-' ) ||
			this.modelId.startsWith( 'o3-' ) ||
			this.modelId.startsWith( 'gpt-5' ) ||
			this.modelId === 'o1';

		const body = {
			...params,
			endpoint_url: this.endpointUrl,
			api_key: this.apiKey,
			model: this.modelId,
		};

		// o1/o3/gpt-5 models require specific parameter mapping and don't support many standard params
		if ( isModernModel ) {
			if ( body.max_tokens ) {
				body.max_completion_tokens = body.max_tokens;
				delete body.max_tokens;
			}
			// These models don't support these parameters
			delete body.temperature;
			delete body.stop;
			delete body.top_p;
			delete body.presence_penalty;
			delete body.frequency_penalty;
			delete body.logit_bias;
		} else {
			// Ensure defaults for standard models if not provided
			if ( body.temperature === undefined ) {
				body.temperature = 0.3;
			}
			if ( body.max_tokens === undefined ) {
				body.max_tokens = 1024;
			}
		}

		log.debug( 'External completion request via proxy:', {
			url,
			model: this.modelId,
			stream: isStreaming,
			messageCount: params.messages.length,
			isModernModel,
		} );

		const response = await fetch( url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce,
			},
			body: JSON.stringify( body ),
		} );

		if ( ! response.ok ) {
			const errorText = await response.text().catch( () => '' );
			throw new Error(
				`External API error ${ response.status }: ${ errorText }`
			);
		}

		// Non-streaming: return parsed response directly
		if ( ! isStreaming ) {
			return response.json();
		}

		// Streaming: return async iterable matching WebLLM's format
		return sseToAsyncIterable( response );
	}

	/**
	 * Unload — no-op for external engines
	 */
	async unload() {
		log.info( 'External engine unloaded (no-op)' );
	}

	/**
	 * Reset chat — no-op for external engines
	 */
	async resetChat() {
		log.info( 'External engine chat reset (no-op)' );
	}

	/**
	 * Fetch available models from the provider via WP REST proxy
	 *
	 * @param {string} endpointUrl - Base URL
	 * @param {string} apiKey      - Optional API key
	 * @return {Promise<Array>} Array of { id, name } objects
	 */
	static async fetchModels( endpointUrl, apiKey = '' ) {
		const { proxyBase, nonce } = getProxyConfig();

		// Cleanup URL: remove potential double dots, extra slashes, and whitespace.
		const normalizedUrl = endpointUrl
			.trim()
			.replace( /\.+/g, '.' )
			.replace( /:\/+/g, '://' )
			.replace( /\/+$/, '' );

		const params = new URLSearchParams( {
			endpoint_url: normalizedUrl,
		} );
		if ( apiKey ) {
			params.set( 'api_key', apiKey );
		}

		const url = `${ proxyBase }/models?${ params.toString() }`;
		log.info( 'Fetching models via proxy:', url );

		const response = await fetch( url, {
			headers: {
				'X-WP-Nonce': nonce,
			},
		} );

		if ( ! response.ok ) {
			const errorText = await response.text().catch( () => '' );
			throw new Error(
				`Failed to fetch models: ${ response.status } ${ errorText }`
			);
		}

		const data = await response.json();
		const models = data.data || data.models || [];

		return models.map( ( m ) => ( {
			id: m.id || m.name || m.model,
			name: m.id || m.name || m.model,
		} ) );
	}
}

export { ExternalEngine, sseToAsyncIterable };
export default ExternalEngine;
