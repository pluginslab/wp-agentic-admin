/**
 * Content Generate Ability
 *
 * Generates page content with Gutenberg blocks based on a topic.
 * JS-only ability — uses the loaded LLM engine to generate content,
 * then wp.blocks.createBlock() to insert blocks into the editor.
 *
 * ABILITY OVERVIEW:
 * =================
 * When used on a block editor page (post.php?post=X&action=edit):
 * - Asks the LLM to generate a structured JSON block array for the topic
 * - Creates real Gutenberg blocks and inserts them into the editor
 *
 * When used outside the block editor:
 * - Returns an immediate error message (no LLM call, no REST call)
 *
 * REQUIRES: Block editor (Gutenberg) + loaded LLM model
 *
 * @since 0.11.0
 */

import { registerAbility } from '../services/agentic-abilities-api';
import modelLoader from '../services/model-loader';
import { createLogger } from '../utils/logger';

const log = createLogger( 'ContentGenerate' );
import {
	isBlockEditorAvailable,
	getEditorNotAvailableResult,
	compactFormatToBlocks,
	replaceEditorBlocks,
	getEditorPostTitle,
} from './shared/editor-helpers';

/**
 * System prompt for the LLM to generate block content.
 */
const CONTENT_SYSTEM_PROMPT = `Return ONLY a JSON array of Gutenberg blocks. No text, no markdown.
Block types: core/heading, core/paragraph, core/list (with core/list-item innerBlocks).
Generate 5-8 blocks. Keep paragraphs short (1-2 sentences each). Use compact JSON (no extra whitespace).
Example: [{"name":"core/heading","attributes":{"level":2,"content":"Title"}},{"name":"core/paragraph","attributes":{"content":"Text."}}]

/nothink`;

/**
 * Generate fallback template blocks when LLM is unavailable.
 *
 * @param {string} topic - The content topic.
 * @return {Array} Compact block array.
 */
function generateFallbackBlocks( topic ) {
	const title = topic.charAt( 0 ).toUpperCase() + topic.slice( 1 );
	return [
		{
			name: 'core/heading',
			attributes: { level: 2, content: title },
		},
		{
			name: 'core/paragraph',
			attributes: {
				content: `This page is about <strong>${ title }</strong>. Replace this placeholder text with your own content.`,
			},
		},
		{
			name: 'core/heading',
			attributes: { level: 3, content: 'Overview' },
		},
		{
			name: 'core/paragraph',
			attributes: {
				content:
					'Add an overview of the topic here. Describe the key points you want to cover and why they matter to your readers.',
			},
		},
		{
			name: 'core/heading',
			attributes: { level: 3, content: 'Key Points' },
		},
		{
			name: 'core/list',
			innerBlocks: [
				{
					name: 'core/list-item',
					attributes: { content: 'First key point about ' + topic },
				},
				{
					name: 'core/list-item',
					attributes: { content: 'Second key point about ' + topic },
				},
				{
					name: 'core/list-item',
					attributes: { content: 'Third key point about ' + topic },
				},
			],
		},
		{
			name: 'core/heading',
			attributes: { level: 3, content: 'Conclusion' },
		},
		{
			name: 'core/paragraph',
			attributes: {
				content:
					'Summarize the main takeaways here and provide any final thoughts or calls to action.',
			},
		},
	];
}

/**
 * Extract the topic from the user message.
 *
 * @param {string} message - The user's message.
 * @return {string} Extracted topic.
 */
function extractTopic( message ) {
	let topic = message.toLowerCase();

	// Remove common action phrases
	const removePatterns = [
		/^(please\s+)?/,
		/\b(generate|create|write|fill|make|build|erstelle|erstell|erzeuge|fülle|schreibe?)\b/gi,
		/\b(a |an |the |eine?n?\s|die |das |der )\b/gi,
		/\b(page|post|content|article|seite|inhalt|beitrag)\b/gi,
		/\b(about|for|on|über|für|zu|zum|zur)\b/gi,
		/\b(with|blocks?|gutenberg|editor|mit|blöcke?n?)\b/gi,
	];

	for ( const pattern of removePatterns ) {
		topic = topic.replace( pattern, '' );
	}

	// Clean up whitespace
	topic = topic.replace( /\s+/g, ' ' ).trim();

	// If nothing left, use a generic topic
	if ( ! topic || topic.length < 2 ) {
		topic = message.trim();
	}

	return topic;
}

/**
 * Parse JSON from LLM response, handling common formatting issues.
 *
 * @param {string} text - Raw LLM response text.
 * @return {Array|null} Parsed block array or null.
 */
function parseBlocksFromResponse( text ) {
	// Strip Qwen 3 thinking blocks (same pattern as react-agent.js)
	text = text.replace( /<think>[\s\S]*?<\/think>\s*/g, '' ).trim();

	// Strip markdown code fences
	text = text
		.replace( /^```(?:json)?\s*/m, '' )
		.replace( /\s*```$/m, '' )
		.trim();

	// Fix common LLM mistake: [{...}],[{...}] (each block in its own array)
	// Normalize to [{...},{...}] by replacing ],[ with ,
	text = text.replace( /\]\s*,\s*\[/g, ',' );

	// Try direct parse first
	try {
		const parsed = JSON.parse( text );
		if ( Array.isArray( parsed ) ) {
			return parsed;
		}
	} catch ( e ) {
		// Continue to extraction attempts
	}

	// Try extracting JSON array from surrounding text
	const jsonMatch = text.match( /\[[\s\S]*\]/ );
	if ( jsonMatch ) {
		try {
			const parsed = JSON.parse( jsonMatch[ 0 ] );
			if ( Array.isArray( parsed ) ) {
				return parsed;
			}
		} catch ( e ) {
			// Failed to parse extracted JSON
		}
	}

	// Try to recover truncated JSON (LLM hit max_tokens before closing the array)
	const arrayStart = text.indexOf( '[' );
	if ( arrayStart >= 0 ) {
		const lastBrace = text.lastIndexOf( '}' );
		if ( lastBrace > arrayStart ) {
			const truncated = text.substring( arrayStart, lastBrace + 1 ) + ']';
			try {
				const parsed = JSON.parse( truncated );
				if ( Array.isArray( parsed ) && parsed.length > 0 ) {
					return parsed;
				}
			} catch ( e ) {
				// Not recoverable
			}
		}
	}

	return null;
}

