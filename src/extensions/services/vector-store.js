/**
 * Vector Store Service
 *
 * In-browser RAG vector store using Transformers.js (CDN) + voy-search (bundled)
 * + IndexedDB persistence. Embeds code chunks and enables semantic search.
 *
 * - Transformers.js loaded lazily from CDN (~100MB, not bundled)
 * - Embeddings run on CPU (WASM) to avoid GPU contention with the LLM
 * - Voy index + chunk metadata persisted in IndexedDB
 */

import { createLogger } from '../utils/logger';

const log = createLogger( 'VectorStore' );

const TRANSFORMERS_CDN =
	'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const DB_NAME = 'wp-agentic-rag-db';
const DB_VERSION = 1;
const STORE_INDEX = 'voy-index';
const STORE_CHUNKS = 'chunk-metadata';
const BATCH_SIZE = 10;

/**
 * @type {import('@huggingface/transformers').Pipeline|null}
 */
let pipeline = null;

/**
 * @type {import('voy-search').Voy|null}
 */
let voyInstance = null;

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
 * Load Voy search instance from bundled npm package.
 *
 * @return {Promise<void>}
 */
async function loadVoy() {
	if ( voyInstance ) {
		return;
	}

	const { Voy } = await import( 'voy-search' );

	// Try to restore from IndexedDB.
	try {
		const savedIndex = await dbGet( STORE_INDEX, 'current' );
		const savedChunks = await dbGet( STORE_CHUNKS, 'current' );

		if ( savedIndex && savedChunks ) {
			voyInstance = Voy.deserialize( savedIndex );
			chunkMetadata = savedChunks;
			log.info(
				`Restored index from IndexedDB (${ chunkMetadata.length } chunks).`
			);
			return;
		}
	} catch ( err ) {
		log.warn( 'Could not restore index from IndexedDB:', err.message );
	}

	voyInstance = new Voy( { embeddings: [] } );
	chunkMetadata = [];
	log.info( 'Created new empty Voy index.' );
}

/**
 * Initialize the vector store.
 * Loads Voy immediately (bundled), defers Transformers.js until needed.
 *
 * @return {Promise<void>}
 */
async function init() {
	if ( initialized || initializing ) {
		return;
	}

	initializing = true;

	try {
		await loadVoy();
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
 * Persist the current Voy index and chunk metadata to IndexedDB.
 *
 * @return {Promise<void>}
 */
async function persist() {
	try {
		const serialized = voyInstance.serialize();
		await dbPut( STORE_INDEX, 'current', serialized );
		await dbPut( STORE_CHUNKS, 'current', chunkMetadata );
		log.debug( `Persisted index (${ chunkMetadata.length } chunks).` );
	} catch ( err ) {
		log.warn( 'Failed to persist index:', err.message );
	}
}

/**
 * Index an array of code chunks.
 * Embeds in batches and adds to the Voy index.
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

	const { Voy } = await import( 'voy-search' );

	// Reset index with fresh data.
	const embeddings = [];
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

	// Build new Voy index with all embeddings.
	voyInstance = new Voy( { embeddings } );

	// Persist to IndexedDB.
	await persist();

	log.info( `Indexed ${ indexed } chunks.` );
	return indexed;
}

/**
 * Search the vector index for relevant code chunks.
 *
 * @param {string} query    Query text.
 * @param {number} [topK=3] Number of results to return.
 * @return {Promise<Object[]>} Array of { path, start_line, end_line, content, type, score }.
 */
async function search( query, topK = 3 ) {
	if ( ! initialized || ! voyInstance || chunkMetadata.length === 0 ) {
		return [];
	}

	const queryEmbedding = await embed( query );
	// Voy.search() requires Float32Array, not a plain Array.
	const queryFloat32 = new Float32Array( queryEmbedding );
	const results = voyInstance.search( queryFloat32, topK );

	log.info(
		'Voy results:',
		results.neighbors.map( ( n ) => `${ n.id }: ${ n.title }` )
	);

	return results.neighbors.map( ( neighbor, rank ) => {
		const idx = parseInt( neighbor.id, 10 );
		const meta = chunkMetadata[ idx ];
		return {
			...meta,
			// Voy doesn't return distances; results are pre-sorted by similarity.
			// Use inverse rank as a rough relevance indicator.
			score: topK - rank,
		};
	} );
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
 * Clear the index and persisted data.
 *
 * @return {Promise<void>}
 */
async function clear() {
	const { Voy } = await import( 'voy-search' );
	voyInstance = new Voy( { embeddings: [] } );
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
};

export default vectorStore;
