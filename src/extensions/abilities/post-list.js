/**
 * Post List Ability
 *
 * Lists recent WordPress posts.
 *
 * @see includes/abilities/post-list.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the post-list ability with the chat system.
 */
export function registerPostList() {
	registerAbility( 'wp-agentic-admin/post-list', {
		label: 'List recent WordPress posts',
		description:
			'List recent WordPress posts with title, status, author, and date. Supports filtering by status and post type. Use for questions about posts or content.',

		keywords: [
			'post',
			'posts',
			'articles',
			'content',
			'drafts',
			'published',
		],

		initialMessage: "I'll fetch your recent posts...",

		parseIntent: ( message ) => {
			const lower = message.toLowerCase();
			const params = {};

			// Detect status filter.
			if ( lower.includes( 'draft' ) ) {
				params.status = 'draft';
			} else if ( lower.includes( 'publish' ) ) {
				params.status = 'publish';
			} else if ( lower.includes( 'pending' ) ) {
				params.status = 'pending';
			} else if ( lower.includes( 'trash' ) ) {
				params.status = 'trash';
			}

			// Detect post type.
			if ( lower.includes( 'page' ) ) {
				params.post_type = 'page';
			}

			return params;
		},

		summarize: ( result ) => {
			const { posts, total } = result;

			if ( total === 0 ) {
				return 'No posts found matching your criteria.';
			}

			let summary = `Found **${ total }** post${
				total !== 1 ? 's' : ''
			}:\n\n`;

			posts.forEach( ( p ) => {
				summary += `- **${ p.title }** — ${ p.status } by ${
					p.author
				} (${ p.date.split( ' ' )[ 0 ] })\n`;
			} );

			return summary;
		},

		interpretResult: ( result ) => {
			const { posts, total } = result;
			if ( total === 0 ) {
				return 'No posts found.';
			}
			const titles = posts.map(
				( p ) => `"${ p.title }" (${ p.status })`
			);
			return `Found ${ total } posts: ${ titles.join( ', ' ) }.`;
		},

		execute: async ( params ) => {
			const input = {};
			if ( params.status ) {
				input.status = params.status;
			}
			if ( params.post_type ) {
				input.post_type = params.post_type;
			}
			return executeAbility( 'wp-agentic-admin/post-list', input );
		},

		requiresConfirmation: false,
	} );
}

export default registerPostList;
