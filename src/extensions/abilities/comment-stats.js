/**
 * Comment Stats Ability
 *
 * Shows comment counts by status.
 *
 * @see includes/abilities/comment-stats.php for the PHP implementation
 */

import {
	registerAbility,
	executeAbility,
} from '../services/agentic-abilities-api';

/**
 * Register the comment-stats ability with the chat system.
 */
export function registerCommentStats() {
	registerAbility( 'wp-agentic-admin/comment-stats', {
		label: 'Show comment statistics',
		description:
			'Show comment counts by status including approved, pending, spam, and trash. Use for questions about comments or moderation.',

		keywords: [ 'comment', 'comments', 'spam', 'pending', 'moderation' ],

		initialMessage: "I'll check your comment statistics...",

		summarize: ( result ) => {
			const { total, approved, pending, spam, trash } = result;

			let summary = `**Total comments:** ${ total }\n\n`;
			summary += `- Approved: ${ approved }\n`;
			summary += `- Pending: ${ pending }\n`;
			summary += `- Spam: ${ spam }\n`;
			summary += `- Trash: ${ trash }`;

			return summary;
		},

		interpretResult: ( result ) => {
			const { total, approved, pending, spam, trash } = result;
			return `${ total } total comments. ${ approved } approved, ${ pending } pending, ${ spam } spam, ${ trash } trash.`;
		},

		execute: async () => {
			return executeAbility( 'wp-agentic-admin/comment-stats', {} );
		},

		requiresConfirmation: false,
	} );
}

export default registerCommentStats;
