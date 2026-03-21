/**
 * Search Abilities Ability
 *
 * Searches through all registered abilities by a query string and returns
 * matches sorted by relevance. Intended for use in dynamic system prompt
 * construction — surface only the abilities relevant to the current context.
 *
 * ABILITY OVERVIEW:
 * =================
 * This is a JS-only ability (no PHP needed) — it queries the in-memory
 * toolRegistry directly. No REST API call is made.
 *
 * Relevance scoring (per query token, summed):
 *   - Match in label       → +3
 *   - Match in id          → +2
 *   - Match in description → +2
 *   - Match in keywords    → +1
 *
 * OUTPUT:
 * {
 *   matches: [
 *     { id: "wp-agentic-admin/plugin-list", label: "List installed plugins", description: "..." },
 *     ...
 *   ]
 * }
 *
 * @since 0.5.0
 */

import { registerAbility } from '../services/agentic-abilities-api';
import toolRegistry from '../services/tool-registry';

/**
 * Filter and rank all registered tools by relevance to a user message.
 *
 * Intended for use in system prompt builders to reduce context size by
 * including only the tools most relevant to the current query.
 *
 * @param {string}   userMessage       - The raw user message.
 * @param {Object[]} tools             - Array of tool definitions to search.
 * @param {Object}   [options]         - Options.
 * @param {number}   [options.max=10]  - Maximum number of results to return.
 * @param {string}   [options.exclude] - Tool ID to exclude (e.g. this tool itself).
 * @return {Object[]} Tools sorted by relevance, highest first.
 */
export function filterToolsForPrompt( userMessage, tools, options = {} ) {
	const { max = 10, exclude = null } = options;

	const tokens = ( userMessage || '' )
		.toLowerCase()
		.split( /\s+/ )
		.filter( ( t ) => t.length > 0 );

	if ( tokens.length === 0 ) {
		return [];
	}

	return tools
		.filter( ( tool ) => tool.id !== exclude )
		.map( ( tool ) => ( { tool, score: scoreAbility( tool, tokens ) } ) )
		.filter( ( { score } ) => score > 0 )
		.sort( ( a, b ) => b.score - a.score )
		.slice( 0, max )
		.map( ( { tool } ) => tool );
}

/**
 * Score a single ability against a set of query tokens.
 *
 * @param {Object}   ability - Tool definition from the registry.
 * @param {string[]} tokens  - Lowercase query tokens.
 * @return {number} Relevance score (0 = no match).
 */
function scoreAbility( ability, tokens ) {
	const label = ( ability.label || '' ).toLowerCase();
	const id = ( ability.id || '' ).toLowerCase();
	const description = ( ability.description || '' ).toLowerCase();
	const keywords = ( ability.keywords || [] ).map( ( k ) => k.toLowerCase() );

	let score = 0;

	for ( const token of tokens ) {
		if ( label.includes( token ) ) {
			score += 3;
		}
		if ( id.includes( token ) ) {
			score += 2;
		}
		if ( description.includes( token ) ) {
			score += 2;
		}
		if ( keywords.some( ( k ) => k.includes( token ) ) ) {
			score += 1;
		}
	}

	return score;
}

/**
 * Register the search-abilities ability with the chat system.
 */
export function registerSearchAbilities() {
	registerAbility( 'wp-agentic-admin/search-abilities', {
		label: 'Search available tools',
		description:
			'Search available chat tools/abilities (actions the assistant can perform) by topic. Pass query as args.query. Returns tools sorted by relevance. Use when asked what tools or abilities exist for a given topic, e.g. args: {"query": "cache"}.',

		keywords: [
			'search tools',
			'find tool',
			'available tools',
			'which tool',
			'what tools',
			'what can you do',
			'search actions',
			'find action',
			'search abilities',
			'find ability',
			'available abilities',
			'which ability',
		],

		initialMessage: 'Searching available tools...',

		/**
		 * Execute the ability by searching the in-memory tool registry.
		 *
		 * @param {Object} params             - Parameters from the chat system.
		 * @param {string} params.query       - The search string (extracted from args).
		 * @param {string} params.userMessage - Raw user message (fallback for query).
		 * @return {Object} Result with matches array sorted by relevance.
		 */
		execute: async ( params ) => {
			const query = ( params.query || params.userMessage || '' ).trim();

			if ( ! query ) {
				return { matches: [] };
			}

			const tokens = query
				.toLowerCase()
				.split( /\s+/ )
				.filter( ( t ) => t.length > 0 );

			const abilities = toolRegistry.getAll();

			const scored = abilities
				.map( ( ability ) => ( {
					ability,
					score: scoreAbility( ability, tokens ),
				} ) )
				.filter( ( { score } ) => score > 0 )
				.sort( ( a, b ) => b.score - a.score );

			const matches = scored.map( ( { ability } ) => ( {
				id: ability.id,
				label: ability.label || '',
				description: ability.description || '',
			} ) );

			return { matches };
		},

		/**
		 * Generate a human-readable summary of the search results.
		 *
		 * @param {Object}   result         - The result from execute().
		 * @param {Object[]} result.matches - Matched abilities.
		 * @return {string} Markdown-formatted summary.
		 */
		summarize: ( result ) => {
			const { matches } = result;

			if ( ! matches || matches.length === 0 ) {
				return 'No abilities found matching your search.';
			}

			const lines = matches.map(
				( m ) => `- **${ m.label }** (${ m.id }): ${ m.description }`
			);

			const noun = matches.length === 1 ? 'ability' : 'abilities';
			return `Found ${
				matches.length
			} matching ${ noun }:\n\n${ lines.join( '\n' ) }`;
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * @param {Object}   result         - The result from execute().
		 * @param {Object[]} result.matches - Matched abilities.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result ) => {
			const { matches } = result;

			if ( ! matches || matches.length === 0 ) {
				return 'No abilities matched the search query.';
			}

			const list = matches
				.map( ( m ) => `${ m.id }: ${ m.description || m.label }` )
				.join( '; ' );

			return `Found ${ matches.length } matching ${
				matches.length === 1 ? 'ability' : 'abilities'
			}: ${ list }.`;
		},

		requiresConfirmation: false,
	} );
}

export default registerSearchAbilities;
