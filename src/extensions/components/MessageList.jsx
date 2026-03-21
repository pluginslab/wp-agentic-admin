/**
 * MessageList Component
 *
 * Renders a scrollable list of messages with auto-scroll to bottom.
 *
 */

import { useEffect, useRef } from '@wordpress/element';
import MessageItem from './MessageItem';

/**
 * MessageList component
 *
 * @param {Object}        props               - Component props
 * @param {Array}         props.messages      - Array of message objects
 * @param {boolean}       props.feedbackOptIn - Whether the user has opted in to feedback
 * @param {Function|null} props.onFeedback    - Called with (messageId, rating) on thumb click
 * @param {Function} props.onAction - Callback to execute an ability action
 * @return {JSX.Element} Rendered message list
 */
const MessageList = ( {
	messages,
	feedbackOptIn = false,
	onFeedback = null,
	onAction,
} ) => {
	const listRef = useRef( null );

	// Auto-scroll to bottom when new messages arrive
	useEffect( () => {
		if ( listRef.current ) {
			listRef.current.scrollTop = listRef.current.scrollHeight;
		}
	}, [ messages ] );

	return (
		<div
			className="wp-agentic-admin-messages"
			ref={ listRef }
			role="log"
			aria-live="polite"
			aria-label="Chat messages"
		>
			{ messages.map( ( message ) => (
				<MessageItem
					key={ message.id }
					message={ message }
					feedbackOptIn={ feedbackOptIn }
					onFeedback={ onFeedback }
					onAction={ onAction }
				/>
			) ) }
		</div>
	);
};

export default MessageList;
