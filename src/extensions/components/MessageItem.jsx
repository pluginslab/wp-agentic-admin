/**
 * MessageItem Component
 *
 * Renders a single message in the chat interface with Perplexity-style UI.
 * Features vertical timeline, typography hierarchy, and collapsible tool results.
 *
 */

import { useState } from '@wordpress/element';
import { createLogger } from '../utils/logger';
import { getMessageRating } from '../services/feedback';

const log = createLogger( 'MessageItem' );

/**
 * Message type constants
 * Using string literals for compatibility with converted messages
 */
const MessageType = {
	USER: 'user',
	ASSISTANT: 'assistant',
	SYSTEM: 'system',
	ABILITY_REQUEST: 'ability_request',
	ABILITY_RESULT: 'ability_result',
	ERROR: 'error',
};

/**
 * Format timestamp for display
 *
 * @param {string} timestamp - ISO timestamp
 * @return {string} Formatted time
 */
const formatTime = ( timestamp ) => {
	const date = new Date( timestamp );
	return date.toLocaleTimeString( [], {
		hour: '2-digit',
		minute: '2-digit',
	} );
};

/**
 * Split message content into text and fenced code block segments.
 *
 * @param {string} text - Full message content
 * @return {Array<{type:'text'|'code', content:string, lang?:string, partial?:boolean}>} Parsed blocks — partial is true for unclosed fences during streaming
 */
const parseBlocks = ( text ) => {
	if ( ! text ) {
		return [];
	}

	const blocks = [];
	const fenceRe = /```(\w*)\n([\s\S]*?)```/g;
	let lastIndex = 0;
	let match;

	while ( ( match = fenceRe.exec( text ) ) !== null ) {
		if ( match.index > lastIndex ) {
			blocks.push( {
				type: 'text',
				content: text.slice( lastIndex, match.index ),
			} );
		}
		blocks.push( {
			type: 'code',
			lang: match[ 1 ] || '',
			content: match[ 2 ],
			partial: false,
		} );
		lastIndex = match.index + match[ 0 ].length;
	}

	// Handle an in-progress (unclosed) fenced code block during streaming.
	const remaining = text.slice( lastIndex );
	const openFence = remaining.match( /```(\w*)\n([\s\S]*)$/ );
	if ( openFence ) {
		const textBefore = remaining.slice( 0, openFence.index );
		if ( textBefore ) {
			blocks.push( { type: 'text', content: textBefore } );
		}
		blocks.push( {
			type: 'code',
			lang: openFence[ 1 ] || '',
			content: openFence[ 2 ],
			partial: true,
		} );
	} else if ( remaining ) {
		blocks.push( { type: 'text', content: remaining } );
	}

	return blocks;
};

/**
 * Code block component with language badge and copy button.
 *
 * @param {Object}  props         - Component props
 * @param {string}  props.lang    - Language identifier (e.g. 'php', 'apache')
 * @param {string}  props.code    - Raw code content
 * @param {boolean} props.partial - True while the block is still streaming
 * @return {JSX.Element} Rendered code block
 */
const CodeBlock = ( { lang, code, partial = false } ) => {
	const [ codeCopied, setCodeCopied ] = useState( false );

	const handleCodeCopy = async () => {
		try {
			await navigator.clipboard.writeText( code );
			setCodeCopied( true );
			setTimeout( () => setCodeCopied( false ), 2000 );
		} catch ( err ) {
			// Clipboard not available
		}
	};

	return (
		<div className="agentic-code-block">
			<div className="agentic-code-block__header">
				<span className="agentic-code-block__lang">
					{ lang || 'code' }
				</span>
				{ ! partial && (
					<button
						className={ `agentic-code-block__copy ${
							codeCopied ? 'agentic-code-block__copy--copied' : ''
						}` }
						onClick={ handleCodeCopy }
						type="button"
						title={ codeCopied ? 'Copied!' : 'Copy code' }
					>
						{ codeCopied ? (
							<svg
								width="13"
								height="13"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						) : (
							<svg
								width="13"
								height="13"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<rect
									x="9"
									y="9"
									width="13"
									height="13"
									rx="2"
									ry="2"
								/>
								<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
							</svg>
						) }
						<span className="agentic-code-block__copy-label">
							{ codeCopied ? 'Copied!' : 'Copy' }
						</span>
					</button>
				) }
			</div>
			<pre className="agentic-code-block__body">
				<code>{ code }</code>
			</pre>
		</div>
	);
};

/**
 * Parse simple markdown to React elements
 * Supports: **bold**, `code`, and line breaks
 *
 * @param {string} text - Text with markdown
 * @return {Array} Array of React elements
 */
const parseMarkdown = ( text ) => {
	if ( ! text ) {
		return null;
	}

	const parts = [];
	let remaining = text;
	let keyIndex = 0;

	// Process the text character by character looking for markdown patterns
	while ( remaining.length > 0 ) {
		// Check for bold **text**
		const boldMatch = remaining.match( /^\*\*(.+?)\*\*/ );
		if ( boldMatch ) {
			parts.push(
				<strong key={ keyIndex++ }>
					{ parseMarkdown( boldMatch[ 1 ] ) }
				</strong>
			);
			remaining = remaining.slice( boldMatch[ 0 ].length );
			continue;
		}

		// Check for inline code `text`
		const codeMatch = remaining.match( /^`(.+?)`/ );
		if ( codeMatch ) {
			parts.push( <code key={ keyIndex++ }>{ codeMatch[ 1 ] }</code> );
			remaining = remaining.slice( codeMatch[ 0 ].length );
			continue;
		}

		// Find next special character or end of string
		const nextSpecial = remaining.search( /\*\*|`/ );
		if ( nextSpecial === -1 ) {
			// No more markdown, add rest as text
			parts.push( remaining );
			break;
		} else if ( nextSpecial === 0 ) {
			// Special char at start but didn't match pattern, treat as text
			parts.push( remaining[ 0 ] );
			remaining = remaining.slice( 1 );
		} else {
			// Add text before special char
			parts.push( remaining.slice( 0, nextSpecial ) );
			remaining = remaining.slice( nextSpecial );
		}
	}

	return parts;
};

