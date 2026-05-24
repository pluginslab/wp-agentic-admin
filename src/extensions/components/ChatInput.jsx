/**
 * ChatInput Component
 *
 * Text input area with bundle selection, plus icon, and send button.
 */

import { useState, useRef, useEffect } from '@wordpress/element';
import vectorStore from '../services/vector-store';
import {
	Button,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	TextareaControl,
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
} from '@wordpress/components';
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
	search,
} from '@wordpress/icons';
import ABILITY_BUNDLES from '../data/ability-bundles';
import pluginAbilitiesManager from '../services/plugin-abilities-manager';
import ModelStatusPill from './ModelStatusPill';

const BUNDLE_ICONS = {
	shield,
	plugins,
	tool,
	bug,
	post,
	info,
	edit,
};

const ChatInput = ( {
	onSend,
	disabled = false,
	placeholder = 'Describe your issue or what you want to do…',
	isLoading = false,
	defaultBundle = null,
} ) => {
	const [ message, setMessage ] = useState( '' );
	const [ selectedBundle, setSelectedBundle ] = useState( null );
	const [ webSearchEnabled, setWebSearchEnabled ] = useState( false );
	const [ docSearchEnabled, setDocSearchEnabled ] = useState( false );
	const [ kbIndexReady, setKbIndexReady ] = useState( false );
	const [ pluginBundles, setPluginBundles ] = useState( [] );
	const textareaWrapperRef = useRef( null );

	useEffect( () => {
		const checkIndex = async () => {
			try {
				await vectorStore.init();
				setKbIndexReady( vectorStore.isReady() );
			} catch {
				setKbIndexReady( false );
			}
		};
		checkIndex();
	}, [] );

	useEffect( () => {
		const refresh = () => {
			setPluginBundles( pluginAbilitiesManager.getPluginBundles() );
		};
		refresh();
		return pluginAbilitiesManager.subscribe( refresh );
	}, [] );

	useEffect( () => {
		if ( defaultBundle && ! selectedBundle ) {
			setSelectedBundle( defaultBundle );
		}
	}, [ defaultBundle ] ); // eslint-disable-line react-hooks/exhaustive-deps -- only react to defaultBundle changes

	useEffect( () => {
		if ( ! disabled && textareaWrapperRef.current ) {
			textareaWrapperRef.current.querySelector( 'textarea' )?.focus();
		}
	}, [ disabled ] );

	const handleSubmit = () => {
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

	const handleKeyDown = ( e ) => {
		if ( e.key === 'Enter' && ! e.shiftKey ) {
			e.preventDefault();
			handleSubmit();
		}
	};

	const isDisabled = disabled || isLoading;
	const canSend = message.trim().length > 0 && ! isDisabled;

	const renderBundleMenu = ( { onClose } ) => (
		<>
			<MenuGroup>
				{ ABILITY_BUNDLES.map( ( bundle ) => (
					<MenuItem
						key={ bundle.id }
						icon={ BUNDLE_ICONS[ bundle.icon ] || shield }
						isSelected={ selectedBundle?.id === bundle.id }
						onClick={ () => {
							setSelectedBundle( bundle );
							onClose();
						} }
						suffix={ <span>{ bundle.abilities.length } tools</span> }
					>
						{ bundle.label }
					</MenuItem>
				) ) }
			</MenuGroup>
			{ pluginBundles.length > 0 && (
				<MenuGroup label="Plugin Abilities">
					{ pluginBundles.map( ( bundle ) => (
						<MenuItem
							key={ bundle.id }
							icon={ bundle.icon ? undefined : plugins }
							isSelected={ selectedBundle?.id === bundle.id }
							onClick={ () => {
								setSelectedBundle( bundle );
								onClose();
							} }
							suffix={
								<span>
									{ bundle.pluginAbilityIds.length } tools
								</span>
							}
						>
							{ bundle.label }
						</MenuItem>
					) ) }
				</MenuGroup>
			) }
		</>
	);

	return (
		<VStack
			spacing={ 2 }
			className="wp-agentic-admin-input-area"
			ref={ textareaWrapperRef }
		>
			<TextareaControl
				__nextHasNoMarginBottom
				label="Message"
				hideLabelFromVision
				value={ message }
				onChange={ setMessage }
				onKeyDown={ handleKeyDown }
				placeholder={ placeholder }
				rows={ 3 }
				disabled={ isDisabled }
			/>
			<HStack justify="space-between" spacing={ 2 }>
				<HStack justify="flex-start" spacing={ 1 }>
					<DropdownMenu
						icon={ plus }
						label="Select ability bundle"
						popoverProps={ {
							placement: 'top-start',
							shift: true,
						} }
						toggleProps={ { disabled: isDisabled } }
					>
						{ renderBundleMenu }
					</DropdownMenu>
					<Button
						icon={ globe }
						label={ `Web Search: ${
							webSearchEnabled ? 'active' : 'inactive'
						}` }
						showTooltip
						isPressed={ webSearchEnabled }
						onClick={ () =>
							setWebSearchEnabled( ! webSearchEnabled )
						}
						disabled={ isDisabled }
					/>
					<Button
						icon={ search }
						label={
							! kbIndexReady
								? 'Knowledge Base: not indexed (build in Settings)'
								: `Knowledge Base: ${
										docSearchEnabled
											? 'active'
											: 'inactive'
								  }`
						}
						showTooltip
						isPressed={ docSearchEnabled }
						onClick={ () =>
							setDocSearchEnabled( ! docSearchEnabled )
						}
						disabled={ isDisabled || ! kbIndexReady }
					/>
					{ selectedBundle && (
						<HStack
							spacing={ 1 }
							className="wp-agentic-admin-bundle-pill"
						>
							<span>{ selectedBundle.label }</span>
							<Button
								size="small"
								icon={ closeSmall }
								label={ `Remove ${ selectedBundle.label }` }
								onClick={ () => setSelectedBundle( null ) }
							/>
						</HStack>
					) }
				</HStack>
				<HStack
					alignment="center"
					spacing={ 2 }
					justify="flex-end"
				>
					<ModelStatusPill />
					<Button
						icon={ send }
						label="Send message"
						variant="primary"
						onClick={ handleSubmit }
						disabled={ ! canSend }
					/>
				</HStack>
			</HStack>
		</VStack>
	);
};

export default ChatInput;
