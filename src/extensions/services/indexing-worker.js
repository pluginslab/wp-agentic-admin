/**
 * Indexing Worker
 *
 * Runs Transformers.js embedding inside a Web Worker to avoid blocking
 * the main thread during knowledge base builds. Only handles the slow
 * part (neural network inference); the main thread builds the Voy index
 * and persists to IndexedDB.
 *
 * Message protocol:
 *   In:  { type: 'embed', chunks: Array<{path, start_line, end_line, content, type}> }
 *   Out: { type: 'progress', done: number, total: number, message: string }
 *        { type: 'complete', embeddings: Array, chunkMetadata: Array }
 *        { type: 'error', message: string }
 *
 * @since 0.14.0
 */

/* eslint-disable no-console */

// Pinned to a specific patch version so a compromised CDN range can't silently
// ship new code to every user. Bump deliberately when upgrading.
const TRANSFORMERS_CDN =
	'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const BATCH_SIZE = 10;

/** @type {Function|null} Cached embedding pipeline. */
let embeddingPipeline = null;

/**
 * Load the Transformers.js embedding pipeline from CDN.
 *
 * @return {Promise<void>}
 */
async function loadPipeline() {
	if ( embeddingPipeline ) {
		return;
	}

	console.log( '[indexing-worker] Loading Transformers.js from CDN...' );

	const transformers = await import(
		/* webpackIgnore: true */ TRANSFORMERS_CDN
	);

	console.log( '[indexing-worker] Loading embedding model...' );

	embeddingPipeline = await transformers.pipeline(
		'feature-extraction',
		MODEL_NAME,
		{
			device: 'wasm',
			progress_callback: ( progress ) => {
				if ( progress.status === 'download' && progress.total ) {
					const pct = Math.round(
						( progress.loaded / progress.total ) * 100
					);
					self.postMessage( {
						type: 'progress',
						done: 0,
						total: 0,
						message: `Downloading model: ${ pct }% (${ progress.file })`,
					} );
				}
			},
		}
	);

	console.log( '[indexing-worker] Embedding pipeline ready (WASM).' );
}

/**
 * Embed a text string into a vector.
 *
 * @param {string} text Text to embed.
 * @return {Promise<number[]>} Embedding vector.
 */
async function embed( text ) {
	const truncated = text.slice( 0, 2000 );
	const output = await embeddingPipeline( truncated, {
		pooling: 'mean',
		normalize: true,
	} );
	return Array.from( output.data );
}

/**
 * Handle incoming messages from the main thread.
 */
self.addEventListener( 'message', async ( event ) => {
	const { type, chunks } = event.data;

	if ( type !== 'embed' ) {
		return;
	}

	try {
		self.postMessage( {
			type: 'progress',
			done: 0,
			total: chunks.length,
			message: `Loading embedding model (first run downloads ~23MB)...`,
		} );

		await loadPipeline();

		const embeddings = [];
		const chunkMetadata = [];
		let done = 0;

		for ( let i = 0; i < chunks.length; i += BATCH_SIZE ) {
			const batch = chunks.slice( i, i + BATCH_SIZE );

			for ( const chunk of batch ) {
				try {
					const searchText = `${ chunk.path }:${ chunk.start_line }-${ chunk.end_line }\n${ chunk.content }`;
					const embedding = await embed( searchText );
					const id = String( embeddings.length );

					embeddings.push( {
						id,
						title: `${ chunk.path }:${ chunk.start_line }`,
						url: chunk.path,
						embeddings: embedding,
					} );

					chunkMetadata.push( {
						id,
						path: chunk.path,
						start_line: chunk.start_line,
						end_line: chunk.end_line,
						content: chunk.content,
						type: chunk.type,
					} );

					done++;
				} catch ( err ) {
					console.warn(
						`[indexing-worker] Failed to embed chunk ${ chunk.path }:${ chunk.start_line }:`,
						err.message
					);
				}
			}

			self.postMessage( {
				type: 'progress',
				done,
				total: chunks.length,
				message: `Embedding chunks: ${ done }/${ chunks.length }...`,
			} );
		}

		console.log( `[indexing-worker] Done. Embedded ${ done } chunks.` );

		self.postMessage( {
			type: 'complete',
			embeddings,
			chunkMetadata,
		} );
	} catch ( err ) {
		console.error( '[indexing-worker] Fatal error:', err );
		self.postMessage( {
			type: 'error',
			message: err.message,
		} );
	}
} );
