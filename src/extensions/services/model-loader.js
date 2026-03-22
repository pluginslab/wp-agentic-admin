/**
 * Model Loader Service
 *
 * Handles loading and managing the WebLLM model for in-browser AI inference.
 * Supports two modes:
 * 1. Service Worker mode (default) - Model persists across page navigations
 * 2. Page mode (fallback) - Model lives in the page, unloads on navigation
 *
 * @since 0.1.0
 */

import * as webllm from '@mlc-ai/web-llm';
import { ExternalEngine } from './external-engine';
import { createLogger } from '../utils/logger';

const log = createLogger( 'ModelLoader' );

/**
 * Default model configuration
 * Using Qwen3-1.7B for strong JSON/FC support and instruction following
 * See: https://github.com/mlc-ai/web-llm
 */
const DEFAULT_MODEL = 'Qwen3-1.7B-q4f16_1-MLC';

/**
 * Model configuration options
 */
const MODEL_CONFIG = {
	// Context window size (larger for 7B models)
	context_window_size: 8192,
};

/**
 * Mapping from f16 model IDs to their f32 equivalents.
 * Used when the GPU does not support the shader-f16 WebGPU feature.
 */
const F16_TO_F32_MODEL_MAP = {
	'Qwen3-1.7B-q4f16_1-MLC': 'Qwen3-1.7B-q4f32_1-MLC',
	'Qwen2.5-7B-Instruct-q4f16_1-MLC': 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
};

/**
 * Context window sizes for different models
 */
const MODEL_CONTEXT_SIZES = {
	'Qwen3-1.7B-q4f16_1-MLC': 8192,
	'Qwen3-1.7B-q4f32_1-MLC': 8192,
	'Qwen2.5-7B-Instruct-q4f16_1-MLC': 32768,
	'Qwen2.5-7B-Instruct-q4f32_1-MLC': 32768,
	// Default fallback
	default: 8192,
};

/**
 * Service Worker configuration
 */
const SW_CONFIG = {
	// Path to the service worker file (relative to plugin build directory)
	scriptPath: 'sw.js',
	// Keep-alive interval in ms (prevents SW from being terminated)
	keepAliveMs: 10000,
};

/**
 * ModelLoader class for managing WebLLM model lifecycle
 *
 * @since 0.1.0
 */
class ModelLoader {
	constructor() {
		this.engine = null;
		this.modelId = DEFAULT_MODEL;
		this.isLoading = false;
		this.isReady = false;
		this.loadProgress = 0;
		this.progressCallback = null;
		this.statusCallback = null;
		this.lastUsageStats = null;
		this.gpuAdapterInfo = null;
		this.f16Supported = null; // null = not checked, true/false = result

		// Service Worker state
		// Can be disabled via setUseServiceWorker(false) if issues found
		this.useServiceWorker = true;
		this.swRegistration = null;
		this.swSupported = null; // null = not checked, true/false = result

		// External provider state
		this.providerMode = 'local'; // 'local' or 'remote'
		this.externalEndpoint = '';
		this.externalApiKey = '';
	}

	/**
	 * Check if Service Worker mode is available and supported
	 *
	 * Requirements:
	 * - Browser supports Service Workers
	 * - Browser supports WebGPU
	 * - Browser is NOT Safari (Safari SW can't access WebGPU)
	 *
	 * @since 0.1.0
	 * @return {Promise<boolean>} True if SW mode is available
	 */
	async checkServiceWorkerSupport() {
		// Return cached result if already checked
		if ( this.swSupported !== null ) {
			return this.swSupported;
		}

		// Check basic SW support
		if ( ! ( 'serviceWorker' in navigator ) ) {
			log.info( 'Service Workers not supported' );
			this.swSupported = false;
			return false;
		}

		// Safari's Service Workers cannot access WebGPU APIs
		// Detect Safari: has Safari in UA but not Chrome/Chromium
		const isSafari = /^((?!chrome|android).)*safari/i.test(
			navigator.userAgent
		);
		if ( isSafari ) {
			log.info(
				'Safari detected - SW mode not supported (WebGPU unavailable in Safari SW)'
			);
			this.swSupported = false;
			return false;
		}

		// Check WebGPU support (required for WebLLM)
		const gpuCheck = await this.checkWebGPUSupport();
		if ( ! gpuCheck.supported ) {
			log.info( 'WebGPU not supported, SW mode unavailable' );
			this.swSupported = false;
			return false;
		}

		this.swSupported = true;
		log.info( 'Service Worker mode available' );
		return true;
	}

