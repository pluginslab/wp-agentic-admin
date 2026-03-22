/**
 * Query Database Ability
 *
 * Executes read-only SQL queries for site inspection.
 *
 * @see includes/abilities/query-database.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the query-database ability with the chat system.
 */
export function registerQueryDatabase() {
	registerAbility( 'wp-agentic-admin/query-database', {
		label: 'Run a read-only SQL query',
		description:
			'Run a read-only SQL query (SELECT/SHOW/DESCRIBE) on the WordPress database. Use {prefix} for the table prefix. Args: query (the SQL string). Use when users ask about database content, row counts, or table data.',

		keywords: [ 'query', 'database', 'sql', 'select', 'table', 'rows' ],

		initialMessage: "I'll run that query...",

		summarize: ( result ) => {
			if ( ! result.success ) {
				return `Query failed: ${ result.message }`;
			}

			if ( result.rows === 0 ) {
				return 'Query returned no results.';
			}

			let summary = `**${ result.rows } row${
				result.rows !== 1 ? 's' : ''
			} returned:**\n\n`;

			// Format as simple table for first 10 rows.
			const rows = result.results.slice( 0, 10 );
			if ( rows.length > 0 ) {
				const keys = Object.keys( rows[ 0 ] );
				summary += '| ' + keys.join( ' | ' ) + ' |\n';
				summary +=
					'| ' + keys.map( () => '---' ).join( ' | ' ) + ' |\n';
				rows.forEach( ( row ) => {
					const vals = keys.map( ( k ) =>
						String( row[ k ] ?? '' ).substring( 0, 50 )
					);
					summary += '| ' + vals.join( ' | ' ) + ' |\n';
				} );
			}

			if ( result.rows > 10 ) {
				summary += `\n_Showing 10 of ${ result.rows } rows._`;
			}

			return summary;
		},

		interpretResult: ( result ) => {
			if ( ! result.success ) {
				return `Query failed: ${ result.message }`;
			}
			if ( result.rows === 0 ) {
				return 'Query returned no results.';
			}
			// Include results so the LLM can summarize them for the user.
			const preview = result.results.slice( 0, 10 );
			return `Query returned ${
				result.rows
			} rows. Results:\n${ JSON.stringify( preview, null, 2 ) }`;
		},

		execute: async ( params ) => {
			if ( ! params.query ) {
				return { success: false, message: 'No SQL query provided.' };
			}
			return executeAbility( 'wp-agentic-admin/query-database', {
				query: params.query,
			} );
		},

		requiresConfirmation: false,
	} );
}

export default registerQueryDatabase;
