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
	Card,
	CardBody,
	Notice,
	ProgressBar,
	SelectControl,
	Spinner,
	TextControl,
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import useConnectors from '../services/use-connectors';
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
	model: 'agentic_admin_model',
	provider: 'agentic_admin_provider',
	remoteUrl: 'agentic_admin_remote_url',
	remoteModel: 'agentic_admin_remote_model',
	remoteApiKey: 'agentic_admin_remote_api_key',
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
 * @param {Object}      props               - Component props
 * @param {Function}    props.onModelReady  - Callback when model is ready
 * @param {Function}    props.onModelError  - Callback when model loading fails
 * @param {string|null} props.initPhase     - Current initialization phase ('checking', 'loading', or null)
 * @param {string}      props.initMessage   - Message to display during initialization
 * @param {number}      props.initProgress  - Progress percentage during initialization
 * @param {Function}    props.onModelUnload - Callback when model is unloaded
 */
const ModelStatus = ( {
	onModelReady,
	onModelError,
	onModelUnload,
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

	// WP 7.0 AI Connectors (third provider option).
	const {
		connectors,
		optionsUrl,
		supported: connectorsSupported,
		loading: connectorsLoading,
	} = useConnectors();
	const [ selectedConnectorId, setSelectedConnectorId ] = useState( '' );
	const [ selectedConnectorModelId, setSelectedConnectorModelId ] = useState(
		''
	);
	const connectedConnectors = connectors.filter( ( c ) => c.is_connected );
	const selectedConnector = connectedConnectors.find(
		( c ) => c.id === selectedConnectorId
	);
	const connectorModels = selectedConnector?.models || [];

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
		const unsubProgress = modelLoader.onProgress( ( prog, msg ) => {
			setProgress( prog );
			setRawMessage( msg );
			setMessage( msg );
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

		const unsubStatus = modelLoader.onStatus( ( stat, msg ) => {
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
			unsubProgress();
			unsubStatus();
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

			// Initial stats and context fetch
			modelLoader.getMemoryStats().then( ( stats ) => {
				setMemoryStats( stats );
			} );
			const initialContext = modelLoader.getContextUsage();
			if ( initialContext ) {
				setContextUsage( initialContext );
			}

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
		if ( onModelUnload ) {
			onModelUnload();
		}
	}, [ onModelUnload ] );

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
			const modelIds = models.map( ( m ) => m.id );
			if (
				models.length > 0 &&
				( ! selectedRemoteModel ||
					! modelIds.includes( selectedRemoteModel ) )
			) {
				setSelectedRemoteModel( models[ 0 ].id );
				saveProviderSettings( { remoteModel: models[ 0 ].id } );
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
			{ /* Loading state is shown inline in the composer toolbar as
			   a Spinner + percent — see <ModelStatusPill> in ChatInput.
			   This component only renders the provider config Card
			   (when not-loaded or error) from here on. */ }

			{ /* Provider selection and controls — shown when not loaded */ }
			{ ( status === 'not-loaded' || status === 'error' ) && (
				<Card>
					<CardBody>
						<VStack spacing={ 3 }>
							<ToggleGroupControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label="Provider"
								hideLabelFromVision
								value={ providerMode }
								onChange={ handleProviderChange }
								isBlock
							>
								<ToggleGroupControlOption
									value="local"
									label="Local (WebLLM)"
								/>
								<ToggleGroupControlOption
									value="remote"
									label="Remote (API)"
								/>
								{ connectorsSupported && (
									<ToggleGroupControlOption
										value="connector"
										label="Connector (WP 7.0)"
									/>
								) }
							</ToggleGroupControl>

							{ providerMode === 'local' && (
								<VStack spacing={ 3 }>
									<HStack
										alignment="end"
										spacing={ 2 }
										justify="flex-start"
									>
										<SelectControl
											__nextHasNoMarginBottom
											label="AI model"
											value={ selectedModel }
											options={ availableModels.map(
												( model ) => ( {
													value: model.id,
													label: `${ model.name } (${ model.size })${
														model.recommended
															? ' - Recommended'
															: ''
													}`,
												} )
											) }
											onChange={ ( modelId ) => {
												setSelectedModel( modelId );
												saveModel( modelId );
											} }
										/>
										<Button
											variant="primary"
											onClick={ handleLoadModel }
										>
											{ status === 'error'
												? 'Retry'
												: 'Load Model' }
										</Button>
									</HStack>
									<Notice
										status="info"
										isDismissible={ false }
									>
										The AI model runs entirely in your
										browser using WebGPU. The first load
										will download model data (250MB-1GB
										depending on model), which is cached
										for future use. Using a Service Worker,
										the model stays loaded as you navigate
										wp-admin — no reload needed! No data is
										sent to external servers.
									</Notice>
									<Notice
										status="warning"
										isDismissible={ false }
									>
										<strong>Performance Tip:</strong> LLM
										thinking can be slow on integrated GPUs.
										For better performance in Chrome, visit{ ' ' }
										<code>
											chrome://flags/#force-high-performance-gpu
										</code>{ ' ' }
										and enable &quot;Force high performance
										GPU&quot;.
									</Notice>
								</VStack>
							) }

							{ providerMode === 'remote' && (
								<VStack spacing={ 3 }>
									<HStack
										alignment="end"
										spacing={ 2 }
										justify="flex-start"
									>
										<TextControl
											__nextHasNoMarginBottom
											type="url"
											label="Endpoint URL"
											value={ remoteUrl }
											onChange={ setRemoteUrl }
											placeholder="http://localhost:11434"
										/>
										<Button
											variant="secondary"
											onClick={ handleFetchModels }
											disabled={
												isFetchingModels || ! remoteUrl
											}
										>
											{ isFetchingModels
												? 'Fetching…'
												: 'Fetch Models' }
										</Button>
									</HStack>

									<TextControl
										__nextHasNoMarginBottom
										type="password"
										label="API Key (optional)"
										value={ remoteApiKey }
										onChange={ setRemoteApiKey }
										placeholder="sk-… (for OpenAI, Groq, etc.)"
									/>

									{ fetchError && (
										<Notice
											status="error"
											isDismissible={ false }
										>
											{ fetchError }
										</Notice>
									) }

									{ remoteModels.length > 0 && (
										<HStack
											alignment="end"
											spacing={ 2 }
											justify="flex-start"
										>
											<SelectControl
												__nextHasNoMarginBottom
												label="Model"
												value={ selectedRemoteModel }
												options={ remoteModels.map(
													( model ) => ( {
														value: model.id,
														label: model.name,
													} )
												) }
												onChange={ ( id ) => {
													setSelectedRemoteModel(
														id
													);
													saveProviderSettings( {
														remoteModel: id,
													} );
												} }
											/>
											<Button
												variant="primary"
												onClick={ handleConnectRemote }
												disabled={ ! isRemoteReady }
											>
												{ status === 'error'
													? 'Retry'
													: 'Connect' }
											</Button>
										</HStack>
									) }

									<Notice
										status="info"
										isDismissible={ false }
									>
										Connect to any OpenAI-compatible API
										endpoint (Ollama, LM Studio, vLLM,
										OpenAI, Groq, Together, etc.). Enter
										the base URL and fetch available
										models. API keys are stored in your
										browser only.
									</Notice>
								</VStack>
							) }

							{ providerMode === 'connector' && (
								<VStack spacing={ 3 }>
									{ connectorsLoading && <Spinner /> }
									{ ! connectorsLoading &&
										connectedConnectors.length > 0 && (
											<HStack
												alignment="end"
												spacing={ 2 }
												justify="flex-start"
											>
												<SelectControl
													__nextHasNoMarginBottom
													label="Connector"
													value={ selectedConnectorId }
													options={ [
														{
															value: '',
															label: 'Choose…',
															disabled: true,
														},
														...connectedConnectors.map(
															( c ) => ( {
																value: c.id,
																label: c.name,
															} )
														),
													] }
													onChange={ ( id ) => {
														setSelectedConnectorId(
															id
														);
														setSelectedConnectorModelId(
															''
														);
													} }
												/>
												{ selectedConnectorId &&
													connectorModels.length > 0 && (
														<SelectControl
															__nextHasNoMarginBottom
															label="Model"
															value={
																selectedConnectorModelId
															}
															options={ [
																{
																	value: '',
																	label: 'Choose a model…',
																	disabled: true,
																},
																...connectorModels.map(
																	( m ) => ( {
																		value: m.id,
																		label: m.name,
																	} )
																),
															] }
															onChange={ ( id ) =>
																setSelectedConnectorModelId(
																	id
																)
															}
														/>
													) }
												<Button
													variant="primary"
													onClick={ async () => {
														try {
															await modelLoader.loadConnector(
																selectedConnectorId,
																selectedConnectorModelId
															);
														} catch ( err ) {
															log.error(
																'Failed to use connector:',
																err
															);
														}
													} }
													disabled={
														! selectedConnectorId ||
														( connectorModels.length >
															0 &&
															! selectedConnectorModelId )
													}
												>
													Use this connector
												</Button>
											</HStack>
										) }
									{ ! connectorsLoading &&
										connectedConnectors.length === 0 && (
											<Notice
												status="info"
												isDismissible={ false }
											>
												No AI Connectors are configured
												yet.{ ' ' }
												<a href={ optionsUrl }>
													Configure connectors in
													Settings → Connectors
												</a>
												.
											</Notice>
										) }
									<Notice
										status="info"
										isDismissible={ false }
									>
										WP 7.0 ships a built-in AI Connector
										API. Any connector plugin you install
										and authenticate appears here
										automatically — Anthropic, Google,
										OpenAI, and any third-party
										ai_provider.
									</Notice>
								</VStack>
							) }
						</VStack>
					</CardBody>
				</Card>
			) }
		</div>
	);
};

export default ModelStatus;