	/**
	 * Register the Service Worker
	 *
	 * The SW is registered with its default scope (the directory containing sw.js).
	 * This is fine because WebLLM uses postMessage for communication, not fetch interception.
	 * The model persists in the SW as long as any tab keeps the SW alive via heartbeats.
	 *
	 * @since 0.1.0
	 * @return {Promise<ServiceWorkerRegistration|null>} Registration or null if failed
	 */
	async registerServiceWorker() {
		if ( ! this.swSupported ) {
			const supported = await this.checkServiceWorkerSupport();
			if ( ! supported ) {
				log.info( 'Service Worker not supported, returning null' );
				return null;
			}
		}

		try {
			// Get the SW script URL from WordPress
			const swUrl = this.getServiceWorkerUrl();

			log.info( 'Registering Service Worker:', swUrl );
			log.info( 'Current location:', window.location.href );
			log.info( 'SW support checked:', this.swSupported );

			// Register with /wp-admin/ scope so SW can control admin pages
			// The PHP backend sets Service-Worker-Allowed header to allow this broader scope
			this.swRegistration = await navigator.serviceWorker.register(
				swUrl,
				{
					type: 'module',
					scope: '/wp-admin/',
				}
			);

			log.info(
				'SW registered, state:',
				// eslint-disable-next-line no-nested-ternary -- intentional status message selection
				this.swRegistration.installing
					? 'installing'
					: this.swRegistration.waiting
					? 'waiting'
					: // eslint-disable-next-line no-nested-ternary -- intentional status message selection
					this.swRegistration.active
					? 'active'
					: 'unknown'
			);

			// Don't wait for navigator.serviceWorker.ready - it may hang on first load
			// The SW uses skipWaiting() and clients.claim() so it activates immediately
			// WebLLM's CreateServiceWorkerMLCEngine uses postMessage and doesn't need the SW to be "controlling"
			log.info( 'Service Worker registration complete, proceeding...' );

			log.info( 'Service Worker registered successfully' );
			log.info( 'SW Scope:', this.swRegistration.scope );
			log.info( 'Page URL:', window.location.href );
			log.info(
				'SW controlling page?:',
				navigator.serviceWorker.controller ? 'YES' : 'NO'
			);
			if ( navigator.serviceWorker.controller ) {
				log.info(
					'Controller URL:',
					navigator.serviceWorker.controller.scriptURL
				);
			}
			return this.swRegistration;
		} catch ( err ) {
			log.error( 'Service Worker registration failed:', err );
			this.swSupported = false;
			return null;
		}
	}

	/**
	 * Wait for Service Worker to become active
	 *
	 * @since 0.1.0
	 * @param {ServiceWorkerRegistration} registration - The SW registration
	 * @return {Promise<ServiceWorker|null>} The active worker or null
	 */
	async waitForActiveWorker( registration ) {
		log.info( 'waitForActiveWorker called' );
		log.info( 'registration.active:', registration.active );
		log.info( 'registration.installing:', registration.installing );
		log.info( 'registration.waiting:', registration.waiting );

		// If already active, return immediately
		if ( registration.active ) {
			log.info( 'SW is already active' );
			return registration.active;
		}

		// Poll for the SW to become active (with timeout)
		log.info( 'Polling for SW to become active...' );
		const startTime = Date.now();
		const timeout = 5000; // 5 seconds

		while ( Date.now() - startTime < timeout ) {
			// Check if it's active now
			if ( registration.active ) {
				log.info( 'SW is now active!' );
				return registration.active;
			}

			// Wait a bit before checking again
			await new Promise( ( resolve ) => setTimeout( resolve, 50 ) );

			// Log current state every 500ms
			if ( ( Date.now() - startTime ) % 500 < 50 ) {
				// eslint-disable-next-line no-nested-ternary -- intentional status message selection
				const state = registration.installing
					? 'installing'
					: registration.waiting
					? 'waiting'
					: // eslint-disable-next-line no-nested-ternary -- intentional status message selection
					registration.active
					? 'active'
					: 'unknown';
				log.info( 'Still waiting... current state:', state );
			}
		}

		log.error( 'Timeout waiting for SW to activate' );
		return null;
	}