/**
 * Register the content-generate ability with the chat system.
 */
export function registerContentGenerate() {
	registerAbility( 'wp-agentic-admin/content-generate', {
		label: 'Generate page content',
		description:
			'Write new content for an empty page. Fill a page with generated headings, paragraphs, and lists about a topic.',

		keywords: [
			'generate content',
			'create content',
			'fill page',
			'write content',
			'page content',
			'add content',
			'content erstellen',
			'seite füllen',
			'inhalt erstellen',
			'inhalt generieren',
		],

		initialMessage: 'Generating page content...',

		/**
		 * Generate summary from the result.
		 *
		 * @param {Object} result - The ability result.
		 * @return {string} Human-readable summary.
		 */
		summarize: ( result ) => {
			if ( ! result?.success ) {
				return result?.message || 'Failed to generate content.';
			}

			let summary = `Generated **${ result.blockCount }** block(s) about "${ result.topic }".`;

			if ( result.usedFallback ) {
				summary +=
					'\n\n*Note: Template content was used because the AI model was not available. Edit the placeholder text to customize.*';
			}

			summary += '\n\nYou can undo this with **Ctrl+Z** (Cmd+Z on Mac).';

			return summary;
		},

		/**
		 * Plain-English interpretation of the result for the LLM.
		 *
		 * @param {Object} result - The ability result.
		 * @return {string} Plain-English interpretation.
		 */
		interpretResult: ( result ) => {
			if ( ! result?.success ) {
				return result?.message || 'Content generation failed.';
			}
			return `Successfully generated ${ result.blockCount } content blocks about "${ result.topic }" and inserted them into the editor.`;
		},

		/**
		 * Parse user intent to extract topic.
		 *
		 * @param {string} message - The user's message.
		 * @return {Object} Extracted parameters.
		 */
		parseIntent: ( message ) => {
			return {
				topic: extractTopic( message ),
			};
		},

		/**
		 * Get confirmation message before executing.
		 *
		 * @param {Object} params - The parameters that will be used.
		 * @return {string} Confirmation message to show user.
		 */
		getConfirmationMessage: ( params ) => {
			const currentTitle = isBlockEditorAvailable()
				? getEditorPostTitle()
				: '';
			const pageInfo = currentTitle
				? ` on "${ currentTitle }"`
				: ' in the editor';
			return `This will replace all current content${ pageInfo } with generated content about "${ params.topic }". You can undo with Ctrl+Z. Proceed?`;
		},

		/**
		 * Execute the ability.
		 *
		 * @param {Object} params - Parameters including userMessage and parsed topic.
		 * @return {Promise<Object>} The result.
		 */
		execute: async ( params ) => {
			// Instant check — no LLM, no REST call
			if ( ! isBlockEditorAvailable() ) {
				return getEditorNotAvailableResult();
			}

			const topic =
				params.topic || extractTopic( params.userMessage || '' );

			if ( ! topic ) {
				return {
					success: false,
					message:
						'Please specify a topic. For example: "Generate content about WordPress security best practices"',
				};
			}

			// Try to generate content via LLM
			let compactBlocks = null;
			let usedFallback = false;

			const engine = modelLoader.getEngine();
			if ( engine ) {
				try {
					log.info( 'Generating content via LLM for topic:', topic );
					const stream = await engine.chat.completions.create( {
						messages: [
							{
								role: 'system',
								content: CONTENT_SYSTEM_PROMPT,
							},
							{
								role: 'user',
								content: `Generate content about: ${ topic }`,
							},
						],
						temperature: 0.7,
						max_tokens: 2048,
						stream: true,
					} );

					let text = '';
					for await ( const chunk of stream ) {
						const delta =
							chunk.choices?.[ 0 ]?.delta?.content || '';
						text += delta;
					}

					log.info( 'LLM response received, length:', text.length );
					compactBlocks = parseBlocksFromResponse( text );

					if ( ! compactBlocks ) {
						log.warn(
							'Failed to parse blocks from LLM response:',
							text.substring( 0, 200 )
						);
					}
				} catch ( e ) {
					log.error( 'Content generation LLM call failed:', e );
				}
			} else {
				log.warn( 'No engine available, using fallback template' );
			}

			// Fallback to template if LLM unavailable or failed
			if ( ! compactBlocks || compactBlocks.length === 0 ) {
				compactBlocks = generateFallbackBlocks( topic );
				usedFallback = true;
			}

			// Convert to real Gutenberg blocks and insert
			const blocks = compactFormatToBlocks( compactBlocks );

			if ( blocks.length === 0 ) {
				return {
					success: false,
					message:
						'Failed to create blocks. The generated content could not be converted to valid blocks.',
				};
			}

			replaceEditorBlocks( blocks );

			return {
				success: true,
				topic,
				blockCount: blocks.length,
				usedFallback,
				message: `Generated ${ blocks.length } block(s) about "${ topic }".`,
			};
		},

		requiresConfirmation: true,
	} );
}

export default registerContentGenerate;
