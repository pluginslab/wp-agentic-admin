/**
 * MessageList Component
 *
 * Renders a scrollable list of messages with auto-scroll to bottom.
 *
 * @package WPNeuralAdmin
 */

import { useEffect, useRef } from '@wordpress/element';
import MessageItem from './MessageItem';

/**
 * MessageList component
 *
 * @param {Object} props - Component props
 * @param {Array} props.messages - Array of message objects
 * @return {JSX.Element} Rendered message list
 */
const MessageList = ({ messages }) => {
    const listRef = useRef(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="wp-neural-admin-messages" ref={listRef}>
            {messages.map((message) => (
                <MessageItem key={message.id} message={message} />
            ))}
        </div>
    );
};

export default MessageList;
