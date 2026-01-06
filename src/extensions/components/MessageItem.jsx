/**
 * MessageItem Component
 *
 * Renders a single message in the chat interface.
 *
 * @package WPNeuralAdmin
 */

import { MessageType } from '../services/chat-history';

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
 * MessageItem component
 *
 * @param {Object} props - Component props
 * @param {Object} props.message - Message object
 * @return {JSX.Element} Rendered message
 */
const MessageItem = ({ message }) => {
    const { type, content, timestamp, meta } = message;

    // Determine CSS class based on message type
    const getMessageClass = () => {
        switch (type) {
            case MessageType.USER:
                return 'wp-neural-admin-message--user';
            case MessageType.ASSISTANT:
                return 'wp-neural-admin-message--assistant';
            case MessageType.SYSTEM:
                return 'wp-neural-admin-message--system';
            case MessageType.ABILITY_REQUEST:
                return 'wp-neural-admin-message--ability-request';
            case MessageType.ABILITY_RESULT:
                return 'wp-neural-admin-message--ability-result';
            case MessageType.ERROR:
                return 'wp-neural-admin-message--error';
            default:
                return '';
        }
    };

    // Render system message with markdown-like formatting
    const renderSystemContent = () => {
        // Simple markdown parsing for bold and lists
        const lines = content.split('\n');
        return lines.map((line, index) => {
            // Bold text
            const boldParsed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            // Italic text
            const italicParsed = boldParsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
            
            // List items
            if (line.startsWith('- ')) {
                return (
                    <li key={index} dangerouslySetInnerHTML={{ __html: italicParsed.substring(2) }} />
                );
            }
            
            // Empty lines
            if (line.trim() === '') {
                return <br key={index} />;
            }
            
            return (
                <p key={index} dangerouslySetInnerHTML={{ __html: italicParsed }} />
            );
        });
    };

    // Render ability request
    const renderAbilityRequest = () => {
        const statusClass = meta?.status === 'pending' 
            ? 'wp-neural-admin-ability--pending' 
            : meta?.status === 'success'
                ? 'wp-neural-admin-ability--success'
                : 'wp-neural-admin-ability--error';

        return (
            <div className={`wp-neural-admin-ability ${statusClass}`}>
                <div className="wp-neural-admin-ability__header">
                    <span className="dashicons dashicons-admin-generic" />
                    <span>{meta?.label || 'Executing ability...'}</span>
                </div>
                {meta?.input && Object.keys(meta.input).length > 0 && (
                    <div className="wp-neural-admin-ability__input">
                        <small>Input:</small>
                        <pre>{JSON.stringify(meta.input, null, 2)}</pre>
                    </div>
                )}
            </div>
        );
    };

    // Render ability result
    const renderAbilityResult = () => {
        const statusClass = meta?.success 
            ? 'wp-neural-admin-ability--success' 
            : 'wp-neural-admin-ability--error';

        return (
            <div className={`wp-neural-admin-ability ${statusClass}`}>
                <div className="wp-neural-admin-ability__header">
                    <span className={`dashicons ${meta?.success ? 'dashicons-yes-alt' : 'dashicons-warning'}`} />
                    <span>{meta?.success ? 'Success' : 'Failed'}</span>
                </div>
                <div className="wp-neural-admin-ability__result">
                    <pre>{formatAbilityResult(meta?.result)}</pre>
                </div>
            </div>
        );
    };

    // Render error message
    const renderError = () => {
        return (
            <div className="wp-neural-admin-error-content">
                <span className="dashicons dashicons-warning" />
                <span>{content}</span>
                {meta?.error && (
                    <pre>{meta.error}</pre>
                )}
            </div>
        );
    };

    // Render content based on message type
    const renderContent = () => {
        switch (type) {
            case MessageType.SYSTEM:
                return <div className="wp-neural-admin-message__content">{renderSystemContent()}</div>;
            case MessageType.ABILITY_REQUEST:
                return renderAbilityRequest();
            case MessageType.ABILITY_RESULT:
                return renderAbilityResult();
            case MessageType.ERROR:
                return <div className="wp-neural-admin-message__content">{renderError()}</div>;
            default:
                return (
                    <div className="wp-neural-admin-message__content">
                        <p>{content}</p>
                    </div>
                );
        }
    };

    return (
        <div className={`wp-neural-admin-message ${getMessageClass()}`}>
            {renderContent()}
            {type !== MessageType.SYSTEM && (
                <div className="wp-neural-admin-message__meta">
                    {formatTime(timestamp)}
                </div>
            )}
        </div>
    );
};

export default MessageItem;
