/**
 * Connector Engine — WP 7.0 AI Client connector wrapper (via WP REST proxy).
 *
 * Posts chat completions to /wp-agentic-admin/v1/connectors/chat/completions,
 * which forwards them through the WP AI Client to a configured connector's
 * provider (Anthropic, Google, OpenAI, or any third-party ai_provider).
 *
 * Exposes the same engine.chat.completions.create() interface that WebLLM /
 * ExternalEngine use, so consumers don't need to know which provider is
 * active.
 *
 * LIMITATIONS (matches server-side notes):
 *   - Non-streaming. AI Client doesn't natively stream; we surface the
 *     full response as a single chunk if the caller requested stream: true.
 *   - Tool/function calling is not yet supported through this path.
 *   - Lossy prompt flattening on the server side ("Role: content" strings).
 */

import { createLogger } from '../utils/logger';

const log = createLogger( 'ConnectorEngine' );

function getProxyConfig() {
	const wpData = window.wpAgenticAdmin || {};
	// Prefer an explicit connectors REST URL when the server provides one.
	// Otherwise derive from connectorsRestUrl namespace pieces, then fall
	// back to deriving from restUrl by trimming any trailing /<ns>/v1 segment.
	if ( wpData.connectorsRestUrl ) {
		return {
			proxyBase: wpData.connectorsRestUrl.replace( /\/$/, '' ),
			nonce: wpData.nonce || '',
		};
	}

	const root =
		wpData.restRoot ||
		( wpData.restUrl || '/wp-json/wp-abilities/v1' ).replace(
			/\/?[^/]+\/v\d+\/?$/,
			''
		);
	const base = root.endsWith( '/' ) ? root : `${ root }/`;
	return {
		proxyBase: `${ base }wp-agentic-admin/v1/connectors`,
		nonce: wpData.nonce || '',
	};
}

/**
 * Wraps a non-streaming completion response as an async iterable of one
 * chunk, so callers that requested stream:true don't need a separate
 * code path.
 *
 * @param {Object} completion - OpenAI-shaped non-streaming chat completion.
 */
async function* singleChunkIterable( completion ) {
	const message = completion?.choices?.[ 0 ]?.message;
	const content = message?.content || '';
	yield {
		choices: [
			{
				index: 0,
				delta: { role: 'assistant', content },
				finish_reason:
					completion?.choices?.[ 0 ]?.finish_reason || 'stop',
			},
		],
	};
}

class ConnectorEngine {
	/**
	 * @param {string} connectorId - WP connector ID (e.g. "anthropic")
	 * @param {string} modelId     - Optional connector-specific model ID
	 */
	constructor( connectorId, modelId = '' ) {
		this.connectorId = connectorId;
		this.modelId = modelId;

		this.chat = {
			completions: {
				create: ( params ) => this._createCompletion( params ),
			},
		};
	}

	async _createCompletion( params ) {
		// Tool calling is not yet supported through the connector path.
		// Surface a single warning per session so ReAct callers don't
		// silently lose function-calling behaviour.
		if ( params.tools && params.tools.length && ! this._warnedNoTools ) {
			this._warnedNoTools = true;
			log.warn(
				`Connector engine received ${ params.tools.length } tool(s) but tool calling is not yet supported via WP AI Client connectors. Tools will be ignored for this and subsequent requests in this session. See issue tracker for status.`
			);
		}

		const { proxyBase, nonce } = getProxyConfig();
		const url = `${ proxyBase }/chat/completions`;

		const body = {
			connector_id: this.connectorId,
			model_id: this.modelId,
			messages: params.messages || [],
		};

		log.debug( 'Connector completion request:', {
			connectorId: this.connectorId,
			messageCount: body.messages.length,
		} );

		const response = await fetch( url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce,
			},
			body: JSON.stringify( body ),
			signal: params.signal,
		} );

		if ( ! response.ok ) {
			const errorText = await response.text().catch( () => '' );
			throw new Error(
				`Connector error ${ response.status }: ${ errorText }`
			);
		}

		const completion = await response.json();

		if ( params.stream ) {
			return singleChunkIterable( completion );
		}
		return completion;
	}

	async unload() {
		log.info( 'Connector engine unloaded (no-op)' );
	}

	async resetChat() {
		log.info( 'Connector engine chat reset (no-op)' );
	}
}

export default ConnectorEngine;
