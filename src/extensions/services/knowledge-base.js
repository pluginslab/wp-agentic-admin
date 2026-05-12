/**
 * Knowledge Base Service
 *
 * Orchestrates indexing from all knowledge sources (code, schema, API, docs)
 * into the vector store. Maintains singleton state so the build survives
 * component unmounts (e.g. switching tabs) and any component can subscribe
 * to live progress updates.
 *
 * @see src/extensions/services/vector-store.js
 */

import { executeAbility } from './agentic-abilities-api';
import vectorStore from './vector-store';
import { createLogger } from '../utils/logger';

const log = createLogger( 'KnowledgeBase' );

const STATUS_KEY = 'agentic_admin_kb_status';

/* ── Singleton state ─────────────────────────────────────────────────── */

let _building = false;
let _progress = null;
let _error = null;
let _buildPromise = null;

/** @type {Set<Function>} */
const _listeners = new Set();

function _notify() {
	for ( const fn of _listeners ) {
		try {
			fn();
		} catch {
			// Listener threw — ignore to protect other subscribers.
		}
	}
}

/**
 * Subscribe to state changes. Returns an unsubscribe function.
 *
 * @param {Function} listener Called on every state change.
 * @return {Function} Unsubscribe.
 */
export function subscribe( listener ) {
	_listeners.add( listener );
	return () => _listeners.delete( listener );
}

/**
 * @return {boolean} Whether a build is in progress.
 */
export function isBuilding() {
	return _building;
}

/**
 * @return {{phase: string, message: string, percent: number}|null}
 */
export function getProgress() {
	return _progress;
}

/**
 * @return {string|null} Last build error, if any.
 */
export function getError() {
	return _error;
}

/* ── localStorage helpers ────────────────────────────────────────────── */

/**
 * @typedef {Object} KBStatus
 * @property {number} lastIndexed  - Timestamp of last successful index
 * @property {number} totalChunks  - Total chunks in the index
 * @property {number} codeFiles    - Number of code files indexed
 * @property {number} schemaTables - Number of DB tables indexed
 * @property {number} apiChunks    - Number of WP API signature chunks
 * @property {number} docsChunks   - Number of reference doc chunks
 */

/**
 * Get the saved knowledge base status.
 *
 * @return {KBStatus|null} Saved status or null.
 */
export function getKBStatus() {
	try {
		const saved = localStorage.getItem( STATUS_KEY );
		return saved ? JSON.parse( saved ) : null;
	} catch {
		return null;
	}
}

function saveKBStatus( status ) {
	localStorage.setItem( STATUS_KEY, JSON.stringify( status ) );
}

function clearKBStatus() {
	localStorage.removeItem( STATUS_KEY );
}

/* ── Worker helper ───────────────────────────────────────────────────── */

/**
 * Embed chunks in a Web Worker, then build Voy index on main thread.
 *
 * @param {Object[]} chunks     Chunks to index.
 * @param {Function} onProgress Callback: (done, total, message) => void.
 * @return {Promise<number>} Number of chunks indexed.
 */
function indexInWorker( chunks, onProgress ) {
	return new Promise( ( resolve, reject ) => {
		const pluginUrl = window.wpAgenticAdmin?.pluginUrl;

		if ( ! pluginUrl ) {
			reject( new Error( 'Plugin URL not available for worker.' ) );
			return;
		}

		const worker = new Worker(
			pluginUrl + 'build-extensions/indexing-worker.js'
		);

		worker.addEventListener( 'message', async ( e ) => {
			const msg = e.data;

			if ( msg.type === 'progress' ) {
				onProgress( msg.done, msg.total, msg.message );
			} else if ( msg.type === 'complete' ) {
				worker.terminate();

				// Build Voy index on main thread (fast, < 1s).
				try {
					onProgress(
						msg.chunkMetadata.length,
						msg.chunkMetadata.length,
						'Building search index...'
					);
					const count = await vectorStore.buildFromEmbeddings(
						msg.embeddings,
						msg.chunkMetadata
					);
					log.info( `Index built: ${ count } chunks.` );
					resolve( count );
				} catch ( err ) {
					reject( err );
				}
			} else if ( msg.type === 'error' ) {
				log.error( 'Worker error:', msg.message );
				worker.terminate();
				reject( new Error( msg.message ) );
			}
		} );

		worker.addEventListener( 'error', ( e ) => {
			log.error( 'Worker crashed:', e.message );
			worker.terminate();
			reject( new Error( `Worker crashed: ${ e.message }` ) );
		} );

		worker.postMessage( { type: 'embed', chunks } );
	} );
}

/* ── Progress helper ─────────────────────────────────────────────────── */

function setProgress( update ) {
	_progress = update;
	_notify();
}

/* ── Public API ──────────────────────────────────────────────────────── */

/**
 * Build the knowledge base index from all sources.
 * If a build is already running, returns the existing promise.
 *
 * @return {Promise<KBStatus>} Final index status.
 */