	/**
	 * Get the Service Worker script URL
	 *
	 * Uses the WordPress-provided plugin URL to construct the full path
	 *
	 * @since 0.1.0
	 * @return {string} Full URL to sw.js
	 */
	getServiceWorkerUrl() {
		// Use PHP loader that adds Service-Worker-Allowed header
		// wpAgenticAdmin is set by PHP wp_localize_script
		if (
			typeof window.wpAgenticAdmin !== 'undefined' &&
			window.wpAgenticAdmin.pluginUrl
		) {
			return `${ window.wpAgenticAdmin.pluginUrl }sw-loader.php`;
		}

		// Fallback: relative path to PHP loader
		log.warn( 'wpAgenticAdmin.pluginUrl not found, using relative path' );
		return '/wp-content/plugins/wp-agentic-admin/sw-loader.php';
	}

	/**
	 * Check if a model is already cached in the browser
	 *
	 * @param {string|null} modelId - Model ID to check, defaults to current model
	 * @return {Promise<boolean>} True if model is cached
	 */
	async isModelCached( modelId = null ) {
		const id = modelId || this.modelId;
		try {
			const isCached = await webllm.hasModelInCache( id );
			log.info( `Model ${ id } cached:`, isCached );
			return isCached;
		} catch ( err ) {
			log.warn( 'Error checking cache:', err );
			return false;
		}
	}

	/**
	 * Check if WebGPU is supported
	 *
	 * @return {Promise<Object>} Support status and reason if not supported
	 */
	async checkWebGPUSupport() {
		// WebGPU requires a secure context (HTTPS or localhost)
		if ( ! window.isSecureContext ) {
			return {
				supported: false,
				reason: 'WebGPU is not accessible over HTTP. Please access your website over HTTPS.',
			};
		}

		if ( ! navigator.gpu ) {
			return {
				supported: false,
				reason: 'WebGPU is not available in this browser. Please use Chrome 113+, Edge 113+, or another WebGPU-enabled browser.',
			};
		}

		try {
			const adapter = await navigator.gpu.requestAdapter();
			if ( ! adapter ) {
				return {
					supported: false,
					reason: 'No WebGPU adapter found. Your GPU may not be supported.',
				};
			}

			// Get adapter info for logging - handle both old and new API
			let info = {};
			try {
				if ( adapter.info ) {
					info = adapter.info;
				} else if ( typeof adapter.requestAdapterInfo === 'function' ) {
					info = await adapter.requestAdapterInfo();
				}
			} catch ( infoErr ) {
				log.warn( 'Could not get adapter info:', infoErr );
			}

			log.info( 'WebGPU Adapter:', info );

			// Check for shader-f16 support (required for q4f16 models)
			this.f16Supported = adapter.features.has( 'shader-f16' );
			log.info(
				'WebGPU shader-f16:',
				this.f16Supported ? 'supported' : 'not supported'
			);

			// Store adapter info for later use
			this.gpuAdapterInfo = {
				vendor: info.vendor || 'Unknown',
				architecture: info.architecture || 'Unknown',
				device: info.device || 'Unknown',
				description: info.description || '',
				maxBufferSize: adapter.limits?.maxBufferSize || 0,
			};

			return {
				supported: true,
				adapter: info,
			};
		} catch ( err ) {
			return {
				supported: false,
				reason: `WebGPU initialization error: ${ err.message }`,
			};
		}
	}

	/**
	 * Set progress callback for loading updates
	 *
	 * @param {Function} callback - Called with (progress, message)
	 */
	onProgress( callback ) {
		this.progressCallback = callback;
	}

	/**
	 * Set status callback for status changes
	 *
	 * @param {Function} callback - Called with (status, message)
	 */
	onStatus( callback ) {
		this.statusCallback = callback;
	}

	/**
	 * Report progress update
	 *
	 * @param {number} progress - Progress percentage (0-100)
	 * @param {string} message  - Status message
	 */
	reportProgress( progress, message ) {
		this.loadProgress = progress;
		if ( this.progressCallback ) {
			this.progressCallback( progress, message );
		}
	}

	/**
	 * Report status change
	 *
	 * @param {string} status  - Status string
	 * @param {string} message - Status message
	 */
	reportStatus( status, message ) {
		if ( this.statusCallback ) {
			this.statusCallback( status, message );
		}
	}