/**
 * Render ability result as formatted output
 *
 * @param {Object} result - Ability execution result
 * @return {string} Formatted result
 */
const formatAbilityResult = ( result ) => {
	if ( typeof result === 'string' ) {
		return result;
	}
	return JSON.stringify( result, null, 2 );
};

/**
 * Get a friendly label for ability IDs
 *
 * @param {string} abilityId - Full ability ID
 * @return {string} Friendly label
 */
const getAbilityLabel = ( abilityId ) => {
	const labels = {
		'wp-agentic-admin/error-log-read': 'Reading error log',
		'wp-agentic-admin/site-health': 'Checking site health',
		'wp-agentic-admin/plugin-list': 'Listing plugins',
		'wp-agentic-admin/cache-flush': 'Flushing cache',
		'wp-agentic-admin/db-optimize': 'Optimizing database',
		'wp-agentic-admin/plugin-deactivate': 'Deactivating plugin',
	};
	return labels[ abilityId ] || abilityId;
};

/**
 * MessageItem component
 *
 * @param {Object}        props               - Component props
 * @param {Object}        props.message       - Message object
 * @param {boolean}       props.feedbackOptIn - Whether the user has opted in to feedback
 * @param {Function|null} props.onFeedback    - Called with (messageId, rating) when a thumb is clicked
 * @return {JSX.Element} Rendered message
 */
