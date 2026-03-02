/**
 * Model Status Component
 *
 * Displays the AI model loading status with progress bar and controls.
 *
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import modelLoader, {
	ModelLoader,
	DEFAULT_MODEL,
} from '../services/model-loader';

/**
 * Get the saved model from localStorage
 *
 * @return {string} The saved model ID or DEFAULT_MODEL
 */
const getSavedModel = () => {
	try {
		const saved = localStorage.getItem( 'wp_agentic_admin_model' );
		return saved || DEFAULT_MODEL;
	} catch ( err ) {
		console.warn( 'Failed to load saved model from localStorage:', err );
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
		localStorage.setItem( 'wp_agentic_admin_model', modelId );
	} catch ( err ) {
		console.warn( 'Failed to save model to localStorage:', err );
	}
};

/**
 * Parse the loading stage from WebLLM progress message
 *
 * @param {string} message  - Progress message from WebLLM
 * @param {number} progress - Current progress percentage
 * @return {Object} Stage info with icon, title, and description
 */
const getLoadingStage = ( message, progress ) => {
	const lowerMsg = message.toLowerCase();

	if ( progress < 5 || lowerMsg.includes( 'webgpu' ) ) {
		return {
			icon: '🔍',
			title: 'Checking WebGPU',
			description: 'Verifying your browser supports GPU acceleration...',
		};
	}

	if (
		lowerMsg.includes( 'initializing' ) ||
		lowerMsg.includes( 'engine' )
	) {
		return {
			icon: '⚙️',
			title: 'Initializing Engine',
			description: 'Setting up the WebLLM inference engine...',
		};
	}

	if (
		lowerMsg.includes( 'loading model' ) ||
		lowerMsg.includes( 'fetching' )
	) {
		// Determine if downloading or loading from cache
		const isFromCache = lowerMsg.includes( 'cache' );
		const isDownloading =
			lowerMsg.includes( 'fetch' ) ||
			lowerMsg.includes( 'download' ) ||
			! isFromCache;

		return {
			icon: isFromCache ? '📦' : '⬇️',
			title: isFromCache
				? 'Loading Model Weights'
				: 'Downloading Model',
			description: isFromCache
				? 'Loading AI model weights from cache...'
				: 'Downloading AI model weights (~4.5GB)...',
		};
	}

	if ( lowerMsg.includes( 'shader' ) || lowerMsg.includes( 'compiling' ) ) {
		return {
			icon: '🔧',
			title: 'Compiling Shaders',
			description: 'Compiling GPU shaders for your graphics card...',
		};
	}

	if ( lowerMsg.includes( 'tokenizer' ) ) {
		return {
			icon: '📝',
			title: 'Loading Tokenizer',
			description: 'Loading the text tokenizer...',
		};
	}

	if ( progress >= 95 ) {
		return {
			icon: '✨',
			title: 'Finalizing',
			description: 'Almost ready! Final initialization...',
		};
	}

	// Default / generic loading
	return {
		icon: '🧠',
		title: 'Loading Model',
		description: message || 'Preparing AI model...',
	};
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
	initMessage,
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

	const availableModels = ModelLoader.getAvailableModels();

	// Track if we're in a loading state (init phase, loading, or checking)
	const isInLoadingState =
		initPhase !== null || status === 'loading' || status === 'checking';

	/**
	 * Update status when init phase changes
	 */
	useEffect( () => {
		if ( initPhase === 'loading' ) {
			setIsFromCache( true );
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
		if ( modelLoader.isModelReady() ) {
			setStatus( 'ready' );
			setMessage( 'AI model ready' );
			setProgress( 100 );
			// Get loaded model info
			const info = modelLoader.getLoadedModelInfo();
			setLoadedModelInfo( info );
			// Get memory stats
			modelLoader.getMemoryStats().then( ( stats ) => {
				setMemoryStats( stats );
			} );
		}
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
	 * Handle Load Model button click
	 */
	const handleLoadModel = useCallback( async () => {
		try {
			// Save the selected model before loading
			saveModel( selectedModel );
			await modelLoader.load( selectedModel );
		} catch ( err ) {
			console.error( 'Failed to load model:', err );
			// Error state is handled by the status callback
		}
	}, [ selectedModel ] );

	/**
	 * Handle Unload Model
	 */
	const handleUnloadModel = useCallback( async () => {
		await modelLoader.unload();
		setProgress( 0 );
		setIsFromCache( false );
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

	/**
	 * Get button text based on status
	 */
	const getButtonText = () => {
		switch ( status ) {
			case 'error':
				return 'Retry';
			case 'ready':
				return 'Unload Model';
			default:
				return 'Load Model';
		}
	};

	/**
	 * Get button click handler
	 */
	const getButtonHandler = () => {
		if ( status === 'ready' ) {
			return handleUnloadModel;
		}
		return handleLoadModel;
	};

	// Get current loading stage info - use init values during init phase, otherwise use model loader values
	const isInInitPhase = initPhase === 'checking';
	const displayProgress = isInInitPhase ? initProgress : progress;
	const loadingStage = isInInitPhase
		? { icon: '🔍', title: 'Initializing', description: initMessage }
		: getLoadingStage( rawMessage, progress );

	// Determine the main title for the loading card
	const getLoadingTitle = () => {
		if ( isInInitPhase ) {
			return 'Initializing';
		}
		if ( isFromCache ) {
			return 'Loading from Cache';
		}
		return 'Loading Model';
	};

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

					<p className="wp-agentic-admin-loading-card__description">
						{ loadingStage.description }
					</p>

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
								{ memoryStats?.available &&
								memoryStats?.formatted
									? memoryStats.formatted
									: `~${ loadedModelInfo.size } VRAM` }
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
											{ contextUsage.percentage }%
										</span>
									</span>
								) }
							</span>
						) }
					</div>

					{ status === 'checking' && <Spinner /> }

					{ ( status === 'not-loaded' ||
						status === 'error' ||
						status === 'ready' ) && (
						<div className="wp-agentic-admin-status__controls">
							{ status !== 'ready' && (
								<select
									className="wp-agentic-admin-model-select"
									value={ selectedModel }
									onChange={ ( e ) => {
										const modelId = e.target.value;
										setSelectedModel( modelId );
										saveModel( modelId );
									} }
									disabled={
										status === 'loading' ||
										status === 'checking'
									}
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
							) }
							<Button
								variant={
									status === 'ready' ? 'secondary' : 'primary'
								}
								onClick={ getButtonHandler() }
								disabled={
									status === 'loading' ||
									status === 'checking'
								}
								className="wp-agentic-admin-load-model"
							>
								{ getButtonText() }
							</Button>
						</div>
					) }
				</div>
			) }

			{ status === 'not-loaded' && (
				<p className="wp-agentic-admin-model-info">
					The AI model runs entirely in your browser using WebGPU. The
					first load will download model data (250MB-1GB depending on
					model), which is cached for future use. Using a Service
					Worker, the model stays loaded as you navigate wp-admin - no
					reload needed! No data is sent to external servers.
				</p>
			) }
		</div>
	);
};

export default ModelStatus;