	/**
	 * Initialize and load the WebLLM engine
	 *
	 * Attempts to use Service Worker mode first, falls back to page mode if unavailable.
	 *
	 * @since 0.1.0
	 * @param {string|null} modelId - Optional model ID override
	 * @return {Promise<boolean>} True if loaded successfully
	 */
	async load( modelId = null ) {
		if ( this.isLoading ) {
			throw new Error( 'Model is already loading' );
		}

		if ( this.isReady && this.engine ) {
			log.info( 'Model already loaded' );
			return true;
		}

		this.isLoading = true;
		this.modelId = modelId || DEFAULT_MODEL;

		try {
			// Check WebGPU support first
			this.reportStatus( 'checking', 'Checking WebGPU support...' );
			this.reportProgress( 0, 'Checking WebGPU support...' );

			const gpuCheck = await this.checkWebGPUSupport();
			if ( ! gpuCheck.supported ) {
				throw new Error( gpuCheck.reason );
			}

			// Auto-fallback: if shader-f16 is not supported, switch to f32 variant
			if ( ! this.f16Supported && F16_TO_F32_MODEL_MAP[ this.modelId ] ) {
				const f32Model = F16_TO_F32_MODEL_MAP[ this.modelId ];
				log.info(
					`GPU lacks shader-f16, switching from ${ this.modelId } to ${ f32Model }`
				);
				this.modelId = f32Model;
			}

			this.reportProgress(
				5,
				'WebGPU supported. Initializing engine...'
			);

			// Determine which mode to use
			const useSW =
				this.useServiceWorker &&
				( await this.checkServiceWorkerSupport() );

			if ( useSW ) {
				await this.loadWithServiceWorker();
			} else {
				await this.loadWithoutServiceWorker();
			}

			this.reportProgress( 100, 'Model loaded successfully!' );
			this.reportStatus( 'ready', 'AI model ready' );
			this.isReady = true;
			this.isLoading = false;

			const mode = useSW ? 'Service Worker' : 'Page';
			log.info( `WebLLM model loaded (${ mode } mode):`, this.modelId );
			return true;
		} catch ( err ) {
			this.isLoading = false;
			this.isReady = false;
			this.engine = null;
			this.reportStatus(
				'error',
				`Failed to load model: ${ err.message }`
			);
			log.error( 'Failed to load WebLLM model:', err );
			throw err;
		}
	}

	/**
	 * Load an external model via OpenAI-compatible API
	 *
	 * @since 0.10.0
	 * @param {string} endpointUrl - Base URL (e.g. "http://localhost:11434")
	 * @param {string} modelId     - Model identifier
	 * @param {string} apiKey      - Optional API key
	 * @return {Promise<boolean>} True if connected successfully
	 */
	async loadExternal( endpointUrl, modelId, apiKey = '' ) {
		if ( this.isLoading ) {
			throw new Error( 'Model is already loading' );
		}

		this.isLoading = true;
		this.providerMode = 'remote';
		this.externalEndpoint = endpointUrl;
		this.externalApiKey = apiKey;
		this.modelId = modelId;

		try {
			this.reportStatus(
				'loading',
				'Connecting to external provider...'
			);
			this.reportProgress( 50, 'Connecting to external provider...' );

			this.engine = new ExternalEngine( endpointUrl, modelId, apiKey );

			this.reportProgress( 100, 'Connected to external provider!' );
			this.reportStatus( 'ready', 'External model ready' );
			this.isReady = true;
			this.isLoading = false;

			log.info( 'External model loaded:', modelId, 'at', endpointUrl );
			return true;
		} catch ( err ) {
			this.isLoading = false;
			this.isReady = false;
			this.engine = null;
			this.providerMode = 'local';
			this.reportStatus( 'error', `Failed to connect: ${ err.message }` );
			log.error( 'Failed to load external model:', err );
			throw err;
		}
	}

	/**
	 * Check if using an external provider
	 *
	 * @since 0.10.0
	 * @return {boolean} True if using external provider
	 */
	isExternalProvider() {
		return this.providerMode === 'remote';
	}

