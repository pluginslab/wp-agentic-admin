/**
 * ChatInput Component
 *
 * Text input area with bundle selection, plus icon, and send button.
 *
 */

import { useState, useRef, useEffect } from '@wordpress/element';
import { Dropdown, Icon } from '@wordpress/components';
import {
	plus,
	send,
	closeSmall,
	shield,
	globe,
	plugins,
	tool,
	bug,
	post,
	info,
	edit,
} from '@wordpress/icons';
import ABILITY_BUNDLES from '../data/ability-bundles';
import pluginAbilitiesManager from '../services/plugin-abilities-manager';
import VoiceButton from './VoiceButton';

/**
 * Map of bundle icon names to @wordpress/icons components.
 */
const BUNDLE_ICONS = {
	shield,
	plugins,
	tool,
	bug,
	post,
	info,
	edit,
};

/**
 * ChatInput component
 *
 * @param {Object}   props               - Component props
 * @param {Function} props.onSend        - Callback when message is sent
 * @param {boolean}  props.disabled      - Whether input is disabled
 * @param {string}   props.placeholder   - Placeholder text
 * @param {boolean}  props.isLoading     - Whether a request is in progress
 * @param {Object}   props.defaultBundle - Bundle to auto-select on mount
 * @return {JSX.Element} Rendered chat input
 */
