/**
 * Model Status Component
 *
 * Displays the AI model loading status with progress bar and controls.
 * Supports both local (WebLLM) and remote (OpenAI-compatible API) providers.
 *
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import {
	Button,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	Spinner,
} from '@wordpress/components';
import { moreVertical } from '@wordpress/icons';
import modelLoader, {
	ModelLoader,
	DEFAULT_MODEL,
	ExternalEngine,
} from '../services/model-loader';
import { createLogger } from '../utils/logger';

const log = createLogger( 'ModelStatus' );

/**
 * localStorage keys for provider settings
 */
const STORAGE_KEYS = {
	model: 'wp_agentic_admin_model',
	provider: 'wp_agentic_admin_provider',
	remoteUrl: 'wp_agentic_admin_remote_url',
	remoteModel: 'wp_agentic_admin_remote_model',
	remoteApiKey: 'wp_agentic_admin_remote_api_key',
};

/**
 * Get the saved model from localStorage
 *
 * @return {string} The saved model ID or DEFAULT_MODEL
 */
const getSavedModel = () => {
	try {
		const saved = localStorage.getItem( STORAGE_KEYS.model );
		return saved || DEFAULT_MODEL;
	} catch ( err ) {
		log.warn( 'Failed to load saved model from localStorage:', err );
		return DEFAULT_MODEL;
	}
};

/**
 * Save the selected model to localStorage
 *
 * @param {string} modelId - The model ID to save
 */
const saveModel = ( modelId ) => {
	try {
		localStorage.setItem( STORAGE_KEYS.model, modelId );
	} catch ( err ) {
		log.warn( 'Failed to save model to localStorage:', err );
	}
};

/**
 * Get saved provider settings from localStorage
 *
 * @return {Object} Provider settings
 */
const getSavedProviderSettings = () => {
	try {
		return {
			provider: localStorage.getItem( STORAGE_KEYS.provider ) || 'local',
			remoteUrl: localStorage.getItem( STORAGE_KEYS.remoteUrl ) || '',
			remoteModel: localStorage.getItem( STORAGE_KEYS.remoteModel ) || '',
			remoteApiKey:
				localStorage.getItem( STORAGE_KEYS.remoteApiKey ) || '',
		};
	} catch ( err ) {
		log.warn( 'Failed to load provider settings:', err );
		return {
			provider: 'local',
			remoteUrl: '',
			remoteModel: '',
			remoteApiKey: '',
		};
	}
};

/**
 * Save provider settings to localStorage
 *
 * @param {Object} settings - Provider settings to save
 */
const saveProviderSettings = ( settings ) => {
	try {
		if ( settings.provider !== undefined ) {
			localStorage.setItem( STORAGE_KEYS.provider, settings.provider );
		}
		if ( settings.remoteUrl !== undefined ) {
			localStorage.setItem( STORAGE_KEYS.remoteUrl, settings.remoteUrl );
		}
		if ( settings.remoteModel !== undefined ) {
			localStorage.setItem(
				STORAGE_KEYS.remoteModel,
				settings.remoteModel
			);
		}
		if ( settings.remoteApiKey !== undefined ) {
			localStorage.setItem(
				STORAGE_KEYS.remoteApiKey,
				settings.remoteApiKey
			);
		}
	} catch ( err ) {
		log.warn( 'Failed to save provider settings:', err );
	}
};

/**
 * Parse the loading stage from WebLLM progress message
 *
 * @param {string} message  - Progress message from WebLLM
 * @param {number} progress - Current progress percentage
 * @return {Object} Stage info with icon and title
 */