export async function buildIndex() {
	// Deduplicate: if already building, return existing promise.
	if ( _building && _buildPromise ) {
		return _buildPromise;
	}

	_building = true;
	_error = null;
	_progress = { phase: 'starting', message: 'Starting...', percent: 0 };
	_notify();

	_buildPromise = _runBuild();

	try {
		const status = await _buildPromise;
		return status;
	} finally {
		_buildPromise = null;
	}
}

async function _runBuild() {
	try {
		log.info( 'Starting knowledge base build...' );

		await vectorStore.init();
		await vectorStore.clear();

		let allChunks = [];
		let totalFiles = 0;
		let schemaTables = 0;
		let apiChunks = 0;
		let docsChunks = 0;

		// Phase 1: Code extraction (~40%).
		setProgress( {
			phase: 'code',
			message: 'Extracting code from active theme and plugins...',
			percent: 5,
		} );

		let offset = 0;
		let hasMore = true;

		while ( hasMore ) {
			try {
				const page = await executeAbility(
					'wp-agentic-admin/codebase-extract',
					{ offset, limit: 50 }
				);

				if ( ! page || ! page.chunks ) {
					break;
				}

				allChunks = allChunks.concat( page.chunks );
				totalFiles = page.total_files || totalFiles;
				hasMore = page.has_more || false;
				offset += 50;

				const pct = Math.min(
					35,
					5 +
						Math.round(
							( offset / Math.max( totalFiles, 1 ) ) * 30
						)
				);
				setProgress( {
					phase: 'code',
					message: `Extracted ${ offset } of ~${ totalFiles } files...`,
					percent: pct,
				} );
			} catch ( e ) {
				log.warn( 'Code extraction page failed:', e.message );
				break;
			}
		}

		// Phase 2: Database schema (~10%).
		setProgress( {
			phase: 'schema',
			message: 'Extracting database schema...',
			percent: 40,
		} );

		try {
			const schema = await executeAbility(
				'wp-agentic-admin/schema-extract',
				{}
			);
			if ( schema && schema.chunks && schema.chunks.length ) {
				allChunks = allChunks.concat( schema.chunks );
				schemaTables = schema.total_tables || 0;
			}
		} catch ( e ) {
			log.warn( 'Schema extraction failed (best-effort):', e.message );
		}

		// Phase 3: WP API signatures (~10%).
		setProgress( {
			phase: 'api',
			message: 'Extracting WordPress API signatures...',
			percent: 50,
		} );

		try {
			const api = await executeAbility(
				'wp-agentic-admin/wp-api-extract',
				{}
			);
			if ( api && api.chunks && api.chunks.length ) {
				apiChunks = api.chunks.length;
				allChunks = allChunks.concat( api.chunks );
			}
		} catch ( e ) {
			log.warn( 'API extraction failed (best-effort):', e.message );
		}

		// Phase 4: Reference docs (~5%).
		setProgress( {
			phase: 'docs',
			message: 'Extracting reference documentation...',
			percent: 60,
		} );

		try {
			const docs = await executeAbility(
				'wp-agentic-admin/docs-extract',
				{}
			);
			if ( docs && docs.chunks && docs.chunks.length ) {
				docsChunks = docs.chunks.length;
				allChunks = allChunks.concat( docs.chunks );
			}
		} catch ( e ) {
			log.warn( 'Docs extraction failed (best-effort):', e.message );
		}

		if ( allChunks.length === 0 ) {
			throw new Error( 'No content found to index.' );
		}

		// Phase 5: Embedding (~35%) — Web Worker.
		setProgress( {
			phase: 'embedding',
			message: `Embedding ${ allChunks.length } chunks in background (first run downloads ~23MB model)...`,
			percent: 65,
		} );

		const indexed = await indexInWorker(
			allChunks,
			( done, total, msg ) => {
				const pct =
					total > 0 ? 65 + Math.round( ( done / total ) * 30 ) : 65;
				setProgress( {
					phase: 'embedding',
					message: msg,
					percent: Math.min( pct, 95 ),
				} );
			}
		);

		const status = {
			lastIndexed: Date.now(),
			totalChunks: indexed,
			codeFiles: totalFiles,
			schemaTables,
			apiChunks,
			docsChunks,
		};

		saveKBStatus( status );

		_building = false;
		setProgress( {
			phase: 'done',
			message: 'Knowledge base ready!',
			percent: 100,
		} );

		log.info( 'Knowledge base build complete:', status );
		return status;
	} catch ( err ) {
		_error = err.message;
		_building = false;
		_notify();
		throw err;
	}
}

/**
 * Clear the knowledge base index.
 *
 * @return {Promise<void>}
 */
export async function clearIndex() {
	await vectorStore.init();
	await vectorStore.clear();
	clearKBStatus();
	_progress = null;
	_error = null;
	_notify();
	log.info( 'Knowledge base cleared.' );
}

export default {
	buildIndex,
	clearIndex,
	getKBStatus,
	subscribe,
	isBuilding,
	getProgress,
	getError,
};