const ChatInput = ( {
	onSend,
	disabled = false,
	placeholder = 'Describe your issue or what you want to do… (hold Space to speak)',
	isLoading = false,
	defaultBundle = null,
} ) => {
	const [ message, setMessage ] = useState( '' );
	const [ selectedBundle, setSelectedBundle ] = useState( null );
	const [ webSearchEnabled, setWebSearchEnabled ] = useState( false );
	const [ docSearchEnabled, setDocSearchEnabled ] = useState( false );
	const [ pluginBundles, setPluginBundles ] = useState( [] );
	const [ voiceState, setVoiceState ] = useState( 'idle' );
	const textareaRef = useRef( null );
	const voiceButtonRef = useRef( null );
	const isSpaceDownRef = useRef( false );
	const spacePressTimerRef = useRef( null );

	// Cancel pending push-to-talk timer on unmount.
	useEffect( () => {
		return () => clearTimeout( spacePressTimerRef.current );
	}, [] );

	// Subscribe to plugin abilities manager for dynamic bundles
	useEffect( () => {
		const refresh = () => {
			setPluginBundles( pluginAbilitiesManager.getPluginBundles() );
		};
		refresh();
		return pluginAbilitiesManager.subscribe( refresh );
	}, [] );

	// Auto-select default bundle (e.g. when editing a new blank page)
	useEffect( () => {
		if ( defaultBundle && ! selectedBundle ) {
			setSelectedBundle( defaultBundle );
		}
	}, [ defaultBundle ] ); // eslint-disable-line react-hooks/exhaustive-deps -- only react to defaultBundle changes

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
		if ( e ) {
			e.preventDefault();
		}

		// Prevent accidental submit while recording or transcribing.
		if ( isVoiceActive ) {
			return;
		}

		const trimmedMessage = message.trim();
		if ( ! trimmedMessage || disabled || isLoading ) {
			return;
		}

		onSend( trimmedMessage, {
			bundleToolIds: selectedBundle?.abilities || null,
			bundleId: selectedBundle?.id || null,
			pluginNamespace: selectedBundle?.pluginNamespace || null,
			webSearch: webSearchEnabled,
			docSearch: docSearchEnabled,
		} );
		setMessage( '' );
	};

	/**
	 * Handle keydown: Enter sends, Space on empty input starts recording.
	 *
	 * A 200 ms threshold distinguishes a quick tap (insert space) from a
	 * deliberate hold (push-to-talk). The OS key-repeat delay is ~500 ms,
	 * so we also suppress repeat events once recording is active to prevent
	 * spaces from being inserted while the user holds the key.
	 *
	 * @param {KeyboardEvent} e - Keyboard event
	 */
	const handleKeyDown = ( e ) => {
		if ( e.key === 'Enter' && ! e.shiftKey ) {
			e.preventDefault();
			handleSubmit( e );
			return;
		}

		if ( e.key === ' ' ) {
			// Suppress OS key-repeat events while push-to-talk or its timer is active.
			if (
				isSpaceDownRef.current ||
				spacePressTimerRef.current !== null
			) {
				e.preventDefault();
				return;
			}

			// Empty input + idle: arm the 200 ms push-to-talk timer.
			if (
				message === '' &&
				voiceState === 'idle' &&
				! e.repeat &&
				! isDisabled
			) {
				e.preventDefault();
				spacePressTimerRef.current = setTimeout( () => {
					spacePressTimerRef.current = null;
					isSpaceDownRef.current = true;
					voiceButtonRef.current?.start();
				}, 200 );
			}
		}
	};

	/**
	 * Handle keyup: Space release either inserts a space (quick tap) or stops recording.
	 *
	 * @param {KeyboardEvent} e - Keyboard event
	 */
	const handleKeyUp = ( e ) => {
		if ( e.key !== ' ' ) {
			return;
		}

		if ( spacePressTimerRef.current !== null ) {
			// Released before the 200 ms threshold — treat as a normal space character.
			clearTimeout( spacePressTimerRef.current );
			spacePressTimerRef.current = null;
			setMessage( ( prev ) => prev + ' ' );
		} else if ( isSpaceDownRef.current ) {
			// Released after recording started — stop push-to-talk.
			isSpaceDownRef.current = false;
			voiceButtonRef.current?.stop();
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

	/**
	 * Set the final transcription result and focus the textarea for editing.
	 *
	 * @param {string} text - Final transcribed text from Whisper.
	 */
	const handleTranscript = ( text ) => {
		setMessage( text );
		// Give focus back so the user can immediately edit or send.
		requestAnimationFrame( () => textareaRef.current?.focus() );
	};

	const isDisabled = disabled || isLoading;
	const isVoiceActive = voiceState !== 'idle';
	const isTranscribing = voiceState === 'transcribing';
	const canSend = message.trim().length > 0 && ! isDisabled;
	// Mic is visible on an empty input, or while voice is active (recording /
	// transcribing) so the component stays mounted through the full cycle.
	const showMic = message === '' || isVoiceActive;

	return (
		<div className="wp-agentic-admin-input-area">
			<div
				className={ `wp-agentic-admin-input-wrapper${
					isDisabled
						? ' wp-agentic-admin-input-wrapper--disabled'
						: ''
				}${
					voiceState === 'recording'
						? ' wp-agentic-admin-input-wrapper--recording'
						: ''
				}` }
			>
				<div className="wp-agentic-admin-textarea-container">
					<textarea
						ref={ textareaRef }
						className="wp-agentic-admin-input"
						value={ message }
						onChange={ handleChange }
						onKeyDown={ handleKeyDown }
						onKeyUp={ handleKeyUp }
						placeholder={ placeholder }
						rows="3"
						disabled={ isDisabled }
					/>
					{ isTranscribing && (
						<div
							className="wp-agentic-admin-transcribing-overlay"
							aria-live="polite"
							aria-label="Transcribing audio"
						>
							<div className="wp-agentic-admin-transcribing-wave">
								<span />
								<span />
								<span />
								<span />
								<span />
							</div>
							<span className="wp-agentic-admin-transcribing-label">
								Transcribing…
							</span>
						</div>
					) }
				</div>
				<div className="wp-agentic-admin-input-toolbar">
					<div className="wp-agentic-admin-input-toolbar__left">
						<Dropdown
							popoverProps={ {
								placement: 'top-start',
								shift: true,
							} }
							renderToggle={ ( { isOpen, onToggle } ) => (
								<button
									type="button"
									className={ `wp-agentic-admin-bundle-trigger${
										isOpen
											? ' wp-agentic-admin-bundle-trigger--active'
											: ''
									}` }
									onClick={ onToggle }
									aria-expanded={ isOpen }
									aria-label="Select ability bundle"
									disabled={ isDisabled }
								>
									<Icon icon={ plus } size={ 24 } />
								</button>
							) }
							renderContent={ ( { onClose } ) => (
								<div className="wp-agentic-admin-bundle-menu">
									{ ABILITY_BUNDLES.map( ( bundle ) => (
										<button
											type="button"
											key={ bundle.id }
											className={ `wp-agentic-admin-bundle-menu__item${
												selectedBundle?.id === bundle.id
													? ' wp-agentic-admin-bundle-menu__item--selected'
													: ''
											}` }
											onClick={ () => {
												setSelectedBundle( bundle );
												onClose();
											} }
										>
											<Icon
												icon={
													BUNDLE_ICONS[
														bundle.icon
													] || shield
												}
												size={ 18 }
											/>
											<span className="wp-agentic-admin-bundle-menu__label">
												{ bundle.label }
											</span>
											<span className="wp-agentic-admin-bundle-menu__count">
												{ bundle.abilities.length }{ ' ' }
												tools
											</span>
										</button>
									) ) }
									{ pluginBundles.length > 0 && (
										<>
											<div className="wp-agentic-admin-bundle-menu__separator">
												<span>Plugin Abilities</span>
											</div>
											{ pluginBundles.map( ( bundle ) => (
												<button
													type="button"
													key={ bundle.id }
													className={ `wp-agentic-admin-bundle-menu__item${
														selectedBundle?.id ===
														bundle.id
															? ' wp-agentic-admin-bundle-menu__item--selected'
															: ''
													}` }
													onClick={ () => {
														setSelectedBundle(
															bundle
														);
														onClose();
													} }
												>
													{ bundle.icon ? (
														<img
															src={ bundle.icon }
															alt={ bundle.label }
															className="wp-agentic-admin-bundle-menu__plugin-icon"
														/>
													) : (
														<Icon
															icon={ plugins }
															size={ 18 }
														/>
													) }
													<span className="wp-agentic-admin-bundle-menu__label">
														{ bundle.label }
													</span>
													<span className="wp-agentic-admin-bundle-menu__count">
														{
															bundle
																.pluginAbilityIds
																.length
														}{ ' ' }
														tools
													</span>
												</button>
											) ) }
										</>
									) }
								</div>
							) }
						/>
						<button
							type="button"
							className={ `wp-agentic-admin-websearch-toggle${
								webSearchEnabled
									? ' wp-agentic-admin-websearch-toggle--active'
									: ''
							}` }
							onClick={ () =>
								setWebSearchEnabled( ! webSearchEnabled )
							}
							aria-label="Toggle web search"
							aria-pressed={ webSearchEnabled }
							disabled={ isDisabled }
							data-tooltip={ `Web Search: ${
								webSearchEnabled ? 'active' : 'inactive'
							}` }
						>
							<Icon icon={ globe } size={ 24 } />
						</button>
						<button
							type="button"
							className={ `wp-agentic-admin-websearch-toggle${
								docSearchEnabled
									? ' wp-agentic-admin-websearch-toggle--active'
									: ''
							}` }
							onClick={ () =>
								setDocSearchEnabled( ! docSearchEnabled )
							}
							aria-label="Toggle knowledge base"
							aria-pressed={ docSearchEnabled }
							disabled={ isDisabled }
							data-tooltip={ `Knowledge Base: ${
								docSearchEnabled ? 'active' : 'inactive'
							}` }
						>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
								<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
								<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
							</svg>
						</button>
						{ selectedBundle && (
							<span className="wp-agentic-admin-bundle-pill">
								<span className="wp-agentic-admin-bundle-pill__label">
									{ selectedBundle.label }
								</span>
								<button
									type="button"
									className="wp-agentic-admin-bundle-pill__remove"
									onClick={ () => setSelectedBundle( null ) }
									aria-label={ `Remove ${ selectedBundle.label }` }
								>
									<Icon icon={ closeSmall } size={ 18 } />
								</button>
							</span>
						) }
					</div>
					<div className="wp-agentic-admin-input-toolbar__right">
						{ showMic ? (
							<VoiceButton
								ref={ voiceButtonRef }
								onTranscript={ handleTranscript }
								onStateChange={ setVoiceState }
								disabled={ isDisabled }
							/>
						) : (
							<button
								type="button"
								className="wp-agentic-admin-send-button"
								onClick={ handleSubmit }
								disabled={ ! canSend }
								aria-label="Send message"
							>
								<Icon icon={ send } size={ 20 } />
							</button>
						) }
					</div>
				</div>
			</div>
		</div>
	);
};

export default ChatInput;