	/**
	 * Load the model using Service Worker mode
	 *
	 * Model persists across page navigations while any tab is open.
	 *
	 * @since 0.1.0
	 * @private
	 */
	async loadWithServiceWorker() {
		this.reportStatus( 'loading', 'Registering Service Worker...' );
		this.reportProgress( 8, 'Registering Service Worker...' );

		// Register SW if not already registered
		const registration = await this.registerServiceWorker();
		if ( ! registration ) {
			log.warn( 'SW registration failed, falling back to page mode' );
			this.useServiceWorker = false;
			return this.loadWithoutServiceWorker();
		}

		// Wait for SW to be active before trying to communicate with it
		// The SW uses skipWaiting() but we still need to wait for it to become active
		log.info( 'Waiting for Service Worker to become active...' );
		this.reportStatus(
			'loading',
			'Waiting for Service Worker to activate...'
		);
		this.reportProgress( 9, 'Waiting for Service Worker...' );

		// Wait for the SW to be active (with timeout)
		const activeWorker = await Promise.race( [
			this.waitForActiveWorker( registration ),
			new Promise( ( _, reject ) =>
				setTimeout(
					() => reject( new Error( 'SW activation timeout' ) ),
					5000
				)
			),
		] );

		if ( ! activeWorker ) {
			log.warn( 'SW failed to activate, falling back to page mode' );
			this.useServiceWorker = false;
			return this.loadWithoutServiceWorker();
		}

		log.info(
			'Service Worker is active, proceeding with engine creation...'
		);

		// CRITICAL: Wait for SW to be controlling this page
		// Hard refresh (Shift+Cmd+R) kills navigator.serviceWorker.controller
		// WebLLM needs this to communicate with the SW
		if ( ! navigator.serviceWorker.controller ) {
			log.info(
				'SW not controlling page yet, waiting for controllerchange...'
			);
			this.reportStatus(
				'loading',
				'Waiting for Service Worker control...'
			);

			// Wait for controller to be set (happens after activation + clients.claim())
			const controllerPromise = new Promise( ( resolve ) => {
				if ( navigator.serviceWorker.controller ) {
					resolve();
				} else {
					navigator.serviceWorker.addEventListener(
						'controllerchange',
						() => {
							log.info(
								'Controller changed, SW now controlling page'
							);
							resolve();
						},
						{ once: true }
					);
				}
			} );

			try {
				await Promise.race( [
					controllerPromise,
					new Promise( ( _, reject ) =>
						setTimeout(
							() =>
								reject( new Error( 'SW controller timeout' ) ),
							3000
						)
					),
				] );
			} catch ( err ) {
				log.warn( 'Timeout waiting for SW controller:', err );
				log.warn( 'Falling back to page mode' );
				this.useServiceWorker = false;
				return this.loadWithoutServiceWorker();
			}
		}

		log.info( 'SW is controlling page, ready for engine creation' );

		this.reportStatus(
			'loading',
			'Initializing WebLLM engine in Service Worker...'
		);
		this.reportProgress( 10, 'Initializing WebLLM engine...' );

		// Create progress callback for WebLLM
		const initProgressCallback = ( report ) => {
			log.info( 'Init progress:', report.progress, report.text );
			const progress = Math.round( 10 + report.progress * 85 ); // Scale to 10-95%
			this.reportProgress( progress, report.text );
		};

		log.info( 'About to call CreateServiceWorkerMLCEngine...' );
		log.info( 'Model ID:', this.modelId );
		log.info( 'Keep-alive interval:', SW_CONFIG.keepAliveMs );
		log.info( 'SW registration:', this.swRegistration );
		log.info( 'Active worker:', activeWorker );

		// Create the Service Worker MLCEngine
		// This sends messages to the SW which holds the actual engine
		try {
			log.info( 'Calling CreateServiceWorkerMLCEngine NOW...' );
			log.info( 'Parameters:' );
			log.debug( '  - modelId:', this.modelId );
			log.debug( '  - registration:', this.swRegistration );
			log.debug( '  - keepAliveMs:', SW_CONFIG.keepAliveMs );

			// WebLLM uses navigator.serviceWorker.controller internally
			// Don't pass the registration - it can't be cloned for postMessage
			this.engine = await webllm.CreateServiceWorkerMLCEngine(
				this.modelId,
				{
					initProgressCallback,
				},
				undefined, // Let WebLLM use navigator.serviceWorker.controller
				SW_CONFIG.keepAliveMs
			);
			log.info( 'CreateServiceWorkerMLCEngine returned successfully' );
		} catch ( err ) {
			log.error( 'CreateServiceWorkerMLCEngine failed:', err );
			log.error( 'Error details:', err.message, err.stack );
			throw err;
		}

		log.info( 'Service Worker MLCEngine created' );
	}

	/**
	 * Load the model in page mode (fallback)
	 *
	 * Model lives in the page and unloads on navigation.
	 *
	 * @since 0.1.0
	 * @private
	 */
	async loadWithoutServiceWorker() {
		this.reportStatus( 'loading', 'Initializing WebLLM engine...' );
		this.reportProgress( 10, 'Initializing WebLLM engine (page mode)...' );

		// Create progress callback for WebLLM
		const initProgressCallback = ( report ) => {
			const progress = Math.round( 10 + report.progress * 85 );
			this.reportProgress( progress, report.text );
		};

		// Create the regular MLCEngine (page-local)
		this.engine = await webllm.CreateMLCEngine( this.modelId, {
			initProgressCallback,
		} );

		log.info( 'Page-local MLCEngine created' );
	}

