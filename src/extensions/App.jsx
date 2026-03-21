/**
 * WP Agentic Admin - Main App Component
 *
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import { TabPanel, Notice } from '@wordpress/components';
import ChatContainer from './components/ChatContainer';
import AbilityBrowser from './components/AbilityBrowser';
import PluginAbilitiesPanel from './components/PluginAbilitiesPanel';
import FeedbackTab from './components/FeedbackTab';
import SettingsTab from './components/SettingsTab';
import { FEEDBACK_UPLOAD_ENABLED } from './services/feedback';
import ModelStatus from './components/ModelStatus';
import WebGPUFallback from './components/WebGPUFallback';
import modelLoader from './services/model-loader';
import { createLogger } from './utils/logger';

const log = createLogger( 'App' );

const App = () => {
	const [ modelReady, setModelReady ] = useState( false );
	const [ webGPUError, setWebGPUError ] = useState( null );
	const [ isExecuting, setIsExecuting ] = useState( false );
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
					'wp_agentic_admin_provider'
				);

				if ( savedProvider === 'remote' ) {
					const url = localStorage.getItem(
						'wp_agentic_admin_remote_url'
					);
					const remoteModel = localStorage.getItem(
						'wp_agentic_admin_remote_model'
					);
					const apiKey =
						localStorage.getItem(
							'wp_agentic_admin_remote_api_key'
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
			className: 'wp-agentic-admin-tab',
		},
		{
			name: 'abilities',
			title: 'Abilities',
			className: 'wp-agentic-admin-tab',
		},
		{
			name: 'plugin-abilities',
			title: 'Plugin Abilities',
			className: 'wp-agentic-admin-tab',
		},
		{
			name: 'settings',
			title: 'Settings',
			className: 'wp-agentic-admin-tab',
		},
		...( FEEDBACK_UPLOAD_ENABLED
			? [
					{
						name: 'feedback',
						title: 'Feedback',
						className: 'wp-agentic-admin-tab',
					},
			  ]
			: [] ),
	];

	/**
	 * Render tab content
	 *
	 * @param {Object} tab - The tab object to render
	 * @return {JSX.Element} The rendered tab content
	 */
	const renderTabContent = ( tab ) => {
		switch ( tab.name ) {
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
			case 'feedback':
				return <FeedbackTab />;
			default:
				return null;
		}
	};

	return (
		<div className="wp-agentic-admin-app">
			<div className="wp-agentic-admin-main">
				<TabPanel
					className="wp-agentic-admin-tabs"
					tabs={ tabs }
					initialTabName="chat"
				>
					{ ( tab ) => (
						<div className="wp-agentic-admin-tab-content">
							{ renderTabContent( tab ) }
						</div>
					) }
				</TabPanel>
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
