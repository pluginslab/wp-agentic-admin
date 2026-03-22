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
} from '@wordpress/icons';
import ABILITY_BUNDLES from '../data/ability-bundles';
import pluginAbilitiesManager from '../services/plugin-abilities-manager';

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
};

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
	const [ selectedBundle, setSelectedBundle ] = useState( null );
	const [ webSearchEnabled, setWebSearchEnabled ] = useState( false );
	const [ pluginBundles, setPluginBundles ] = useState( [] );
	const textareaRef = useRef( null );

	// Subscribe to plugin abilities manager for dynamic bundles
	useEffect( () => {
		const refresh = () => {
			setPluginBundles( pluginAbilitiesManager.getPluginBundles() );
		};
		refresh();
		return pluginAbilitiesManager.subscribe( refresh );
	}, [] );

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

		const trimmedMessage = message.trim();
		if ( ! trimmedMessage || disabled || isLoading ) {
			return;
		}

		onSend( trimmedMessage, {
			bundleToolIds: selectedBundle?.abilities || null,
			pluginNamespace: selectedBundle?.pluginNamespace || null,
			webSearch: webSearchEnabled,
		} );
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
	const canSend = message.trim().length > 0 && ! isDisabled;

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
				<textarea
					ref={ textareaRef }
					className="wp-agentic-admin-input"
					value={ message }
					onChange={ handleChange }
					onKeyDown={ handleKeyDown }
					placeholder={ placeholder }
					rows="3"
					disabled={ isDisabled }
				/>
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
						<button
							type="button"
							className="wp-agentic-admin-send-button"
							onClick={ handleSubmit }
							disabled={ ! canSend }
							aria-label="Send message"
						>
							<Icon icon={ send } size={ 20 } />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ChatInput;