const MessageItem = ( {
	message,
	feedbackOptIn = false,
	onFeedback = null,
} ) => {
	const { type, content, timestamp, prefillTps, decodeTps } = message;
	const [ isExpanded, setIsExpanded ] = useState( false );
	const [ copied, setCopied ] = useState( false );
	const [ rating, setRating ] = useState( () =>
		feedbackOptIn ? getMessageRating( message.id ) : null
	);

	/**
	 * Copy message content to clipboard
	 */
	const handleCopy = async () => {
		try {
			// Strip markdown for cleaner copy
			const plainText = content
				.replace( /\*\*(.+?)\*\*/g, '$1' ) // Remove bold markers
				.replace( /`(.+?)`/g, '$1' ); // Remove code markers

			await navigator.clipboard.writeText( plainText );
			setCopied( true );
			setTimeout( () => setCopied( false ), 2000 );
		} catch ( err ) {
			log.error( 'Failed to copy:', err );
		}
	};

	/**
	 * Handle thumbs-up / thumbs-down click
	 *
	 * @param {string} newRating - 'up' or 'down'
	 */
	const handleRating = ( newRating ) => {
		const next = rating === newRating ? null : newRating;
		setRating( next );
		if ( onFeedback ) {
			onFeedback( message.id, next );
		}
	};

	// Handle both legacy meta-wrapped format and new flattened format
	const meta = message.meta || {
		abilityId: message.abilityName,
		result: message.result,
		success: message.success,
		error: message.error,
		params: message.input,
	};

	// User message - simple bubble on the right
	if ( type === MessageType.USER ) {
		return (
			<div className="agentic-message agentic-message--user">
				<div className="agentic-message__bubble">
					<p>{ content }</p>
				</div>
				<div className="agentic-message__time">
					{ formatTime( timestamp ) }
				</div>
			</div>
		);
	}

	// Thinking block — streams live, then collapses into peekable timeline entry
	if ( type === 'thinking' ) {
		const thinkingIsStreaming = message.isStreaming;

		return (
			<div className="agentic-message agentic-message--tool">
				<div className="agentic-timeline">
					<div className="agentic-timeline__line" />
					<div
						className={ `agentic-timeline__dot agentic-timeline__dot--${
							thinkingIsStreaming ? 'thinking' : 'tool'
						}` }
					/>
				</div>
				<div
					className={ `agentic-tool ${
						thinkingIsStreaming ? '' : 'agentic-tool--thinking-done'
					}` }
				>
					<button
						className="agentic-tool__header agentic-tool__header--clickable"
						onClick={ () => setIsExpanded( ! isExpanded ) }
						type="button"
					>
						<span className="agentic-tool__icon">
							{ thinkingIsStreaming ? (
								<span className="agentic-tool__spinner" />
							) : (
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<circle cx="12" cy="12" r="10" />
									<path d="M12 16v-4" />
									<path d="M12 8h.01" />
								</svg>
							) }
						</span>
						<span className="agentic-tool__label">
							{ thinkingIsStreaming
								? 'Thinking...'
								: 'Thought process' }
						</span>
						<span
							className={ `agentic-tool__expand ${
								isExpanded ? 'agentic-tool__expand--open' : ''
							}` }
						>
							<svg
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<polyline points="6 9 12 15 18 9" />
							</svg>
						</span>
					</button>
					{ ( isExpanded || thinkingIsStreaming ) && (
						<div className="agentic-tool__result agentic-tool__result--thinking">
							<p className="agentic-thinking__text">
								{ content }
								{ thinkingIsStreaming && '▊' }
							</p>
						</div>
					) }
				</div>
			</div>
		);
	}

	// Loading indicator (inline in message flow)
	if ( type === 'loading' ) {
		return (
			<div className="agentic-message agentic-message--loading">
				<div className="agentic-timeline">
					<div className="agentic-timeline__line" />
					<div className="agentic-timeline__dot agentic-timeline__dot--loading" />
				</div>
				<div className="agentic-loading">
					<div className="agentic-loading__spinner" />
					<span className="agentic-loading__text">{ content }</span>
				</div>
			</div>
		);
	}

	// System/welcome message
	if ( type === MessageType.SYSTEM ) {
		// Parse content and group list items together
		const lines = content.split( '\n' );
		const elements = [];
		let listItems = [];
		let keyIndex = 0;

		const flushListItems = () => {
			if ( listItems.length > 0 ) {
				elements.push(
					<ul key={ `ul-${ keyIndex++ }` }>
						{ listItems.map( ( item, i ) => (
							<li key={ i }>{ item }</li>
						) ) }
					</ul>
				);
				listItems = [];
			}
		};

		lines.forEach( ( line ) => {
			if ( line.startsWith( '**' ) && line.endsWith( '**' ) ) {
				flushListItems();
				elements.push(
					<h3 key={ keyIndex++ }>{ line.replace( /\*\*/g, '' ) }</h3>
				);
			} else if ( line.startsWith( '- ' ) ) {
				listItems.push( line.substring( 2 ) );
			} else if ( line.startsWith( '*' ) && line.endsWith( '*' ) ) {
				flushListItems();
				elements.push(
					<p key={ keyIndex++ } className="agentic-message__hint">
						{ line.replace( /\*/g, '' ) }
					</p>
				);
			} else if ( line.trim() !== '' ) {
				flushListItems();
				elements.push( <p key={ keyIndex++ }>{ line }</p> );
			}
		} );

		// Flush any remaining list items
		flushListItems();

		return (
			<div className="agentic-message agentic-message--system">
				<div className="agentic-message__content">{ elements }</div>
			</div>
		);
	}

	// Assistant message with timeline
	if ( type === MessageType.ASSISTANT ) {
		// Check if this message contains ability tags (tool call)
		const hasAbilityCall = content.includes( '<ability' );

		// Parse out the non-ability content for display
		let displayContent = content;
		if ( hasAbilityCall ) {
			// Remove ability tags from display, we show them separately
			displayContent = content
				.replace( /<ability[^>]*>[\s\S]*?<\/ability>/g, '' )
				.trim();
		}

		return (
			<div className="agentic-message agentic-message--assistant">
				<div className="agentic-timeline">
					<div className="agentic-timeline__line" />
					<div className="agentic-timeline__dot" />
				</div>
				<div className="agentic-message__content">
					{ displayContent && (
						<div className="agentic-message__text">
							{ parseBlocks( displayContent ).map(
								( block, blockIndex ) => {
									if ( block.type === 'code' ) {
										return (
											<CodeBlock
												key={ blockIndex }
												lang={ block.lang }
												code={ block.content }
												partial={ block.partial }
											/>
										);
									}
									return block.content
										.split( '\n' )
										.map( ( line, lineIndex ) => {
											if ( line.trim() === '' ) {
												return null;
											}
											return (
												<p
													key={ `${ blockIndex }-${ lineIndex }` }
												>
													{ parseMarkdown( line ) }
												</p>
											);
										} );
								}
							) }
						</div>
					) }
					<div className="agentic-message__footer">
						<div className="agentic-message__time">
							{ formatTime( timestamp ) }
							{ decodeTps && (
								<span className="agentic-message__stats">
									{ prefillTps
										? `PS ${ prefillTps } t/s · GS ${ decodeTps } t/s`
										: `GS ${ decodeTps } t/s` }
								</span>
							) }
						</div>
						<div className="agentic-message__actions">
							{ feedbackOptIn && (
								<div className="agentic-message__feedback">
									<button
										type="button"
										className={ `agentic-message__thumb ${
											rating === 'up'
												? 'agentic-message__thumb--active'
												: ''
										}` }
										onClick={ () => handleRating( 'up' ) }
										title="Good response"
									>
										<svg
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill={
												rating === 'up'
													? 'currentColor'
													: 'none'
											}
											stroke="currentColor"
											strokeWidth="2"
										>
											<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
											<path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
										</svg>
									</button>
									<button
										type="button"
										className={ `agentic-message__thumb ${
											rating === 'down'
												? 'agentic-message__thumb--active agentic-message__thumb--down'
												: ''
										}` }
										onClick={ () => handleRating( 'down' ) }
										title="Poor response"
									>
										<svg
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill={
												rating === 'down'
													? 'currentColor'
													: 'none'
											}
											stroke="currentColor"
											strokeWidth="2"
										>
											<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
											<path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
										</svg>
									</button>
								</div>
							) }
							<button
								className={ `agentic-message__copy ${
									copied
										? 'agentic-message__copy--copied'
										: ''
								}` }
								onClick={ handleCopy }
								type="button"
								title={
									copied ? 'Copied!' : 'Copy to clipboard'
								}
							>
								{ copied ? (
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								) : (
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<rect
											x="9"
											y="9"
											width="13"
											height="13"
											rx="2"
											ry="2"
										/>
										<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
									</svg>
								) }
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Ability request - compact inline indicator
	if ( type === MessageType.ABILITY_REQUEST ) {
		return (
			<div className="agentic-message agentic-message--tool">
				<div className="agentic-timeline">
					<div className="agentic-timeline__line" />
					<div className="agentic-timeline__dot agentic-timeline__dot--tool" />
				</div>
				<div className="agentic-tool">
					<div className="agentic-tool__header">
						<span className="agentic-tool__icon">
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<circle cx="12" cy="12" r="3" />
								<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
							</svg>
						</span>
						<span className="agentic-tool__label">
							{ getAbilityLabel( meta?.abilityId ) }
						</span>
						<span className="agentic-tool__status agentic-tool__status--pending">
							<span className="agentic-tool__spinner" />
						</span>
						<span className="agentic-tool__id">
							{ meta?.abilityId }
						</span>
					</div>
				</div>
			</div>
		);
	}

	// Ability result - collapsible with success/error state
	if ( type === MessageType.ABILITY_RESULT ) {
		const isSuccess = meta?.success;

		return (
			<div className="agentic-message agentic-message--tool">
				<div className="agentic-timeline">
					<div className="agentic-timeline__line" />
					<div
						className={ `agentic-timeline__dot agentic-timeline__dot--${
							isSuccess ? 'success' : 'error'
						}` }
					/>
				</div>
				<div
					className={ `agentic-tool agentic-tool--${
						isSuccess ? 'success' : 'error'
					}` }
				>
					<button
						className="agentic-tool__header agentic-tool__header--clickable"
						onClick={ () => setIsExpanded( ! isExpanded ) }
						type="button"
					>
						<span className="agentic-tool__icon">
							{ isSuccess ? (
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<polyline points="20 6 9 17 4 12" />
								</svg>
							) : (
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<circle cx="12" cy="12" r="10" />
									<line x1="15" y1="9" x2="9" y2="15" />
									<line x1="9" y1="9" x2="15" y2="15" />
								</svg>
							) }
						</span>
						<span className="agentic-tool__label">
							{ isSuccess ? 'Completed' : 'Failed' }
						</span>
						<span
							className={ `agentic-tool__expand ${
								isExpanded ? 'agentic-tool__expand--open' : ''
							}` }
						>
							<svg
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<polyline points="6 9 12 15 18 9" />
							</svg>
						</span>
						<span className="agentic-tool__id">
							{ meta?.abilityId }
						</span>
					</button>
					{ isExpanded && (
						<div className="agentic-tool__result">
							<pre>{ formatAbilityResult( meta?.result ) }</pre>
						</div>
					) }
				</div>
			</div>
		);
	}

	// Error message
	if ( type === MessageType.ERROR ) {
		return (
			<div className="agentic-message agentic-message--error">
				<div className="agentic-timeline">
					<div className="agentic-timeline__line" />
					<div className="agentic-timeline__dot agentic-timeline__dot--error" />
				</div>
				<div className="agentic-error">
					<span className="agentic-error__icon">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
					</span>
					<span className="agentic-error__text">{ content }</span>
				</div>
			</div>
		);
	}

	// Default fallback
	return (
		<div className="agentic-message">
			<div className="agentic-message__content">
				<p>{ content }</p>
			</div>
		</div>
	);
};

export default MessageItem;
