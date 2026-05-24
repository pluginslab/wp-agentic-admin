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
	shield,
	globe,
	plugins,
	tool,
	bug,
	post,
	info,
	pencil,
	search,
	check,
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
	edit: pencil,
};

const ChatInput = ( {
	onSend,
	disabled = false,
	placeholder = 'Describe your issue or what you want to do…',
	isLoading = false,
	defaultBundle = null,
} ) => {
	const [ message, setMessage ] = useState( '' );
	// Multi-select: an ordered list of bundle ids the user has toggled on
	// via the "+" DropdownMenu. Clicking a row toggles its membership.
	const [ selectedBundleIds, setSelectedBundleIds ] = useState( [] );
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
		if ( defaultBundle && selectedBundleIds.length === 0 ) {
			setSelectedBundleIds( [ defaultBundle.id ] );
		}
	}, [ defaultBundle ] ); // eslint-disable-line react-hooks/exhaustive-deps -- only react to defaultBundle changes

	useEffect( () => {
		if ( ! disabled && textareaWrapperRef.current ) {
			textareaWrapperRef.current.querySelector( 'textarea' )?.focus();
		}
	}, [ disabled ] );

	const allBundles = [ ...ABILITY_BUNDLES, ...pluginBundles ];
	const selectedBundles = selectedBundleIds
		.map( ( id ) => allBundles.find( ( b ) => b.id === id ) )
		.filter( Boolean );

	const toggleBundle = ( bundleId ) => {
		setSelectedBundleIds( ( prev ) =>
			prev.includes( bundleId )
				? prev.filter( ( id ) => id !== bundleId )
				: [ ...prev, bundleId ]
		);
	};

	const handleSubmit = () => {
		const trimmedMessage = message.trim();
		if ( ! trimmedMessage || disabled || isLoading ) {
			return;
		}

		// Union the abilities + plugin-ability ids across every selected
		// bundle, preserving the order the user selected them in. Single
		// bundleId/pluginNamespace remain set for downstream code that
		// still expects the old shape; they refer to the FIRST selection.
		const unionAbilities = selectedBundles
			.flatMap( ( b ) => b.abilities || b.pluginAbilityIds || [] )
			.filter( ( v, i, a ) => a.indexOf( v ) === i );
		const first = selectedBundles[ 0 ];

		onSend( trimmedMessage, {
			bundleToolIds: unionAbilities.length ? unionAbilities : null,
			bundleId: first?.id || null,
			bundleIds: selectedBundleIds.length ? selectedBundleIds : null,
			pluginNamespace: first?.pluginNamespace || null,
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

	// Multi-select menu: clicking a row toggles it. The menu stays open
	// so the user can flip several at once. Selected rows show a check
	// via MenuItem's isSelected prop.
	const renderBundleMenu = () => (
		<>
			<MenuGroup>
				{ ABILITY_BUNDLES.map( ( bundle ) => {
					const selected = selectedBundleIds.includes( bundle.id );
					return (
						<MenuItem
							key={ bundle.id }
							icon={
								selected
									? check
									: BUNDLE_ICONS[ bundle.icon ] || shield
							}
							isSelected={ selected }
							role="menuitemcheckbox"
							onClick={ () => toggleBundle( bundle.id ) }
							suffix={
								<span className="wp-agentic-admin-bundle-count">
									{ bundle.abilities.length }
								</span>
							}
						>
							{ bundle.label }
						</MenuItem>
					);
				} ) }
			</MenuGroup>
			{ pluginBundles.length > 0 && (
				<MenuGroup label="Plugin Abilities">
					{ pluginBundles.map( ( bundle ) => {
						const selected = selectedBundleIds.includes(
							bundle.id
						);
						return (
							<MenuItem
								key={ bundle.id }
								icon={
									selected
										? check
										: bundle.icon
										? undefined
										: plugins
								}
								isSelected={ selected }
								role="menuitemcheckbox"
								onClick={ () => toggleBundle( bundle.id ) }
								suffix={
									<span className="wp-agentic-admin-bundle-count">
										{ bundle.pluginAbilityIds.length }
									</span>
								}
							>
								{ bundle.label }
							</MenuItem>
						);
					} ) }
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
			<HStack alignment="center" spacing={ 2 } justify="flex-start">
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
				<div style={ { flex: 1, minWidth: 0 } }>
					<ModelStatusPill />
				</div>
				<Button
					icon={ send }
					label="Send message"
					variant="primary"
					onClick={ handleSubmit }
					disabled={ ! canSend }
				/>
			</HStack>
		</VStack>
	);
};

export default ChatInput;
