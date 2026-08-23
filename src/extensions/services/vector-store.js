/**
 * Vector Store Service
 *
 * In-browser RAG vector store using Transformers.js (CDN) + a plain-JS
 * similarity index + IndexedDB persistence. Embeds code chunks and enables
 * semantic search.
 *
 * - Transformers.js loaded lazily from CDN (~100MB, not bundled)
 * - Embeddings run on CPU (WASM) to avoid GPU contention with the LLM
 * - Vectors + chunk metadata persisted in IndexedDB
 *
 * Search is an exhaustive cosine scan. The embedding model emits L2-normalised
 * vectors (`normalize: true`), so cosine similarity is a plain dot product.
 * At 384 dimensions a few thousand chunks score in single-digit milliseconds,
 * which is well under the embedding cost of the query itself, so an ANN index
 * would buy nothing at this scale.
 */

import { createLogger } from '../utils/logger';

const log = createLogger( 'VectorStore' );

const TRANSFORMERS_CDN =
	'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const DB_NAME = 'wp-agentic-rag-db';
// v2 replaced the voy-search index store with plain Float32Array vectors.
const DB_VERSION = 2;
const STORE_INDEX = 'embedding-index';
const LEGACY_STORE_INDEX = 'voy-index';
const STORE_CHUNKS = 'chunk-metadata';
const BATCH_SIZE = 10;

/**
 * @type {import('@huggingface/transformers').Pipeline|null}
 */
let pipeline = null;

/**
 * Indexed vectors, positionally aligned with `chunkMetadata`.
 *
 * @type {Float32Array[]}
 */
let vectors = [];

/**
 * @type {Array<Object>}
 */
let chunkMetadata = [];

/**
 * @type {boolean}
 */
let initialized = false;

/**
 * @type {boolean}
 */
let initializing = false;

/**
 * Open the IndexedDB database.
 *
 * @return {Promise<IDBDatabase>} The database instance.
 */
function openDB() {
	return new Promise( ( resolve, reject ) => {
		const request = indexedDB.open( DB_NAME, DB_VERSION );

		request.onupgradeneeded = ( event ) => {
			const db = event.target.result;
			if ( ! db.objectStoreNames.contains( STORE_INDEX ) ) {
				db.createObjectStore( STORE_INDEX );
			}
			if ( ! db.objectStoreNames.contains( STORE_CHUNKS ) ) {
				db.createObjectStore( STORE_CHUNKS );
			}
			// Drop the old voy-search index; its serialised format is not
			// readable here. Affected users re-index from the settings screen.
			if ( db.objectStoreNames.contains( LEGACY_STORE_INDEX ) ) {
				db.deleteObjectStore( LEGACY_STORE_INDEX );
			}
		};

		request.onsuccess = () => resolve( request.result );
		request.onerror = () => reject( request.error );
	} );
}

/**
 * Get a value from IndexedDB.
 *
 * @param {string} storeName Object store name.
 * @param {string} key       Key to retrieve.
 * @return {Promise<any>} The stored value.
 */
async function dbGet( storeName, key ) {
	const db = await openDB();
	return new Promise( ( resolve, reject ) => {
		const tx = db.transaction( storeName, 'readonly' );
		const store = tx.objectStore( storeName );
		const request = store.get( key );
		request.onsuccess = () => resolve( request.result );
		request.onerror = () => reject( request.error );
	} );
}

/**
 * Put a value into IndexedDB.
 *
 * @param {string} storeName Object store name.
 * @param {string} key       Key to store under.
 * @param {any}    value     Value to store.
 * @return {Promise<void>}
 */
async function dbPut( storeName, key, value ) {
	const db = await openDB();
	return new Promise( ( resolve, reject ) => {
		const tx = db.transaction( storeName, 'readwrite' );
		const store = tx.objectStore( storeName );
		const request = store.put( value, key );
		request.onsuccess = () => resolve();
		request.onerror = () => reject( request.error );
	} );
}

/**
 * Load the embedding pipeline from Transformers.js (CDN).
 *
 * @return {Promise<void>}
 */
