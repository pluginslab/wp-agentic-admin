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
	const restBase = ( wpData.restUrl || '/wp-json/wp-abilities/v1' ).replace(
		/wp-abilities\/v1\/?$/,
		''
	);
	return {
		proxyBase: `${ restBase }wp-agentic-admin/v1/connectors`,
		nonce: wpData.nonce || '',
	};
}

/**
 * Wraps a non-streaming completion response as an async iterable of one
 * chunk, so callers that requested stream:true don't need a separate
 * code path.
 */
async function* singleChunkIterable( completion ) {
	const message = completion?.choices?.[ 0 ]?.message;
	const content = message?.content || '';
	yield {
		choices: [
			{
				index: 0,
				delta: { role: 'assistant', content },
				finish_reason: completion?.choices?.[ 0 ]?.finish_reason || 'stop',
			},
		],
	};
}

class ConnectorEngine {
	/**
	 * @param {string} connectorId - WP connector ID (e.g. "anthropic")
	 */
	constructor( connectorId ) {
		this.connectorId = connectorId;

		this.chat = {
			completions: {
				create: ( params ) => this._createCompletion( params ),
			},
		};
	}

	async _createCompletion( params ) {
		const { proxyBase, nonce } = getProxyConfig();
		const url = `${ proxyBase }/chat/completions`;

		const body = {
			connector_id: this.connectorId,
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
