/**
 * Cache Flush Ability
 *
 * Flushes the WordPress object cache.
 *
 * ABILITY OVERVIEW:
 * =================
 * A simple write ability that clears the WordPress object cache.
 * Demonstrates a minimal ability with:
 * - No input parameters
 * - Simple success/message response
 * - No confirmation needed (non-destructive write operation)
 *
 * PHP BACKEND RETURNS:
 * {
 *   success: true,
 *   message: "Object cache flushed successfully."
 * }
 *
 * WHY NO CONFIRMATION?
 * Although this modifies state (clears cache), it's considered safe because:
 * - Cache is regenerated automatically on next request
 * - No data is permanently lost
 * - It's a common maintenance operation
 *
 * @see includes/abilities/cache-flush.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the cache-flush ability with the chat system.
 */
export function registerCacheFlush() {
	registerAbility( 'agentic-admin/cache-flush', {
		label: 'Flush cache',
		description:
			'Clear all WordPress object caches (page cache, object cache, opcode cache). Use when the user wants to flush, clear, purge, or refresh caches.',

		// Keywords cover common ways users might request cache clearing.
		keywords: [
			'cache',
			'flush',
			'clear',
			'purge',
			'refresh',
			'reset cache',
		],

		initialMessage: 'Flushing the cache...',

		/**
		 * Generate summary from the result.
		 *
		 * Simple abilities can have simple summaries.
		 * Just return the message from PHP or a default.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			// Use the message from PHP, or provide a default.
			return (
				result.message ||
				'Cache has been flushed successfully. Your site should now serve fresh content.'
			);
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * @param {Object} result - The result from PHP.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result ) => {
			if ( result.success ) {
				return 'The object cache was flushed successfully. The site will regenerate cached data on the next request.';
			}
			return `Cache flush failed: ${
				result.message || 'unknown error'
			}.`;
		},

		/**
		 * Execute the ability.
		 *
		 * @return {Promise<Object>} The result from PHP.
		 */
		execute: async () => {
			// No parameters needed - just flush the cache.
			return executeAbility( 'agentic-admin/cache-flush', {} );
		},

		// Cache clearing is safe and reversible - no confirmation needed.
		requiresConfirmation: false,
	} );
}

export default registerCacheFlush;
