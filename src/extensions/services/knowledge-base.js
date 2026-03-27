/**
 * Knowledge Base Service
 *
 * Orchestrates indexing from all knowledge sources (code, schema, API, docs)
 * into the vector store. Runs from the Settings tab with progress tracking.
 *
 * @see src/extensions/services/vector-store.js
 */

import { executeAbility } from './agentic-abilities-api';
import vectorStore from './vector-store';
import { createLogger } from '../utils/logger';

const log = createLogger( 'KnowledgeBase' );

const STATUS_KEY = 'wp_agentic_admin_kb_status';

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

/**
 * Save knowledge base status to localStorage.
 *
 * @param {KBStatus} status Status to save.
 */
function saveKBStatus( status ) {
	localStorage.setItem( STATUS_KEY, JSON.stringify( status ) );
}

/**
 * Clear saved knowledge base status.
 */
function clearKBStatus() {
	localStorage.removeItem( STATUS_KEY );
}

/**
 * @typedef {Object} ProgressUpdate
 * @property {string} phase   - Current phase name
 * @property {string} message - Human-readable progress message
 * @property {number} percent - Approximate progress percentage (0-100)
 */

/**
 * Build the knowledge base index from all sources.
 *
 * @param {Function} onProgress - Callback: (ProgressUpdate) => void
 * @return {Promise<KBStatus>} Final index status.
 */
export async function buildIndex( onProgress = () => {} ) {
	log.info( 'Starting knowledge base build...' );

	await vectorStore.init();
	await vectorStore.clear();

	let allChunks = [];
	let totalFiles = 0;
	let schemaTables = 0;
	let apiChunks = 0;
	let docsChunks = 0;

	// Phase 1: Code extraction (~40% of work).
	onProgress( {
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
				5 + Math.round( ( offset / Math.max( totalFiles, 1 ) ) * 30 )
			);
			onProgress( {
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
	onProgress( {
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
	onProgress( {
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
	onProgress( {
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

	// Phase 5: Embedding (~35%).
	onProgress( {
		phase: 'embedding',
		message: `Embedding ${ allChunks.length } chunks (first run downloads ~23MB model)...`,
		percent: 65,
	} );

	const indexed = await vectorStore.index( allChunks, ( done, total ) => {
		const pct = 65 + Math.round( ( done / total ) * 30 );
		onProgress( {
			phase: 'embedding',
			message: `Embedding chunks: ${ done }/${ total }...`,
			percent: Math.min( pct, 95 ),
		} );
	} );

	const status = {
		lastIndexed: Date.now(),
		totalChunks: indexed,
		codeFiles: totalFiles,
		schemaTables,
		apiChunks,
		docsChunks,
	};

	saveKBStatus( status );

	onProgress( {
		phase: 'done',
		message: 'Knowledge base ready!',
		percent: 100,
	} );

	log.info( 'Knowledge base build complete:', status );
	return status;
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
	log.info( 'Knowledge base cleared.' );
}

export default { buildIndex, clearIndex, getKBStatus };
