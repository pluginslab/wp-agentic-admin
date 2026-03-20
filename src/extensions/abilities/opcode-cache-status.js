/**
 * OPcache Status Ability
 *
 * Checks OPcache status and configuration.
 *
 * @see includes/abilities/opcode-cache-status.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the opcode-cache-status ability with the chat system.
 */
export function registerOpcodeCacheStatus() {
	registerAbility( 'wp-agentic-admin/opcode-cache-status', {
		label: 'Check OPcache status',
		description:
			'Check OPcache status including memory usage, hit rate, and cached scripts count. Use when users ask about opcache or PHP performance.',

		keywords: [ 'opcache', 'opcode', 'cache', 'php', 'performance' ],

		initialMessage: "I'll check your OPcache status...",

		summarize: ( result ) => {
			if ( ! result.enabled ) {
				return result.message || 'OPcache is not enabled.';
			}

			const { memory, statistics } = result;
			let summary = '**OPcache is enabled**\n\n';
			summary += `**Memory:** ${ memory.used } / ${ memory.total } (${ memory.percentage }% used)\n`;
			summary += `**Cached scripts:** ${ statistics.cached_scripts }\n`;
			summary += `**Hit rate:** ${ statistics.hit_rate }\n`;
			summary += `**Hits:** ${ statistics.hits } | **Misses:** ${ statistics.misses }`;

			return summary;
		},

		interpretResult: ( result ) => {
			if ( ! result.enabled ) {
				return result.message || 'OPcache is not enabled.';
			}
			return `OPcache enabled. ${ result.memory.percentage }% memory used. ${ result.statistics.cached_scripts } scripts cached. Hit rate: ${ result.statistics.hit_rate }.`;
		},

		execute: async () => {
			return executeAbility( 'wp-agentic-admin/opcode-cache-status', {} );
		},

		requiresConfirmation: false,
	} );
}

export default registerOpcodeCacheStatus;