const getLoadingStage = ( message, progress ) => {
	const lowerMsg = message.toLowerCase();

	if ( progress < 5 || lowerMsg.includes( 'webgpu' ) ) {
		return { icon: '🔍', title: 'Checking WebGPU' };
	}

	if (
		lowerMsg.includes( 'initializing' ) ||
		lowerMsg.includes( 'engine' )
	) {
		return { icon: '⚙️', title: 'Initializing Engine' };
	}

	if (
		lowerMsg.includes( 'loading model' ) ||
		lowerMsg.includes( 'fetching' )
	) {
		const isFromCache = lowerMsg.includes( 'cache' );
		return {
			icon: isFromCache ? '📦' : '⬇️',
			title: isFromCache ? 'Loading Model Weights' : 'Downloading Model',
		};
	}

	if ( lowerMsg.includes( 'shader' ) || lowerMsg.includes( 'compiling' ) ) {
		return { icon: '🔧', title: 'Compiling Shaders' };
	}

	if ( lowerMsg.includes( 'tokenizer' ) ) {
		return { icon: '📝', title: 'Loading Tokenizer' };
	}

	if (
		lowerMsg.includes( 'connecting' ) ||
		lowerMsg.includes( 'external' )
	) {
		return { icon: '🌐', title: 'Connecting' };
	}

	if ( progress >= 95 ) {
		return { icon: '✨', title: 'Finalizing' };
	}

	return { icon: '🧠', title: 'Loading Model' };
};

/**
 * ModelStatus component
 *
 * @param {Object}      props              - Component props
 * @param {Function}    props.onModelReady - Callback when model is ready
 * @param {Function}    props.onModelError - Callback when model loading fails
 * @param {string|null} props.initPhase    - Current initialization phase ('checking', 'loading', or null)
 * @param {string}      props.initMessage  - Message to display during initialization
 * @param {number}      props.initProgress - Progress percentage during initialization
 */
