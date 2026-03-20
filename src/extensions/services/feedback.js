/**
 * Feedback Service
 *
 * Manages opt-in state and thumbs-up/thumbs-down feedback data.
 *
 * Opt-in preference is persisted on the server (WordPress options) via the
 * wp-agentic-admin/v1/settings REST endpoint, and cached in localStorage for
 * synchronous reads. Feedback ratings are stored in localStorage only —
 * nothing leaves the browser.
 *
 */

import { createLogger } from '../utils/logger';

const log = createLogger( 'Feedback' );

const OPTIN_CACHE_KEY = 'wp-agentic-admin-feedback-optin';
const FEEDBACK_KEY = 'wp-agentic-admin-feedback';

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
 * Save a feedback entry to localStorage.
 *
 * @param {Object} entry            - Feedback entry
 * @param {string} entry.messageId  - ID of the rated assistant message
 * @param {string} entry.sessionId  - Chat session ID
 * @param {Array}  entry.abilityIds - Abilities used in the turn
 * @param {string} entry.rating     - 'up' or 'down'
 * @param {string} [entry.comment]  - Optional free-form comment
 */
export const saveFeedback = ( {
	messageId,
	sessionId,
	abilityIds,
	rating,
	comment = '',
} ) => {
	try {
		const existing = JSON.parse(
			localStorage.getItem( FEEDBACK_KEY ) || '[]'
		);

		// Update existing entry for this message, or push a new one
		const idx = existing.findIndex( ( e ) => e.messageId === messageId );
		const entry = {
			messageId,
			sessionId,
			abilityIds: abilityIds || [],
			rating,
			comment,
			timestamp: new Date().toISOString(),
		};

		if ( idx !== -1 ) {
			existing[ idx ] = entry;
		} else {
			existing.push( entry );
		}

		localStorage.setItem( FEEDBACK_KEY, JSON.stringify( existing ) );
	} catch {
		// Silently ignore storage errors
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