	/**
	 * Set whether to use Service Worker mode
	 *
	 * Must be called before load() to take effect.
	 *
	 * @since 0.1.0
	 * @param {boolean} useSW - Whether to use Service Worker mode
	 */
	setUseServiceWorker( useSW ) {
		if ( this.isReady || this.isLoading ) {
			log.warn( 'Cannot change mode while model is loaded/loading' );
			return;
		}
		this.useServiceWorker = useSW;
	}

	/**
	 * Check if currently using Service Worker mode
	 *
	 * @since 0.1.0
	 * @return {boolean} True if using SW mode
	 */
	isUsingServiceWorker() {
		return this.useServiceWorker && this.swRegistration !== null;
	}

	/**
	 * Check if the GPU supports shader-f16 (half-precision)
	 *
	 * Returns null if not yet checked (call checkWebGPUSupport() first).
	 *
	 * @since 0.1.0
	 * @return {boolean|null} True if f16 supported, false if not, null if unchecked
	 */
	hasF16Support() {
		return this.f16Supported;
	}

	/**
	 * Get the loaded engine instance
	 *
	 * @return {Object|null} The WebLLM engine or null if not loaded
	 */
	getEngine() {
		return this.engine;
	}

	/**
	 * Check if the model is ready for inference
	 *
	 * @return {boolean} True if ready
	 */
	isModelReady() {
		return this.isReady && this.engine !== null;
	}

	/**
	 * Unload the model and free resources
	 *
	 * In Service Worker mode, this signals the SW to unload the model
	 * but keeps the SW alive for potential future use.
	 *
	 * @since 0.1.0
	 */
	async unload() {
		if ( this.engine ) {
			try {
				await this.engine.unload();
				log.info( 'Model unloaded' );
			} catch ( err ) {
				log.warn( 'Error unloading model:', err );
			}
			this.engine = null;
		}
		this.isReady = false;
		this.isLoading = false;
		this.loadProgress = 0;
		this.providerMode = 'local';
		this.externalEndpoint = '';
		this.externalApiKey = '';
		this.reportStatus( 'not-loaded', 'Model unloaded' );
	}

	/**
	 * Reset the chat context (clear conversation history in the engine)
	 */
	async resetChat() {
		if ( this.engine ) {
			await this.engine.resetChat();
		}
	}

	/**
	 * Get the current model ID
	 *
	 * @return {string} The model ID
	 */
	getModelId() {
		return this.modelId;
	}

	/**
	 * Update usage stats from a completion response
	 * Call this after each chat completion to track performance
	 *
	 * @param {Object} usage - Usage object from ChatCompletion or ChatCompletionChunk
	 */
	updateUsageStats( usage ) {
		if ( usage ) {
			this.lastUsageStats = {
				...usage,
				timestamp: Date.now(),
			};
			log.info( 'Updated usage stats:', this.lastUsageStats );
		}
	}

	/**
	 * Get the last recorded usage stats
	 *
	 * @return {Object|null} Last usage stats or null
	 */
	getLastUsageStats() {
		return this.lastUsageStats;
	}

	/**
	 * Get detailed info about the currently loaded model
	 *
	 * @return {Object|null} Model info with name, size, etc. or null if no model loaded
	 */
	getLoadedModelInfo() {
		if ( ! this.isReady || ! this.modelId ) {
			return null;
		}

		// External provider — model isn't in our static list
		if ( this.isExternalProvider() ) {
			return {
				id: this.modelId,
				name: this.modelId,
				size: 'Remote',
				description: `External model via ${ this.externalEndpoint }`,
				mode: 'external',
			};
		}

		const models = ModelLoader.getAvailableModels();
		const modelInfo = models.find( ( m ) => m.id === this.modelId );

		if ( modelInfo ) {
			return {
				id: this.modelId,
				name: modelInfo.name,
				size: modelInfo.size,
				description: modelInfo.description,
				mode: this.isUsingServiceWorker() ? 'service-worker' : 'page',
			};
		}

		// Fallback for unknown models
		return {
			id: this.modelId,
			name: this.modelId,
			size: 'Unknown',
			description: '',
			mode: this.isUsingServiceWorker() ? 'service-worker' : 'page',
		};
	}

