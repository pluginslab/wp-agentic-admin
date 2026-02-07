/**
 * MessageItem Component
 *
 * Renders a single message in the chat interface with Perplexity-style UI.
 * Features vertical timeline, typography hierarchy, and collapsible tool results.
 *
 */

import { useState } from '@wordpress/element';

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
const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Parse simple markdown to React elements
 * Supports: **bold**, `code`, and line breaks
 *
 * @param {string} text - Text with markdown
 * @return {Array} Array of React elements
 */
const parseMarkdown = (text) => {
    if (!text) return null;
    
    const parts = [];
    let remaining = text;
    let keyIndex = 0;
    
    // Process the text character by character looking for markdown patterns
    while (remaining.length > 0) {
        // Check for bold **text**
        const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
        if (boldMatch) {
            parts.push(<strong key={keyIndex++}>{boldMatch[1]}</strong>);
            remaining = remaining.slice(boldMatch[0].length);
            continue;
        }
        
        // Check for inline code `text`
        const codeMatch = remaining.match(/^`(.+?)`/);
        if (codeMatch) {
            parts.push(<code key={keyIndex++}>{codeMatch[1]}</code>);
            remaining = remaining.slice(codeMatch[0].length);
            continue;
        }
        
        // Find next special character or end of string
        const nextSpecial = remaining.search(/\*\*|`/);
        if (nextSpecial === -1) {
            // No more markdown, add rest as text
            parts.push(remaining);
            break;
        } else if (nextSpecial === 0) {
            // Special char at start but didn't match pattern, treat as text
            parts.push(remaining[0]);
            remaining = remaining.slice(1);
        } else {
            // Add text before special char
            parts.push(remaining.slice(0, nextSpecial));
            remaining = remaining.slice(nextSpecial);
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
const formatAbilityResult = (result) => {
    if (typeof result === 'string') {
        return result;
    }
    return JSON.stringify(result, null, 2);
};

/**
 * Get a friendly label for ability IDs
 *
 * @param {string} abilityId - Full ability ID
 * @return {string} Friendly label
 */
const getAbilityLabel = (abilityId) => {
    const labels = {
        'wp-agentic-admin/error-log-read': 'Reading error log',
        'wp-agentic-admin/site-health': 'Checking site health',
        'wp-agentic-admin/plugin-list': 'Listing plugins',
        'wp-agentic-admin/cache-flush': 'Flushing cache',
        'wp-agentic-admin/db-optimize': 'Optimizing database',
        'wp-agentic-admin/plugin-deactivate': 'Deactivating plugin',
    };
    return labels[abilityId] || abilityId;
};

/**
 * MessageItem component
 *
 * @param {Object} props - Component props
 * @param {Object} props.message - Message object
 * @return {JSX.Element} Rendered message
 */
const MessageItem = ({ message }) => {
    const { type, content, timestamp } = message;
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    /**
     * Copy message content to clipboard
     */
    const handleCopy = async () => {
        try {
            // Strip markdown for cleaner copy
            const plainText = content
                .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold markers
                .replace(/`(.+?)`/g, '$1'); // Remove code markers
            
            await navigator.clipboard.writeText(plainText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
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
    if (type === MessageType.USER) {
        return (
            <div className="agentic-message agentic-message--user">
                <div className="agentic-message__bubble">
                    <p>{content}</p>
                </div>
                <div className="agentic-message__time">{formatTime(timestamp)}</div>
            </div>
        );
    }

    // System/welcome message
    if (type === MessageType.SYSTEM) {
        // Parse content and group list items together
        const lines = content.split('\n');
        const elements = [];
        let listItems = [];
        let keyIndex = 0;

        const flushListItems = () => {
            if (listItems.length > 0) {
                elements.push(
                    <ul key={`ul-${keyIndex++}`}>
                        {listItems.map((item, i) => (
                            <li key={i}>{item}</li>
                        ))}
                    </ul>
                );
                listItems = [];
            }
        };

        lines.forEach((line) => {
            if (line.startsWith('**') && line.endsWith('**')) {
                flushListItems();
                elements.push(<h3 key={keyIndex++}>{line.replace(/\*\*/g, '')}</h3>);
            } else if (line.startsWith('- ')) {
                listItems.push(line.substring(2));
            } else if (line.startsWith('*') && line.endsWith('*')) {
                flushListItems();
                elements.push(
                    <p key={keyIndex++} className="agentic-message__hint">
                        {line.replace(/\*/g, '')}
                    </p>
                );
            } else if (line.trim() !== '') {
                flushListItems();
                elements.push(<p key={keyIndex++}>{line}</p>);
            }
        });

        // Flush any remaining list items
        flushListItems();

        return (
            <div className="agentic-message agentic-message--system">
                <div className="agentic-message__content">
                    {elements}
                </div>
            </div>
        );
    }

    // Assistant message with timeline
    if (type === MessageType.ASSISTANT) {
        // Check if this message contains ability tags (tool call)
        const hasAbilityCall = content.includes('<ability');
        
        // Parse out the non-ability content for display
        let displayContent = content;
        if (hasAbilityCall) {
            // Remove ability tags from display, we show them separately
            displayContent = content.replace(/<ability[^>]*>[\s\S]*?<\/ability>/g, '').trim();
        }

        return (
            <div className="agentic-message agentic-message--assistant">
                <div className="agentic-timeline">
                    <div className="agentic-timeline__line" />
                    <div className="agentic-timeline__dot" />
                </div>
                <div className="agentic-message__content">
                    {displayContent && (
                        <div className="agentic-message__text">
                            {displayContent.split('\n').map((line, index) => {
                                if (line.trim() === '') return null;
                                return <p key={index}>{parseMarkdown(line)}</p>;
                            })}
                        </div>
                    )}
                    <div className="agentic-message__footer">
                        <div className="agentic-message__time">{formatTime(timestamp)}</div>
                        <button 
                            className={`agentic-message__copy ${copied ? 'agentic-message__copy--copied' : ''}`}
                            onClick={handleCopy}
                            type="button"
                            title={copied ? 'Copied!' : 'Copy to clipboard'}
                        >
                            {copied ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Ability request - compact inline indicator
    if (type === MessageType.ABILITY_REQUEST) {
        return (
            <div className="agentic-message agentic-message--tool">
                <div className="agentic-timeline">
                    <div className="agentic-timeline__line" />
                    <div className="agentic-timeline__dot agentic-timeline__dot--tool" />
                </div>
                <div className="agentic-tool">
                    <div className="agentic-tool__header">
                        <span className="agentic-tool__icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                        </span>
                        <span className="agentic-tool__label">
                            {getAbilityLabel(meta?.abilityId)}
                        </span>
                        <span className="agentic-tool__status agentic-tool__status--pending">
                            <span className="agentic-tool__spinner" />
                        </span>
                        <span className="agentic-tool__id">{meta?.abilityId}</span>
                    </div>
                </div>
            </div>
        );
    }

    // Ability result - collapsible with success/error state
    if (type === MessageType.ABILITY_RESULT) {
        const isSuccess = meta?.success;
        
        return (
            <div className="agentic-message agentic-message--tool">
                <div className="agentic-timeline">
                    <div className="agentic-timeline__line" />
                    <div className={`agentic-timeline__dot agentic-timeline__dot--${isSuccess ? 'success' : 'error'}`} />
                </div>
                <div className={`agentic-tool agentic-tool--${isSuccess ? 'success' : 'error'}`}>
                    <button 
                        className="agentic-tool__header agentic-tool__header--clickable"
                        onClick={() => setIsExpanded(!isExpanded)}
                        type="button"
                    >
                        <span className="agentic-tool__icon">
                            {isSuccess ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="15" y1="9" x2="9" y2="15"/>
                                    <line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                            )}
                        </span>
                        <span className="agentic-tool__label">
                            {isSuccess ? 'Completed' : 'Failed'}
                        </span>
                        <span className={`agentic-tool__expand ${isExpanded ? 'agentic-tool__expand--open' : ''}`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </span>
                        <span className="agentic-tool__id">{meta?.abilityId}</span>
                    </button>
                    {isExpanded && (
                        <div className="agentic-tool__result">
                            <pre>{formatAbilityResult(meta?.result)}</pre>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Error message
    if (type === MessageType.ERROR) {
        return (
            <div className="agentic-message agentic-message--error">
                <div className="agentic-timeline">
                    <div className="agentic-timeline__line" />
                    <div className="agentic-timeline__dot agentic-timeline__dot--error" />
                </div>
                <div className="agentic-error">
                    <span className="agentic-error__icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    </span>
                    <span className="agentic-error__text">{content}</span>
                </div>
            </div>
        );
    }

    // Default fallback
    return (
        <div className="agentic-message">
            <div className="agentic-message__content">
                <p>{content}</p>
            </div>
        </div>
    );
};

export default MessageItem;
