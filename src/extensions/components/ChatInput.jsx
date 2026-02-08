/**
 * ChatInput Component
 *
 * Text input area with send button for the chat interface.
 *
 */

import { useState, useRef, useEffect } from '@wordpress/element';

/**
 * ChatInput component
 *
 * @param {Object}   props             - Component props
 * @param {Function} props.onSend      - Callback when message is sent
 * @param {boolean}  props.disabled    - Whether input is disabled
 * @param {string}   props.placeholder - Placeholder text
 * @param {boolean}  props.isLoading   - Whether a request is in progress
 * @return {JSX.Element} Rendered chat input
 */
const ChatInput = ( {
	onSend,
	disabled = false,
	placeholder = 'Type your message...',
	isLoading = false,
} ) => {
	const [ message, setMessage ] = useState( '' );
	const textareaRef = useRef( null );

	// Focus textarea on mount if not disabled
	useEffect( () => {
		if ( ! disabled && textareaRef.current ) {
			textareaRef.current.focus();
		}
	}, [ disabled ] );

	/**
	 * Handle form submission
	 *
	 * @param {Event} e - Submit event
	 */
	const handleSubmit = ( e ) => {
		e.preventDefault();

		const trimmedMessage = message.trim();
		if ( ! trimmedMessage || disabled || isLoading ) {
			return;
		}

		onSend( trimmedMessage );
		setMessage( '' );
	};

	/**
	 * Handle keydown for Enter to send (Shift+Enter for new line)
	 *
	 * @param {KeyboardEvent} e - Keyboard event
	 */
	const handleKeyDown = ( e ) => {
		if ( e.key === 'Enter' && ! e.shiftKey ) {
			e.preventDefault();
			handleSubmit( e );
		}
	};

	/**
	 * Handle textarea change
	 *
	 * @param {Event} e - Change event
	 */
	const handleChange = ( e ) => {
		setMessage( e.target.value );
	};

	const isDisabled = disabled || isLoading;

	return (
		<div className="wp-agentic-admin-input-area">
			<textarea
				ref={ textareaRef }
				className="wp-agentic-admin-input"
				value={ message }
				onChange={ handleChange }
				onKeyDown={ handleKeyDown }
				placeholder={
					isDisabled ? 'Load the AI model first...' : placeholder
				}
				rows="3"
				disabled={ isDisabled }
			/>
			<div className="wp-agentic-admin-input-hint">
				Enter to send, Shift+Enter for new line
			</div>
		</div>
	);
};

export default ChatInput;
