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
 * @param {Object}   props                   - Component props
 * @param {Array}    props.messages          - Array of message objects
 * @param {Function} props.onSuggestionClick - Called with suggestion label when a pill is clicked
 * @return {JSX.Element} Rendered message list
 */
const MessageList = ( { messages, onSuggestionClick } ) => {
	const listRef = useRef( null );

	// Auto-scroll to bottom when new messages arrive
	useEffect( () => {
		if ( listRef.current ) {
			listRef.current.scrollTop = listRef.current.scrollHeight;
		}
	}, [ messages ] );

	return (
		<div className="wp-agentic-admin-messages" ref={ listRef }>
			{ messages.map( ( message ) => (
				<MessageItem
					key={ message.id }
					message={ message }
					onSuggestionClick={ onSuggestionClick }
				/>
			) ) }
		</div>
	);
};

export default MessageList;