async function loadPipeline() {
	if ( pipeline ) {
		return;
	}

	log.info( 'Loading Transformers.js from CDN...' );

	let transformers;
	try {
		transformers = await import(
			/* webpackIgnore: true */ TRANSFORMERS_CDN
		);
	} catch ( err ) {
		throw new Error(
			`Failed to load Transformers.js from CDN: ${ err.message }. Check your internet connection.`
		);
	}

	log.info(
		'Transformers.js loaded. Downloading embedding model (first run ~23MB, cached after)...'
	);

	try {
		pipeline = await transformers.pipeline(
			'feature-extraction',
			MODEL_NAME,
			{
				device: 'wasm',
				progress_callback: ( progress ) => {
					if ( progress.status === 'download' && progress.total ) {
						const pct = Math.round(
							( progress.loaded / progress.total ) * 100
						);
						log.info(
							`Downloading model: ${ pct }% (${ progress.file })`
						);
					} else if ( progress.status === 'ready' ) {
						log.info( 'Model files ready.' );
					}
				},
			}
		);
	} catch ( err ) {
		throw new Error(
			`Failed to load embedding model "${ MODEL_NAME }": ${ err.message }`
		);
	}

	log.info( 'Embedding pipeline ready (CPU/WASM).' );
}

/**
 * Convert worker/index embedding entries into the internal vector array.
 *
 * Entries use the `{ id, title, url, embeddings }` shape produced by
 * `indexing-worker.js`; only the vector itself is retained, positionally.
 *
 * @param {Object[]} entries Embedding entries.
 * @return {Float32Array[]} Vectors.
 */
function toVectors( entries ) {
	return entries.map( ( entry ) => Float32Array.from( entry.embeddings ) );
}

/**
 * Restore the index and chunk metadata from IndexedDB.
 *
 * Vectors and metadata are positionally aligned, so a length mismatch (a
 * partial write, or the v1 → v2 upgrade dropping the old voy index) resets
 * both rather than serving results against the wrong metadata.
 *
 * @return {Promise<void>}
 */
async function loadIndex() {
	if ( vectors.length ) {
		return;
	}

	try {
		const savedVectors = await dbGet( STORE_INDEX, 'current' );
		const savedChunks = await dbGet( STORE_CHUNKS, 'current' );

		if (
			Array.isArray( savedVectors ) &&
			Array.isArray( savedChunks ) &&
			savedVectors.length === savedChunks.length &&
			savedVectors.length > 0
		) {
			vectors = savedVectors.map( ( v ) => Float32Array.from( v ) );
			chunkMetadata = savedChunks;
			log.info(
				`Restored index from IndexedDB (${ chunkMetadata.length } chunks).`
			);
			return;
		}

		if ( savedVectors || savedChunks ) {
			log.warn(
				'Persisted index is incomplete or from an older format; starting empty. Re-index to rebuild.'
			);
		}
	} catch ( err ) {
		log.warn( 'Could not restore index from IndexedDB:', err.message );
	}

	vectors = [];
	chunkMetadata = [];
	log.info( 'Created new empty index.' );
}

/**
 * Initialize the vector store.
 * Restores any persisted index, defers Transformers.js until needed.
 *
 * @return {Promise<void>}
 */
async function init() {
	if ( initialized || initializing ) {
		return;
	}

	initializing = true;

	try {
		await loadIndex();
		initialized = true;
		log.info( 'Vector store initialized.' );
	} catch ( err ) {
		log.error( 'Vector store init failed:', err.message );
		throw err;
	} finally {
		initializing = false;
	}
}

/**
 * Embed a text string into a vector.
 *
 * @param {string} text Text to embed.
 * @return {Promise<number[]>} Embedding vector.
 */
async function embed( text ) {
	await loadPipeline();

	// Truncate to ~512 tokens worth of text (~2000 chars).
	const truncated = text.slice( 0, 2000 );

	const output = await pipeline( truncated, {
		pooling: 'mean',
		normalize: true,
	} );

	return Array.from( output.data );
}

/**
 * Persist the current vectors and chunk metadata to IndexedDB.
 *
 * Float32Array survives the structured clone algorithm, so the vectors are
 * stored as-is rather than being stringified.
 *
 * @return {Promise<void>}
 */
async function persist() {
	try {
		await dbPut( STORE_INDEX, 'current', vectors );
		await dbPut( STORE_CHUNKS, 'current', chunkMetadata );
		log.debug( `Persisted index (${ chunkMetadata.length } chunks).` );
	} catch ( err ) {
		log.warn( 'Failed to persist index:', err.message );
	}
}

/**
 * Index an array of code chunks.
 * Embeds in batches and rebuilds the index.
 *
 * @param {Object[]} chunks       Array of { path, start_line, end_line, content, type }.
 * @param {Function} [onProgress] Optional callback: (indexed, total) => void.
 * @return {Promise<number>} Number of chunks indexed.
 */