const ModelStatus = ( {
	onModelReady,
	onModelError,
	initPhase,
	initMessage, // eslint-disable-line no-unused-vars -- Prop passed by parent for future use in status display.
	initProgress,
} ) => {
	const [ status, setStatus ] = useState( 'not-loaded' ); // not-loaded, checking, loading, ready, error
	const [ message, setMessage ] = useState(
		'AI model not loaded. Click "Load Model" to start.'
	);
	const [ progress, setProgress ] = useState( 0 );
	const [ selectedModel, setSelectedModel ] = useState( getSavedModel() );
	const [ isFromCache, setIsFromCache ] = useState( false );
	const [ rawMessage, setRawMessage ] = useState( '' );
	const [ loadedModelInfo, setLoadedModelInfo ] = useState( null );
	const [ memoryStats, setMemoryStats ] = useState( null );
	const [ gpuInfo, setGpuInfo ] = useState( null );
	const [ contextUsage, setContextUsage ] = useState( null );
	const [ isServiceWorkerMode, setIsServiceWorkerMode ] = useState( false );

	// Remote provider state — lazy initializer to avoid reading localStorage on every render
	const [ savedSettings ] = useState( getSavedProviderSettings );
	const [ providerMode, setProviderMode ] = useState(
		savedSettings.provider
	);
	const [ remoteUrl, setRemoteUrl ] = useState( savedSettings.remoteUrl );
	const [ remoteApiKey, setRemoteApiKey ] = useState(
		savedSettings.remoteApiKey
	);
	const [ remoteModels, setRemoteModels ] = useState( [] );
	const [ selectedRemoteModel, setSelectedRemoteModel ] = useState(
		savedSettings.remoteModel
	);
	const [ isFetchingModels, setIsFetchingModels ] = useState( false );
	const [ fetchError, setFetchError ] = useState( '' );

	const availableModels = ModelLoader.getAvailableModels();

	// Track if we're in a loading state (init phase, loading, or checking)
	const isInLoadingState =
		initPhase !== null || status === 'loading' || status === 'checking';

	/**
	 * Update status when init phase changes
	 */
	useEffect( () => {
		if ( initPhase === 'loading' ) {
			setStatus( 'loading' );
		}
	}, [ initPhase ] );

	/**
	 * Set up model loader callbacks
	 */
	useEffect( () => {
		modelLoader.onProgress( ( prog, msg ) => {
			setProgress( prog );
			setRawMessage( msg );
			setMessage( msg );
			// Detect cache vs download from WebLLM progress messages
			if ( msg && msg.toLowerCase().includes( 'cache' ) ) {
				setIsFromCache( true );
			} else if (
				msg &&
				( msg.toLowerCase().includes( 'fetching' ) ||
					msg.toLowerCase().includes( 'downloading' ) )
			) {
				setIsFromCache( false );
			}
		} );

		modelLoader.onStatus( ( stat, msg ) => {
			setStatus( stat );
			setMessage( msg );
			setRawMessage( msg );

			if ( stat === 'ready' && onModelReady ) {
				onModelReady();
				setIsFromCache( false );
			} else if ( stat === 'error' && onModelError ) {
				onModelError( msg );
				setIsFromCache( false );
			}
		} );

		// Check if model is already loaded
		let cancelled = false;
		if ( modelLoader.isModelReady() ) {
			setStatus( 'ready' );
			setMessage( 'AI model ready' );
			setProgress( 100 );
			const info = modelLoader.getLoadedModelInfo();
			setLoadedModelInfo( info );
			modelLoader.getMemoryStats().then( ( stats ) => {
				if ( ! cancelled ) {
					setMemoryStats( stats );
				}
			} );
		}
		return () => {
			cancelled = true;
		};
	}, [ onModelReady, onModelError ] );

	/**
	 * Update model info when model becomes ready
	 * Poll for stats updates to capture performance after inference
	 */
	useEffect( () => {
		if ( status === 'ready' ) {
			const info = modelLoader.getLoadedModelInfo();
			setLoadedModelInfo( info );

			// Check if using Service Worker mode
			setIsServiceWorkerMode( modelLoader.isUsingServiceWorker() );

			// Get GPU info
			const gpu = modelLoader.getGPUInfo();
			setGpuInfo( gpu );

			// Initial stats fetch
			modelLoader.getMemoryStats().then( ( stats ) => {
				setMemoryStats( stats );
			} );

			// Poll for stats updates every 2 seconds to capture post-inference performance
			const statsInterval = setInterval( () => {
				modelLoader.getMemoryStats().then( ( stats ) => {
					if ( stats ) {
						setMemoryStats( stats );
					}
				} );
				// Also update context usage
				const context = modelLoader.getContextUsage();
				if ( context ) {
					setContextUsage( context );
				}
			}, 2000 );

			return () => clearInterval( statsInterval );
		}
		setLoadedModelInfo( null );
		setMemoryStats( null );
		setGpuInfo( null );
		setContextUsage( null );
		setIsServiceWorkerMode( false );
	}, [ status ] );

	/**
	 * Handle Load Model button click (local)
	 */
	const handleLoadModel = useCallback( async () => {
		try {
			saveModel( selectedModel );
			await modelLoader.load( selectedModel );
		} catch ( err ) {
			log.error( 'Failed to load model:', err );
		}
	}, [ selectedModel ] );

	/**
	 * Handle Connect button click (remote)
	 */
	const handleConnectRemote = useCallback( async () => {
		if ( ! remoteUrl || ! selectedRemoteModel ) {
			return;
		}

		try {
			saveProviderSettings( {
				provider: 'remote',
				remoteUrl,
				remoteModel: selectedRemoteModel,
				remoteApiKey,
			} );
			await modelLoader.loadExternal(
				remoteUrl,
				selectedRemoteModel,
				remoteApiKey
			);
		} catch ( err ) {
			log.error( 'Failed to connect to remote provider:', err );
		}
	}, [ remoteUrl, selectedRemoteModel, remoteApiKey ] );

	/**
	 * Handle Unload Model
	 */
	const handleUnloadModel = useCallback( async () => {
		await modelLoader.unload();
		setProgress( 0 );
		setIsFromCache( false );
	}, [] );

	/**
	 * Fetch models from remote endpoint
	 */
	const handleFetchModels = useCallback( async () => {
		if ( ! remoteUrl ) {
			setFetchError( 'Please enter a URL' );
			return;
		}

		setIsFetchingModels( true );
		setFetchError( '' );

		try {
			const models = await ExternalEngine.fetchModels(
				remoteUrl,
				remoteApiKey
			);
			setRemoteModels( models );
			if ( models.length > 0 && ! selectedRemoteModel ) {
				setSelectedRemoteModel( models[ 0 ].id );
			}
			saveProviderSettings( { remoteUrl, remoteApiKey } );
		} catch ( err ) {
			log.error( 'Failed to fetch models:', err );
			setFetchError( err.message );
			setRemoteModels( [] );
		} finally {
			setIsFetchingModels( false );
		}
	}, [ remoteUrl, remoteApiKey, selectedRemoteModel ] );

	/**
	 * Handle provider mode toggle
	 */
	const handleProviderChange = useCallback( ( mode ) => {
		setProviderMode( mode );
		saveProviderSettings( { provider: mode } );
	}, [] );

	/**
	 * Get CSS class for status indicator
	 */
	const getStatusClass = () => {
		switch ( status ) {
			case 'ready':
				return 'wp-agentic-admin-status__indicator--ready';
			case 'loading':
			case 'checking':
				return 'wp-agentic-admin-status__indicator--loading';
			case 'error':
				return 'wp-agentic-admin-status__indicator--error';
			default:
				return 'wp-agentic-admin-status__indicator--pending';
		}
	};

	// Get current loading stage info - use init values during init phase, otherwise use model loader values
	const isInInitPhase = initPhase === 'checking';
	const displayProgress = isInInitPhase ? initProgress : progress;
	const loadingStage = isInInitPhase
		? { icon: '🔍', title: 'Initializing' }
		: getLoadingStage( rawMessage, progress );

	// Determine the main title for the loading card
	const getLoadingTitle = () => {
		if ( isInInitPhase ) {
			return 'Initializing';
		}
		if ( providerMode === 'remote' ) {
			return 'Connecting';
		}
		if ( isFromCache ) {
			return 'Loading from Cache';
		}
		return 'Loading Model';
	};

	const isRemoteReady =
		providerMode === 'remote' && remoteUrl && selectedRemoteModel;

	return (
		<div className="wp-agentic-admin-model-status">
			{ /* Loading State - Full Progress UI */ }
			{ isInLoadingState && (
				<div className="wp-agentic-admin-loading-card">
					<div className="wp-agentic-admin-loading-card__header">
						<span className="wp-agentic-admin-loading-card__icon">
							{ loadingStage.icon }
						</span>
						<div className="wp-agentic-admin-loading-card__title-wrap">
							<h4 className="wp-agentic-admin-loading-card__title">
								{ getLoadingTitle() }
							</h4>
							<span className="wp-agentic-admin-loading-card__subtitle">
								{ loadingStage.title }
							</span>
						</div>
						<span className="wp-agentic-admin-loading-card__percent">
							{ displayProgress }%
						</span>
					</div>

					<div className="wp-agentic-admin-loading-card__progress">
						<div
							className="wp-agentic-admin-loading-card__progress-bar"
							style={ { width: `${ displayProgress }%` } }
						/>
					</div>

					{ isFromCache && ! isInInitPhase && (
						<p className="wp-agentic-admin-loading-card__cache-note">
							Model files are cached locally. No download needed!
						</p>
					) }
				</div>
			) }

			{ /* Not Loading State - Standard Status Bar */ }
			{ ! isInLoadingState && (
				<div className="wp-agentic-admin-status">
					<span
						className={ `wp-agentic-admin-status__indicator ${ getStatusClass() }` }
					/>
					<div className="wp-agentic-admin-status__info">
						<span className="wp-agentic-admin-status__text">
							{ status === 'ready' && loadedModelInfo
								? `${ loadedModelInfo.name } ready`
								: message }
						</span>
						{ status === 'ready' && loadedModelInfo && (
							<span className="wp-agentic-admin-status__model-details">
								{ loadedModelInfo.mode === 'external' && (
									<span
										className="wp-agentic-admin-status__mode-badge wp-agentic-admin-status__mode-badge--external"
										title="Connected to external API"
									>
										Remote
									</span>
								) }
								{ isServiceWorkerMode && (
									<span
										className="wp-agentic-admin-status__mode-badge wp-agentic-admin-status__mode-badge--persistent"
										title="Model persists across page navigations"
									>
										Persistent
									</span>
								) }
								{ gpuInfo && gpuInfo.device !== 'Unknown' && (
									<span className="wp-agentic-admin-status__gpu-info">
										{ gpuInfo.device }
										{ gpuInfo.vendor !== 'Unknown' &&
											` (${ gpuInfo.vendor })` }
										{ ' · ' }
									</span>
								) }
								{ loadedModelInfo.mode !== 'external' &&
									`~${ loadedModelInfo.size } VRAM` }
								{ memoryStats?.available &&
									memoryStats?.formatted && (
										<>
											{ ' · ' }
											{ memoryStats.formatted }
										</>
									) }
								{ contextUsage && (
									<span
										className={ `wp-agentic-admin-status__context ${
											/* eslint-disable-next-line no-nested-ternary -- clear context status class selection */
											contextUsage.isCritical
												? 'context--critical'
												: contextUsage.isHigh
												? 'context--high'
												: ''
										}` }
									>
										{ ' · ' }
										<span className="context__label">
											Context:
										</span>
										<span className="context__bar">
											<span
												className="context__fill"
												style={ {
													width: `${ contextUsage.percentage }%`,
												} }
											/>
										</span>
										<span className="context__percent">
											{ contextUsage.used.toLocaleString() }
											/
											{ contextUsage.max.toLocaleString() }{ ' ' }
											({ contextUsage.percentage }%)
										</span>
									</span>
								) }
							</span>
						) }
					</div>

					{ status === 'checking' && <Spinner /> }

					{ status === 'ready' && (
						<DropdownMenu
							icon={ moreVertical }
							label="Model options"
							className="wp-agentic-admin-status__kebab-menu"
						>
							{ ( { onClose } ) => (
								<MenuGroup>
									<MenuItem
										onClick={ () => {
											handleUnloadModel();
											onClose();
										} }
									>
										Unload model
									</MenuItem>
								</MenuGroup>
							) }
						</DropdownMenu>
					) }
				</div>
			) }

			{ /* Provider selection and controls — shown when not loaded */ }
			{ ( status === 'not-loaded' || status === 'error' ) && (
				<div className="wp-agentic-admin-provider">
					{ /* Provider toggle */ }
					<div className="wp-agentic-admin-provider__toggle">
						<button
							type="button"
							className={ `wp-agentic-admin-provider__tab ${
								providerMode === 'local' ? 'is-active' : ''
							}` }
							onClick={ () => handleProviderChange( 'local' ) }
						>
							Local (WebLLM)
						</button>
						<button
							type="button"
							className={ `wp-agentic-admin-provider__tab ${
								providerMode === 'remote' ? 'is-active' : ''
							}` }
							onClick={ () => handleProviderChange( 'remote' ) }
						>
							Remote (API)
						</button>
					</div>

					{ /* Local provider controls */ }
					{ providerMode === 'local' && (
						<div className="wp-agentic-admin-provider__local">
							<div className="wp-agentic-admin-status__controls">
								<select
									className="wp-agentic-admin-model-select"
									value={ selectedModel }
									onChange={ ( e ) => {
										const modelId = e.target.value;
										setSelectedModel( modelId );
										saveModel( modelId );
									} }
								>
									{ availableModels.map( ( model ) => (
										<option
											key={ model.id }
											value={ model.id }
										>
											{ model.name } ({ model.size })
											{ model.recommended
												? ' - Recommended'
												: '' }
										</option>
									) ) }
								</select>
								<Button
									variant="primary"
									onClick={ handleLoadModel }
									className="wp-agentic-admin-load-model"
								>
									{ status === 'error'
										? 'Retry'
										: 'Load Model' }
								</Button>
							</div>
							<p className="wp-agentic-admin-model-info">
								The AI model runs entirely in your browser using
								WebGPU. The first load will download model data
								(250MB-1GB depending on model), which is cached
								for future use. Using a Service Worker, the
								model stays loaded as you navigate wp-admin - no
								reload needed! No data is sent to external
								servers.
							</p>
						</div>
					) }

					{ /* Remote provider controls */ }
					{ providerMode === 'remote' && (
						<div className="wp-agentic-admin-provider__remote">
							<div className="wp-agentic-admin-provider__field">
								<label htmlFor="wp-agentic-remote-url">
									Endpoint URL
								</label>
								<div className="wp-agentic-admin-provider__url-row">
									<input
										id="wp-agentic-remote-url"
										type="url"
										className="wp-agentic-admin-provider__input"
										value={ remoteUrl }
										onChange={ ( e ) =>
											setRemoteUrl( e.target.value )
										}
										placeholder="http://localhost:11434"
									/>
									<Button
										variant="secondary"
										onClick={ handleFetchModels }
										disabled={
											isFetchingModels || ! remoteUrl
										}
										className="wp-agentic-admin-provider__fetch-btn"
									>
										{ isFetchingModels
											? 'Fetching...'
											: 'Fetch Models' }
									</Button>
								</div>
							</div>

							<div className="wp-agentic-admin-provider__field">
								<label htmlFor="wp-agentic-remote-key">
									API Key{ ' ' }
									<span className="wp-agentic-admin-provider__optional">
										(optional)
									</span>
								</label>
								<input
									id="wp-agentic-remote-key"
									type="password"
									className="wp-agentic-admin-provider__input"
									value={ remoteApiKey }
									onChange={ ( e ) =>
										setRemoteApiKey( e.target.value )
									}
									placeholder="sk-... (for OpenAI, Groq, etc.)"
								/>
							</div>

							{ fetchError && (
								<p className="wp-agentic-admin-provider__error">
									{ fetchError }
								</p>
							) }

							{ remoteModels.length > 0 && (
								<div className="wp-agentic-admin-provider__field">
									<label htmlFor="wp-agentic-remote-model">
										Model
									</label>
									<div className="wp-agentic-admin-status__controls">
										<select
											id="wp-agentic-remote-model"
											className="wp-agentic-admin-model-select"
											value={ selectedRemoteModel }
											onChange={ ( e ) => {
												setSelectedRemoteModel(
													e.target.value
												);
												saveProviderSettings( {
													remoteModel: e.target.value,
												} );
											} }
										>
											{ remoteModels.map( ( model ) => (
												<option
													key={ model.id }
													value={ model.id }
												>
													{ model.name }
												</option>
											) ) }
										</select>
										<Button
											variant="primary"
											onClick={ handleConnectRemote }
											disabled={ ! isRemoteReady }
											className="wp-agentic-admin-load-model"
										>
											{ status === 'error'
												? 'Retry'
												: 'Connect' }
										</Button>
									</div>
								</div>
							) }

							<p className="wp-agentic-admin-model-info">
								Connect to any OpenAI-compatible API endpoint
								(Ollama, LM Studio, vLLM, OpenAI, Groq,
								Together, etc.). Enter the base URL and fetch
								available models. API keys are stored in your
								browser only.
							</p>
						</div>
					) }
				</div>
			) }
		</div>
	);
};

export default ModelStatus;