	/**
	 * Get GPU/VRAM usage statistics if available
	 * Note: WebGPU doesn't provide direct memory APIs, but we can estimate
	 *
	 * @return {Promise<Object|null>} Memory stats or null if unavailable
	 */
	async getMemoryStats() {
		if ( ! this.isReady || ! this.engine ) {
			return null;
		}

		try {
			// Check if we have usage stats from recent completions
			if ( this.lastUsageStats ) {
				const usage = this.lastUsageStats;
				let formatted = '';
				if ( usage.extra?.decode_tokens_per_s ) {
					const decodeTps =
						usage.extra.decode_tokens_per_s.toFixed( 1 );
					formatted = `GS ${ decodeTps } t/s`;

					if ( usage.extra?.prefill_tokens_per_s ) {
						const prefillTps =
							usage.extra.prefill_tokens_per_s.toFixed( 1 );
						formatted = `PS ${ prefillTps } t/s · GS ${ decodeTps } t/s`;
					}

					return {
						usage,
						formatted,
						decodeTps: usage.extra.decode_tokens_per_s,
						prefillTps: usage.extra?.prefill_tokens_per_s,
						available: true,
					};
				}

				// Fallback: just show token counts
				if ( usage.completion_tokens ) {
					return {
						usage,
						formatted: `${ usage.completion_tokens } tokens generated`,
						available: true,
					};
				}
			}

			// Get model info for estimated size
			const modelInfo = this.getLoadedModelInfo();
			if ( modelInfo ) {
				return {
					estimatedSize: modelInfo.size,
					available: false,
					message: 'Estimated from model size',
				};
			}

			return null;
		} catch ( err ) {
			log.warn( 'Error getting memory stats:', err );
			return null;
		}
	}

	/**
	 * Get the effective context window size for a model.
	 * Checks localStorage override first, then falls back to MODEL_CONTEXT_SIZES.
	 *
	 * @param {string} modelId - Model identifier
	 * @return {number} Context window size in tokens
	 */
	static getEffectiveContextSize( modelId ) {
		try {
			const saved = localStorage.getItem(
				'wp_agentic_admin_context_size'
			);
			if ( saved ) {
				const parsed = JSON.parse( saved );
				if ( parsed[ modelId ] ) {
					return parsed[ modelId ];
				}
			}
		} catch ( e ) {
			// Ignore parse errors
		}
		return MODEL_CONTEXT_SIZES[ modelId ] || MODEL_CONTEXT_SIZES.default;
	}

	/**
	 * Estimate available GPU VRAM from WebGPU adapter limits.
	 * maxBufferSize is a rough proxy for total GPU memory.
	 *
	 * @return {number} Estimated VRAM in GB, or 0 if unknown
	 */
	getEstimatedVRAM() {
		if ( ! this.gpuAdapterInfo?.maxBufferSize ) {
			return 0;
		}
		// maxBufferSize is typically 25-50% of total VRAM.
		// Use a 2x multiplier as a conservative estimate.
		const estimatedBytes = this.gpuAdapterInfo.maxBufferSize * 2;
		return Math.round( ( estimatedBytes / 1024 ** 3 ) * 10 ) / 10;
	}

	/**
	 * Get recommended context window size based on estimated VRAM and model.
	 *
	 * @param {string} modelId - Model identifier
	 * @return {Object} Recommendation with size, reasoning, and tier info
	 */
	getRecommendedContextSize( modelId ) {
		const estimatedVRAM = this.getEstimatedVRAM();
		const model = ModelLoader.getAvailableModels().find(
			( m ) => m.id === modelId
		);
		const modelVRAM = model
			? parseFloat( model.vram.replace( /[^0-9.]/g, '' ) )
			: 1.5;

		const remainingVRAM = estimatedVRAM - modelVRAM;
		const maxBuffer = this.gpuAdapterInfo?.maxBufferSize || 0;
		const maxBufferGB = Math.round( ( maxBuffer / 1024 ** 3 ) * 100 ) / 100;

		let recommended, tier, reasoning;
		if ( estimatedVRAM === 0 ) {
			recommended =
				MODEL_CONTEXT_SIZES[ modelId ] || MODEL_CONTEXT_SIZES.default;
			tier = 'unknown';
			reasoning =
				'Could not detect GPU memory. Using default context size.';
		} else if ( remainingVRAM < 1 ) {
			recommended = 2048;
			tier = 'minimal';
			reasoning = `Only ~${ remainingVRAM.toFixed(
				1
			) }GB available after model weights (${ modelVRAM }GB). Minimal context recommended.`;
		} else if ( remainingVRAM < 2 ) {
			recommended = 4096;
			tier = 'conservative';
			reasoning = `~${ remainingVRAM.toFixed(
				1
			) }GB available after model weights. Conservative context for stable operation.`;
		} else if ( remainingVRAM < 4 ) {
			recommended = 8192;
			tier = 'balanced';
			reasoning = `~${ remainingVRAM.toFixed(
				1
			) }GB available after model weights. Good balance of context and performance.`;
		} else if ( remainingVRAM < 8 ) {
			recommended = 16384;
			tier = 'generous';
			reasoning = `~${ remainingVRAM.toFixed(
				1
			) }GB available after model weights. Large context window possible.`;
		} else {
			recommended = 32768;
			tier = 'maximum';
			reasoning = `~${ remainingVRAM.toFixed(
				1
			) }GB available after model weights. Maximum context window.`;
		}

		return {
			recommended,
			tier,
			reasoning,
			estimatedVRAM,
			modelVRAM,
			remainingVRAM: Math.max( 0, remainingVRAM ),
			maxBufferGB,
			currentDefault:
				MODEL_CONTEXT_SIZES[ modelId ] || MODEL_CONTEXT_SIZES.default,
		};
	}