async function index( chunks, onProgress ) {
	if ( ! initialized ) {
		await init();
	}

	// Ensure pipeline is loaded for embedding.
	await loadPipeline();

	// Reset index with fresh data. chunkMetadata is rebuilt alongside
	// `embeddings` and must be cleared with it, or a second index() run leaves
	// the two positionally misaligned and search returns the wrong chunks.
	const embeddings = [];
	chunkMetadata = [];
	let indexed = 0;

	for ( let i = 0; i < chunks.length; i += BATCH_SIZE ) {
		const batch = chunks.slice( i, i + BATCH_SIZE );

		for ( const chunk of batch ) {
			try {
				// Build searchable text: path + content.
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

				indexed++;
			} catch ( err ) {
				log.warn(
					`Failed to embed chunk ${ chunk.path }:${ chunk.start_line }:`,
					err.message
				);
			}
		}

		log.info( `Embedded ${ indexed }/${ chunks.length } chunks...` );

		if ( onProgress ) {
			onProgress( indexed, chunks.length );
		}
	}

	// Build the new index from all embeddings.
	vectors = toVectors( embeddings );

	// Persist to IndexedDB.
	await persist();

	log.info( `Indexed ${ indexed } chunks.` );
	return indexed;
}

/**
 * Cosine similarity between two L2-normalised vectors.
 *
 * Both operands come from the embedding pipeline with `normalize: true`, so
 * the magnitudes are 1 and the dot product *is* the cosine.
 *
 * @param {Float32Array} a First vector.
 * @param {Float32Array} b Second vector.
 * @return {number} Similarity in [-1, 1].
 */
function cosine( a, b ) {
	let dot = 0;
	for ( let i = 0; i < a.length; i++ ) {
		dot += a[ i ] * b[ i ];
	}
	return dot;
}

/**
 * Search the vector index for relevant code chunks.
 *
 * @param {string} query    Query text.
 * @param {number} [topK=3] Number of results to return.
 * @return {Promise<Object[]>} Array of { path, start_line, end_line, content, type, score }.
 */
async function search( query, topK = 3 ) {
	if ( ! initialized || vectors.length === 0 || chunkMetadata.length === 0 ) {
		return [];
	}

	const queryVector = Float32Array.from( await embed( query ) );

	const ranked = vectors
		.map( ( vector, idx ) => ( {
			idx,
			score: cosine( queryVector, vector ),
		} ) )
		.sort( ( a, b ) => b.score - a.score )
		.slice( 0, topK );

	log.info(
		'Search results:',
		ranked.map(
			( r ) =>
				`${ r.idx }: ${
					chunkMetadata[ r.idx ]?.path
				} (${ r.score.toFixed( 3 ) })`
		)
	);

	return ranked.map( ( { idx, score } ) => ( {
		...chunkMetadata[ idx ],
		// Real cosine similarity, unlike the inverse-rank placeholder the
		// previous ANN index forced (it returned no distances).
		score: Number( score.toFixed( 3 ) ),
	} ) );
}

/**
 * Check if the vector store has an index ready for searching.
 *
 * @return {boolean} True if index is ready.
 */
function isReady() {
	return initialized && chunkMetadata.length > 0;
}

/**
 * Get the number of indexed chunks.
 *
 * @return {number} Chunk count.
 */
function getChunkCount() {
	return chunkMetadata.length;
}

/**
 * Reload the index and chunk metadata from IndexedDB.
 * Used after the indexing worker finishes persisting new data.
 *
 * @return {Promise<void>}
 */
async function reload() {
	vectors = [];
	chunkMetadata = [];
	initialized = false;
	initializing = false;
	await loadIndex();
	initialized = true;
	log.info(
		`Reloaded index from IndexedDB (${ chunkMetadata.length } chunks).`
	);
}

/**
 * Build the index from pre-computed embeddings and persist.
 * Used after the indexing worker returns embeddings from a background thread.
 *
 * @param {Object[]} embeddings Pre-computed embedding entries.
 * @param {Object[]} metadata   Chunk metadata array.
 * @return {Promise<number>} Number of chunks indexed.
 */
async function buildFromEmbeddings( embeddings, metadata ) {
	if ( ! initialized ) {
		await init();
	}

	vectors = toVectors( embeddings );
	chunkMetadata = metadata;

	await persist();

	log.info(
		`Built index from ${ metadata.length } pre-computed embeddings.`
	);
	return metadata.length;
}

/**
 * Clear the index and persisted data.
 *
 * @return {Promise<void>}
 */
async function clear() {
	vectors = [];
	chunkMetadata = [];
	await persist();
	log.info( 'Vector store cleared.' );
}

const vectorStore = {
	init,
	embed,
	index,
	search,
	isReady,
	getChunkCount,
	clear,
	reload,
	buildFromEmbeddings,
};

export default vectorStore;
