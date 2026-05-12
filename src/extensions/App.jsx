/**
 * Agentic Admin for WordPress - Main App Component
 *
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import { Notice, Button } from '@wordpress/components';
import { cog } from '@wordpress/icons';
import ChatContainer from './components/ChatContainer';
import AbilityBrowser from './components/AbilityBrowser';
import PluginAbilitiesPanel from './components/PluginAbilitiesPanel';
import SettingsTab from './components/SettingsTab';
import ModelStatus from './components/ModelStatus';
import WebGPUFallback from './components/WebGPUFallback';
import modelLoader from './services/model-loader';
import { createLogger } from './utils/logger';

const log = createLogger( 'App' );

const App = () => {
	const [ modelReady, setModelReady ] = useState( false );
	const [ webGPUError, setWebGPUError ] = useState( null );
	const [ isExecuting, setIsExecuting ] = useState( false );
	// Active view — 'chat' | 'abilities' | 'plugin-abilities' | 'settings'.
	// Settings is just another tab (positioned visually on the right via CSS).
	const [ activeView, setActiveView ] = useState( 'chat' );
	// Track initialization phase: 'checking' during initial checks, 'loading' when auto-loading, null when done
	const [ initPhase, setInitPhase ] = useState( 'checking' );
	const [ initMessage, setInitMessage ] = useState(
		'Checking WebGPU support...'
	);
	const [ initProgress, setInitProgress ] = useState( 5 );

	const settings = window.wpAgenticAdmin || {};
	const {
		i18n = {},
		hasPrettyPermalinks = true,
		permalinksUrl = '',
	} = settings;

	/**
	 * Background WebGPU check and auto-load cached model on mount
	 * Shows progress bar during checks
	 */
	useEffect( () => {
		const initializeApp = async () => {
			try {
				// Check WebGPU support first
				setInitMessage( 'Checking WebGPU support...' );
				setInitProgress( 10 );
				const result = await modelLoader.checkWebGPUSupport();
				if ( ! result.supported ) {
					setWebGPUError( result.reason );
					setInitPhase( null );
					return;
				}

				// Check if model is already loaded in memory
				setInitMessage( 'Checking model status...' );
				setInitProgress( 20 );
				if ( modelLoader.isModelReady() ) {
					setModelReady( true );
					setInitPhase( null );
					return;
				}

				// Check saved provider preference
				const savedProvider = localStorage.getItem(
					'agentic_admin_provider'
				);

				if ( savedProvider === 'remote' ) {
					const url = localStorage.getItem(
						'agentic_admin_remote_url'
					);
					const remoteModel = localStorage.getItem(
						'agentic_admin_remote_model'
					);
					const apiKey =
						localStorage.getItem(
							'agentic_admin_remote_api_key'
						) || '';
					if ( url && remoteModel ) {
						log.info( 'Remote provider saved, auto-connecting...' );
						setInitPhase( 'loading' );
						setInitMessage( 'Connecting to remote provider...' );
						setInitProgress( 35 );
						try {
							await modelLoader.loadExternal(
								url,
								remoteModel,
								apiKey
							);
							setModelReady( true );
						} catch ( loadErr ) {
							log.error( 'Auto-connect remote failed:', loadErr );
						}
					}
					setInitPhase( null );
					return;
				}

				// Check if local model is cached
				setInitMessage( 'Checking cache...' );
				setInitProgress( 30 );
				const isCached = await modelLoader.isModelCached();

				if ( isCached ) {
					log.info( 'Model is cached, auto-loading...' );
					setInitPhase( 'loading' );
					setInitMessage( 'Loading from cache...' );
					setInitProgress( 35 );
					try {
						await modelLoader.load();
						setModelReady( true );
					} catch ( loadErr ) {
						log.error( 'Auto-load failed:', loadErr );
						// Don't show error - user can manually load
					}
				}
				setInitPhase( null );
			} catch ( err ) {
				log.error( 'Initialization failed:', err );
				setInitPhase( null );
			}
		};

		initializeApp();
	}, [] );

	/**
	 * Handle model ready callback
	 */
	const handleModelReady = useCallback( () => {
		setModelReady( true );
		setWebGPUError( null );
	}, [] );

	/**
	 * Handle model unload callback — resets ready state
	 */
	const handleModelUnload = useCallback( () => {
		setModelReady( false );
	}, [] );

	/**
	 * Handle model error callback
	 */
	const handleModelError = useCallback( ( errorMessage ) => {
		setModelReady( false );
		// Only set WebGPU error if it's a WebGPU-specific error
		if (
			errorMessage.includes( 'WebGPU' ) ||
			errorMessage.includes( 'GPU' )
		) {
			setWebGPUError( errorMessage );
		}
	}, [] );

	// If permalinks are not configured, show error
	if ( ! hasPrettyPermalinks ) {
		return (
			<div className="wp-agentic-admin-app">
				<div className="wp-agentic-admin-permalink-notice">
					<Notice status="error" isDismissible={ false }>
						<p>
							<strong>
								{ i18n.permalinksRequired ||
									'Pretty permalinks are required for Agentic Admin to work.' }
							</strong>
						</p>
						<p>
							The REST API requires a permalink structure other
							than &quot;Plain&quot; to function properly. Please
							go to <strong>Settings &rarr; Permalinks</strong>{ ' ' }
							and select any option except &quot;Plain&quot;.
						</p>
						<p>
							<a
								href={ permalinksUrl }
								className="button button-primary"
							>
								{ i18n.updatePermalinks || 'Update Permalinks' }
							</a>
						</p>
					</Notice>
				</div>
			</div>
		);
	}

	/**
	 * Tab panel configuration
	 */
	const tabs = [
		{
			name: 'chat',
			title: 'Chat',
		},
		{ name: 'abilities', title: 'Abilities' },
		{ name: 'plugin-abilities', title: 'Plugin Abilities' },
	];

	/**
	 * Render content for the active view.
	 *
	 * @return {JSX.Element} The rendered view.
	 */
	const renderActiveView = () => {
		switch ( activeView ) {
			case 'chat':
				// If WebGPU has a fatal error, show fallback
				if ( webGPUError && ! modelReady ) {
					return (
						<WebGPUFallback
							reason={ webGPUError }
							isInsecureContext={ ! window.isSecureContext }
						/>
					);
				}
				return (
					<ChatContainer
						modelReady={ modelReady }
						isLoading={ isExecuting }
						setIsLoading={ setIsExecuting }
					/>
				);
			case 'abilities':
				return <AbilityBrowser />;
			case 'plugin-abilities':
				return <PluginAbilitiesPanel />;
			case 'settings':
				return <SettingsTab />;
			default:
				return null;
		}
	};

	return (
		<div className="wp-agentic-admin-app">
			<div className="wp-agentic-admin-main">
				<div className="wp-agentic-admin-tabs-wrapper">
					<div
						className="wp-agentic-admin-tabs"
						role="tablist"
						aria-label="Agentic Admin views"
					>
						{ tabs.map( ( tab ) => (
							<button
								key={ tab.name }
								type="button"
								role="tab"
								aria-selected={ activeView === tab.name }
								className={ `wp-agentic-admin-tab${
									activeView === tab.name ? ' is-active' : ''
								}` }
								onClick={ () => setActiveView( tab.name ) }
							>
								{ tab.title }
							</button>
						) ) }
						<Button
							icon={ cog }
							role="tab"
							aria-selected={ activeView === 'settings' }
							className={ `wp-agentic-admin-settings-toggle${
								activeView === 'settings' ? ' is-active' : ''
							}` }
							onClick={ () => setActiveView( 'settings' ) }
							label="Settings"
						>
							Settings
						</Button>
					</div>
					<div className="wp-agentic-admin-tab-content">
						{ renderActiveView() }
					</div>
				</div>
			</div>

			<ModelStatus
				onModelReady={ handleModelReady }
				onModelError={ handleModelError }
				onModelUnload={ handleModelUnload }
				initPhase={ initPhase }
				initMessage={ initMessage }
				initProgress={ initProgress }
			/>
		</div>
	);
};

export default App;
