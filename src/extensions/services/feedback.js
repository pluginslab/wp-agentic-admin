/**
 * Feedback Service
 *
 * Manages opt-in state and thumbs-up/thumbs-down feedback data.
 *
 * Opt-in preference is persisted on the server (WordPress options) via the
 * wp-agentic-admin/v1/settings REST endpoint, and cached in localStorage for
 * synchronous reads. Feedback ratings are stored in localStorage. When
 * FEEDBACK_S3_ENDPOINT is configured at build time and the user has opted in,
 * each rating (including the conversation turn) is also uploaded anonymously
 * to an S3-compatible bucket for model fine-tuning.
 *
 */

import { createLogger } from '../utils/logger';

const log = createLogger( 'Feedback' );

const OPTIN_CACHE_KEY = 'wp-agentic-admin-feedback-optin';
const FEEDBACK_KEY = 'wp-agentic-admin-feedback';

// S3 endpoint inlined at build time via dotenv-webpack. Empty string = disabled.
const FEEDBACK_S3_ENDPOINT = process.env.FEEDBACK_S3_ENDPOINT || '';

/**
 * Whether feedback collection is enabled at build time.
 * False when FEEDBACK_S3_ENDPOINT was not set — the opt-in UI is hidden.
 */
export const FEEDBACK_UPLOAD_ENABLED = Boolean( FEEDBACK_S3_ENDPOINT );

// ─── Opt-in ──────────────────────────────────────────────────────────────────

/**
 * Get the current opt-in state.
 *
 * Reads from window.wpAgenticAdmin.settings (server value) first, falling back
 * to the localStorage cache so the value is always available synchronously.
 *
 * @return {boolean|null} true = opted in, false = declined, null = not yet decided
 */
export const getFeedbackOptIn = () => {
	// Prefer the server-side value passed via wp_localize_script
	const serverVal = window.wpAgenticAdmin?.settings?.feedbackOptIn;
	if ( serverVal !== undefined ) {
		return serverVal; // null | true | false
	}

	// Fall back to localStorage cache (e.g. during dev without the full PHP stack)
	try {
		const cached = localStorage.getItem( OPTIN_CACHE_KEY );
		if ( cached === null ) {
			return null;
		}
		return cached === 'true';
	} catch {
		return null;
	}
};

/**
 * Persist the opt-in decision to the server and update the local cache.
 *
 * @param {boolean} optIn - Whether the user opted in
 * @return {Promise<void>}
 */
export const setFeedbackOptIn = async ( optIn ) => {
	// Update localStorage cache immediately so the UI stays reactive
	try {
		localStorage.setItem( OPTIN_CACHE_KEY, String( optIn ) );
	} catch {
		// Ignore storage errors
	}

	// Also update window.wpAgenticAdmin so getFeedbackOptIn() returns the new
	// value synchronously for any subsequent reads in this page load
	if ( window.wpAgenticAdmin?.settings ) {
		window.wpAgenticAdmin.settings.feedbackOptIn = optIn;
	}

	// Persist to server
	const settingsUrl = window.wpAgenticAdmin?.settingsUrl;
	const nonce = window.wpAgenticAdmin?.nonce;

	if ( ! settingsUrl ) {
		log.warn( 'settingsUrl not available, skipping server persist' );
		return;
	}

	try {
		const response = await fetch( settingsUrl, {
			method: 'POST',
			credentials: 'same-origin',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce || '',
			},
			body: JSON.stringify( { feedback_optin: optIn } ),
		} );

		if ( ! response.ok ) {
			log.error(
				'Failed to persist feedback opt-in to server:',
				response.status
			);
		}
	} catch ( err ) {
		log.error( 'Error persisting feedback opt-in:', err );
	}
};

// ─── Feedback data ───────────────────────────────────────────────────────────

/**
 * Save a feedback entry to localStorage and optionally upload to S3.
 *
 * When FEEDBACK_S3_ENDPOINT is configured at build time, the entry is also
 * PUT to `{endpoint}/feedback/{sessionId}/{messageId}.json` so it can be
 * collected for model fine-tuning. Upload errors are silently ignored.
 *
 * @param {Object} entry                    - Feedback entry
 * @param {string} entry.messageId          - ID of the rated assistant message
 * @param {string} entry.sessionId          - Chat session ID
 * @param {Array}  entry.abilityIds         - Abilities used in the turn
 * @param {string} entry.rating             - 'up' or 'down'
 * @param {string} [entry.comment]          - Optional free-form comment
 * @param {string} [entry.systemPrompt]     - System prompt active at rating time
 * @param {Array}  [entry.conversation]     - Full conversation up to the rated message,
 *                                          each item `{ role: 'user'|'assistant', content: string }`
 * @param {string} [entry.model]            - Model ID that produced the response
 * @param {Object} [entry.generationConfig] - Generation parameters (temperature, maxTokens)
 * @return {Promise<void>}
 */
export const saveFeedback = async ( {
	messageId,
	sessionId,
	abilityIds,
	rating,
	comment = '',
	systemPrompt = '',
	conversation = [],
	model = '',
	generationConfig = null,
} ) => {
	const entry = {
		messageId,
		sessionId,
		abilityIds: abilityIds || [],
		rating,
		comment,
		timestamp: new Date().toISOString(),
	};

	if ( systemPrompt ) {
		entry.systemPrompt = systemPrompt;
	}
	if ( conversation.length > 0 ) {
		entry.conversation = conversation;
	}
	if ( model ) {
		entry.model = model;
	}
	if ( generationConfig ) {
		entry.generationConfig = generationConfig;
	}

	// Persist to localStorage
	try {
		const existing = JSON.parse(
			localStorage.getItem( FEEDBACK_KEY ) || '[]'
		);

		// Update existing entry for this message, or push a new one
		const idx = existing.findIndex( ( e ) => e.messageId === messageId );

		if ( idx !== -1 ) {
			existing[ idx ] = entry;
		} else {
			existing.push( entry );
		}

		localStorage.setItem( FEEDBACK_KEY, JSON.stringify( existing ) );
	} catch {
		// Silently ignore storage errors
	}

	// Upload to S3 if endpoint is configured (silently skip on error)
	if ( FEEDBACK_S3_ENDPOINT ) {
		try {
			await fetch(
				`${ FEEDBACK_S3_ENDPOINT }/feedback/${ sessionId }/${ messageId }.json`,
				{
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( entry ),
				}
			);
		} catch {
			// Silently ignore upload errors
		}
	}
};

/**
 * Get the stored rating for a specific message, if any.
 *
 * @param {string} messageId - Message ID to look up
 * @return {string|null} 'up', 'down', or null
 */
export const getMessageRating = ( messageId ) => {
	try {
		const existing = JSON.parse(
			localStorage.getItem( FEEDBACK_KEY ) || '[]'
		);
		const entry = existing.find( ( e ) => e.messageId === messageId );
		return entry ? entry.rating : null;
	} catch {
		return null;
	}
};

/**
 * Get all stored feedback entries.
 *
 * @return {Array} All feedback entries
 */
export const getAllFeedback = () => {
	try {
		return JSON.parse( localStorage.getItem( FEEDBACK_KEY ) || '[]' );
	} catch {
		return [];
	}
};