	/**
	 * Get GPU adapter info (vendor, architecture, device)
	 *
	 * @return {Object|null} GPU info or null if not available
	 */
	getGPUInfo() {
		return this.gpuAdapterInfo;
	}

	/**
	 * Get context window usage information
	 *
	 * @return {Object|null} Context usage info or null if not available
	 */
	getContextUsage() {
		if ( ! this.isReady ) {
			return null;
		}

		const maxContext = ModelLoader.getEffectiveContextSize( this.modelId );
		const usedTokens = this.lastUsageStats?.prompt_tokens || 0;
		const percentage = Math.round( ( usedTokens / maxContext ) * 100 );

		return {
			used: usedTokens,
			max: maxContext,
			percentage: Math.min( percentage, 100 ),
			isHigh: percentage >= 75,
			isCritical: percentage >= 90,
		};
	}

	/**
	 * Reset context usage stats (e.g., when chat is cleared)
	 */
	resetContextUsage() {
		this.lastUsageStats = null;
		log.info( 'Context usage reset' );
	}

	/**
	 * Get available models list
	 * These are from WebLLM's prebuilt model repository
	 *
	 * @return {Array} List of available model configurations
	 */
	static getAvailableModels() {
		return [
			{
				id: 'Qwen3-1.7B-q4f16_1-MLC',
				name: 'Qwen 3 1.7B (Q4 F16)',
				size: '~1.2GB',
				vram: '~1.5GB',
				description:
					'Alibaba Qwen 3 1.7B. Fast inference, native tool calling support, lightweight. Requires shader-f16.',
				recommended: true,
				requiresF16: true,
				capabilities: [
					'function calling',
					'JSON output',
					'fast inference',
				],
			},
			{
				id: 'Qwen3-1.7B-q4f32_1-MLC',
				name: 'Qwen 3 1.7B (Q4 F32)',
				size: '~1.8GB',
				vram: '~2GB',
				description:
					'Alibaba Qwen 3 1.7B with 32-bit activations. Works on all WebGPU GPUs (no shader-f16 needed).',
				recommended: false,
				requiresF16: false,
				capabilities: [
					'function calling',
					'JSON output',
					'fast inference',
				],
			},
			{
				id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
				name: 'Qwen 2.5 7B (Q4 F16)',
				size: '~4.5GB',
				vram: '~5GB',
				description:
					'Alibaba Qwen 2.5 7B. Strong JSON output, reliable function calling, excellent instruction following. Requires shader-f16.',
				recommended: false,
				requiresF16: true,
				capabilities: [
					'function calling',
					'complex workflows',
					'advanced reasoning',
					'JSON output',
				],
			},
			{
				id: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
				name: 'Qwen 2.5 7B (Q4 F32)',
				size: '~6.5GB',
				vram: '~7GB',
				description:
					'Alibaba Qwen 2.5 7B with 32-bit activations. Works on all WebGPU GPUs (no shader-f16 needed).',
				recommended: false,
				requiresF16: false,
				capabilities: [
					'function calling',
					'complex workflows',
					'advanced reasoning',
					'JSON output',
				],
			},
		];
	}
}

// Create singleton instance
const modelLoader = new ModelLoader();

export {
	ModelLoader,
	modelLoader,
	DEFAULT_MODEL,
	MODEL_CONFIG,
	MODEL_CONTEXT_SIZES,
	ExternalEngine,
};
export default modelLoader;
