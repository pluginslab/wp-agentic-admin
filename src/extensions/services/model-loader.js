/**
 * Model Loader Service
 *
 * Handles loading and managing the WebLLM model for in-browser AI inference.
 * Supports two modes:
 * 1. Service Worker mode (default) - Model persists across page navigations
 * 2. Page mode (fallback) - Model lives in the page, unloads on navigation
 *
 * @package WPNeuralAdmin
 * @since 1.0.0
 * @updated 1.2.0 - Added Service Worker support for model persistence
 */

import * as webllm from '@mlc-ai/web-llm';

/**
 * Default model configuration
 * Using Qwen2.5-1.5B for better understanding and reasoning capability
 * See: https://github.com/mlc-ai/web-llm
 *
 * v1.1: Upgraded from SmolLM2-360M (~250MB) to Qwen2.5-1.5B (~1.6GB)
 * for improved multi-step workflow understanding
 */
const DEFAULT_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

/**
 * Model configuration options
 */
const MODEL_CONFIG = {
	// Context window size (smaller = faster, less memory)
	context_window_size: 2048,
};

/**
 * Context window sizes for different models
 */
const MODEL_CONTEXT_SIZES = {
	'SmolLM2-360M-Instruct-q4f16_1-MLC': 2048,
	'SmolLM2-1.7B-Instruct-q4f16_1-MLC': 2048,
	'Qwen2.5-0.5B-Instruct-q4f16_1-MLC': 2048,
	'Qwen2.5-1.5B-Instruct-q4f16_1-MLC': 4096, // Qwen 1.5B supports larger context
	'Qwen2.5-3B-Instruct-q4f16_1-MLC': 4096,
	'Llama-3.2-1B-Instruct-q4f16_1-MLC': 2048,
	'Llama-3.2-3B-Instruct-q4f16_1-MLC': 4096,
	// Default fallback
	default: 2048,
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
 * @since 1.0.0
 * @updated 1.2.0 - Added Service Worker support
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

		// Service Worker state (v1.2)
		this.useServiceWorker = true; // Default to SW mode
		this.swRegistration = null;
		this.swSupported = null; // null = not checked, true/false = result
	}

	/**
	 * Check if Service Worker mode is available and supported
	 *
	 * Requirements:
	 * - Browser supports Service Workers
	 * - Browser supports WebGPU
	 * - Browser is NOT Safari (Safari SW can't access WebGPU)
	 *
	 * @since 1.2.0
	 * @return {Promise<boolean>} True if SW mode is available
	 */
	async checkServiceWorkerSupport() {
		// Return cached result if already checked
		if (this.swSupported !== null) {
			return this.swSupported;
		}

		// Check basic SW support
		if (!('serviceWorker' in navigator)) {
			console.log('[ModelLoader] Service Workers not supported');
			this.swSupported = false;
			return false;
		}

		// Safari's Service Workers cannot access WebGPU APIs
		// Detect Safari: has Safari in UA but not Chrome/Chromium
		const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
		if (isSafari) {
			console.log('[ModelLoader] Safari detected - SW mode not supported (WebGPU unavailable in Safari SW)');
			this.swSupported = false;
			return false;
		}

		// Check WebGPU support (required for WebLLM)
		const gpuCheck = await this.checkWebGPUSupport();
		if (!gpuCheck.supported) {
			console.log('[ModelLoader] WebGPU not supported, SW mode unavailable');
			this.swSupported = false;
			return false;
		}

		this.swSupported = true;
		console.log('[ModelLoader] Service Worker mode available');
		return true;
	}

	/**
	 * Register the Service Worker
	 *
	 * The SW is registered with its default scope (the directory containing sw.js).
	 * This is fine because WebLLM uses postMessage for communication, not fetch interception.
	 * The model persists in the SW as long as any tab keeps the SW alive via heartbeats.
	 *
	 * @since 1.2.0
	 * @return {Promise<ServiceWorkerRegistration|null>} Registration or null if failed
	 */
	async registerServiceWorker() {
		if (!this.swSupported) {
			const supported = await this.checkServiceWorkerSupport();
			if (!supported) {
				return null;
			}
		}

		try {
			// Get the SW script URL from WordPress
			const swUrl = this.getServiceWorkerUrl();

			console.log('[ModelLoader] Registering Service Worker:', swUrl);

			// Register with default scope (plugin's build-extensions directory)
			// WebLLM communicates via postMessage, so scope doesn't limit functionality
			this.swRegistration = await navigator.serviceWorker.register(swUrl, {
				type: 'module',
			});

			// Wait for the SW to be active
			if (this.swRegistration.installing) {
				console.log('[ModelLoader] Service Worker installing...');
				await new Promise((resolve) => {
					const sw = this.swRegistration.installing;
					sw.addEventListener('statechange', () => {
						if (sw.state === 'activated') {
							resolve();
						}
					});
				});
			} else if (this.swRegistration.waiting) {
				console.log('[ModelLoader] Service Worker waiting...');
				// SW is installed but waiting, skip waiting
				this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
				await new Promise((resolve) => {
					const sw = this.swRegistration.waiting;
					sw.addEventListener('statechange', () => {
						if (sw.state === 'activated') {
							resolve();
						}
					});
				});
			}

			console.log('[ModelLoader] Service Worker registered successfully');
			console.log('[ModelLoader] SW Scope:', this.swRegistration.scope);
			return this.swRegistration;
		} catch (err) {
			console.error('[ModelLoader] Service Worker registration failed:', err);
			this.swSupported = false;
			return null;
		}
	}

	/**
	 * Get the Service Worker script URL
	 *
	 * Uses the WordPress-provided plugin URL to construct the full path
	 *
	 * @since 1.2.0
	 * @return {string} Full URL to sw.js
	 */
	getServiceWorkerUrl() {
		// wpNeuralAdmin is set by PHP wp_localize_script
		if (
			typeof window.wpNeuralAdmin !== 'undefined' &&
			window.wpNeuralAdmin.swUrl
		) {
			return window.wpNeuralAdmin.swUrl;
		}

		// Fallback: construct from plugin URL
		if (
			typeof window.wpNeuralAdmin !== 'undefined' &&
			window.wpNeuralAdmin.pluginUrl
		) {
			return `${window.wpNeuralAdmin.pluginUrl}build-extensions/sw.js`;
		}

		// Last resort: relative path (may not work due to scope restrictions)
		console.warn(
			'[ModelLoader] wpNeuralAdmin.swUrl not found, using relative path'
		);
		return '/wp-content/plugins/wp-neural-admin/build-extensions/sw.js';
	}

	/**
	 * Check if a model is already cached in the browser
	 *
	 * @param {string|null} modelId - Model ID to check, defaults to current model
	 * @return {Promise<boolean>} True if model is cached
	 */
	async isModelCached(modelId = null) {
		const id = modelId || this.modelId;
		try {
			const isCached = await webllm.hasModelInCache(id);
			console.log(`[ModelLoader] Model ${id} cached:`, isCached);
			return isCached;
		} catch (err) {
			console.warn('[ModelLoader] Error checking cache:', err);
			return false;
		}
	}

	/**
	 * Check if WebGPU is supported
	 *
	 * @return {Promise<Object>} Support status and reason if not supported
	 */
	async checkWebGPUSupport() {
		if (!navigator.gpu) {
			return {
				supported: false,
				reason:
					'WebGPU is not available in this browser. Please use Chrome 113+, Edge 113+, or another WebGPU-enabled browser.',
			};
		}

		try {
			const adapter = await navigator.gpu.requestAdapter();
			if (!adapter) {
				return {
					supported: false,
					reason:
						'No WebGPU adapter found. Your GPU may not be supported.',
				};
			}

			// Get adapter info for logging - handle both old and new API
			let info = {};
			try {
				if (adapter.info) {
					info = adapter.info;
				} else if (typeof adapter.requestAdapterInfo === 'function') {
					info = await adapter.requestAdapterInfo();
				}
			} catch (infoErr) {
				console.warn('Could not get adapter info:', infoErr);
			}

			console.log('WebGPU Adapter:', info);

			// Store adapter info for later use
			this.gpuAdapterInfo = {
				vendor: info.vendor || 'Unknown',
				architecture: info.architecture || 'Unknown',
				device: info.device || 'Unknown',
				description: info.description || '',
			};

			return {
				supported: true,
				adapter: info,
			};
		} catch (err) {
			return {
				supported: false,
				reason: `WebGPU initialization error: ${err.message}`,
			};
		}
	}

	/**
	 * Set progress callback for loading updates
	 *
	 * @param {Function} callback - Called with (progress, message)
	 */
	onProgress(callback) {
		this.progressCallback = callback;
	}

	/**
	 * Set status callback for status changes
	 *
	 * @param {Function} callback - Called with (status, message)
	 */
	onStatus(callback) {
		this.statusCallback = callback;
	}

	/**
	 * Report progress update
	 *
	 * @param {number} progress - Progress percentage (0-100)
	 * @param {string} message - Status message
	 */
	reportProgress(progress, message) {
		this.loadProgress = progress;
		if (this.progressCallback) {
			this.progressCallback(progress, message);
		}
	}

	/**
	 * Report status change
	 *
	 * @param {string} status - Status string
	 * @param {string} message - Status message
	 */
	reportStatus(status, message) {
		if (this.statusCallback) {
			this.statusCallback(status, message);
		}
	}

	/**
	 * Initialize and load the WebLLM engine
	 *
	 * Attempts to use Service Worker mode first, falls back to page mode if unavailable.
	 *
	 * @since 1.0.0
	 * @updated 1.2.0 - Added Service Worker support
	 * @param {string|null} modelId - Optional model ID override
	 * @return {Promise<boolean>} True if loaded successfully
	 */
	async load(modelId = null) {
		if (this.isLoading) {
			throw new Error('Model is already loading');
		}

		if (this.isReady && this.engine) {
			console.log('Model already loaded');
			return true;
		}

		this.isLoading = true;
		this.modelId = modelId || DEFAULT_MODEL;

		try {
			// Check WebGPU support first
			this.reportStatus('checking', 'Checking WebGPU support...');
			this.reportProgress(0, 'Checking WebGPU support...');

			const gpuCheck = await this.checkWebGPUSupport();
			if (!gpuCheck.supported) {
				throw new Error(gpuCheck.reason);
			}

			this.reportProgress(5, 'WebGPU supported. Initializing engine...');

			// Determine which mode to use
			const useSW = this.useServiceWorker && (await this.checkServiceWorkerSupport());

			if (useSW) {
				await this.loadWithServiceWorker();
			} else {
				await this.loadWithoutServiceWorker();
			}

			this.reportProgress(100, 'Model loaded successfully!');
			this.reportStatus('ready', 'AI model ready');
			this.isReady = true;
			this.isLoading = false;

			const mode = useSW ? 'Service Worker' : 'Page';
			console.log(`[ModelLoader] WebLLM model loaded (${mode} mode):`, this.modelId);
			return true;
		} catch (err) {
			this.isLoading = false;
			this.isReady = false;
			this.engine = null;
			this.reportStatus('error', `Failed to load model: ${err.message}`);
			console.error('Failed to load WebLLM model:', err);
			throw err;
		}
	}

	/**
	 * Load the model using Service Worker mode
	 *
	 * Model persists across page navigations while any tab is open.
	 *
	 * @since 1.2.0
	 * @private
	 */
	async loadWithServiceWorker() {
		this.reportStatus('loading', 'Registering Service Worker...');
		this.reportProgress(8, 'Registering Service Worker...');

		// Register SW if not already registered
		const registration = await this.registerServiceWorker();
		if (!registration) {
			console.warn('[ModelLoader] SW registration failed, falling back to page mode');
			this.useServiceWorker = false;
			return this.loadWithoutServiceWorker();
		}

		// Wait for SW to be ready
		await navigator.serviceWorker.ready;

		this.reportStatus('loading', 'Initializing WebLLM engine in Service Worker...');
		this.reportProgress(10, 'Initializing WebLLM engine...');

		// Create progress callback for WebLLM
		const initProgressCallback = (report) => {
			const progress = Math.round(10 + report.progress * 85); // Scale to 10-95%
			this.reportProgress(progress, report.text);
		};

		// Create the Service Worker MLCEngine
		// This sends messages to the SW which holds the actual engine
		this.engine = await webllm.CreateServiceWorkerMLCEngine(
			this.modelId,
			{
				initProgressCallback,
			},
			undefined, // chatOpts
			SW_CONFIG.keepAliveMs
		);

		console.log('[ModelLoader] Service Worker MLCEngine created');
	}

	/**
	 * Load the model in page mode (fallback)
	 *
	 * Model lives in the page and unloads on navigation.
	 *
	 * @since 1.2.0
	 * @private
	 */
	async loadWithoutServiceWorker() {
		this.reportStatus('loading', 'Initializing WebLLM engine...');
		this.reportProgress(10, 'Initializing WebLLM engine (page mode)...');

		// Create progress callback for WebLLM
		const initProgressCallback = (report) => {
			const progress = Math.round(10 + report.progress * 85);
			this.reportProgress(progress, report.text);
		};

		// Create the regular MLCEngine (page-local)
		this.engine = await webllm.CreateMLCEngine(this.modelId, {
			initProgressCallback,
		});

		console.log('[ModelLoader] Page-local MLCEngine created');
	}

	/**
	 * Set whether to use Service Worker mode
	 *
	 * Must be called before load() to take effect.
	 *
	 * @since 1.2.0
	 * @param {boolean} useSW - Whether to use Service Worker mode
	 */
	setUseServiceWorker(useSW) {
		if (this.isReady || this.isLoading) {
			console.warn('[ModelLoader] Cannot change mode while model is loaded/loading');
			return;
		}
		this.useServiceWorker = useSW;
	}

	/**
	 * Check if currently using Service Worker mode
	 *
	 * @since 1.2.0
	 * @return {boolean} True if using SW mode
	 */
	isUsingServiceWorker() {
		return this.useServiceWorker && this.swRegistration !== null;
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
	 * @since 1.0.0
	 * @updated 1.2.0 - Added SW support
	 */
	async unload() {
		if (this.engine) {
			try {
				await this.engine.unload();
				console.log('[ModelLoader] Model unloaded');
			} catch (err) {
				console.warn('Error unloading model:', err);
			}
			this.engine = null;
		}
		this.isReady = false;
		this.isLoading = false;
		this.loadProgress = 0;
		this.reportStatus('not-loaded', 'Model unloaded');
	}

	/**
	 * Reset the chat context (clear conversation history in the engine)
	 */
	async resetChat() {
		if (this.engine) {
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
	updateUsageStats(usage) {
		if (usage) {
			this.lastUsageStats = {
				...usage,
				timestamp: Date.now(),
			};
			console.log('[ModelLoader] Updated usage stats:', this.lastUsageStats);
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
		if (!this.isReady || !this.modelId) {
			return null;
		}

		const models = ModelLoader.getAvailableModels();
		const modelInfo = models.find((m) => m.id === this.modelId);

		if (modelInfo) {
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
		if (!this.isReady || !this.engine) {
			return null;
		}

		try {
			// Check if we have usage stats from recent completions
			if (this.lastUsageStats) {
				const usage = this.lastUsageStats;
				let formatted = '';
				if (usage.extra?.decode_tokens_per_s) {
					const decodeTps = usage.extra.decode_tokens_per_s.toFixed(1);
					formatted = `${decodeTps} tok/s`;

					if (usage.extra?.prefill_tokens_per_s) {
						const prefillTps =
							usage.extra.prefill_tokens_per_s.toFixed(1);
						formatted = `prefill: ${prefillTps} · output: ${decodeTps} tok/s`;
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
				if (usage.completion_tokens) {
					return {
						usage,
						formatted: `${usage.completion_tokens} tokens generated`,
						available: true,
					};
				}
			}

			// Get model info for estimated size
			const modelInfo = this.getLoadedModelInfo();
			if (modelInfo) {
				return {
					estimatedSize: modelInfo.size,
					available: false,
					message: 'Estimated from model size',
				};
			}

			return null;
		} catch (err) {
			console.warn('[ModelLoader] Error getting memory stats:', err);
			return null;
		}
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
		if (!this.lastUsageStats) {
			return null;
		}

		const maxContext =
			MODEL_CONTEXT_SIZES[this.modelId] || MODEL_CONTEXT_SIZES.default;
		const usedTokens = this.lastUsageStats.prompt_tokens || 0;
		const percentage = Math.round((usedTokens / maxContext) * 100);

		return {
			used: usedTokens,
			max: maxContext,
			percentage: Math.min(percentage, 100),
			isHigh: percentage >= 75,
			isCritical: percentage >= 90,
		};
	}

	/**
	 * Reset context usage stats (e.g., when chat is cleared)
	 */
	resetContextUsage() {
		this.lastUsageStats = null;
		console.log('[ModelLoader] Context usage reset');
	}

	/**
	 * Get available models list
	 * These are from WebLLM's prebuilt model repository
	 *
	 * @return {Array} List of available model configurations
	 */
	static getAvailableModels() {
		return [
			// Recommended model (v1.1)
			{
				id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
				name: 'Qwen 2.5 1.5B (Q4)',
				size: '~1.6GB',
				vram: '~2GB',
				description:
					'Best balance of capability and size. Recommended for most users.',
				recommended: true,
				capabilities: ['multi-step workflows', 'better reasoning'],
			},
			// Smaller fallback options
			{
				id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
				name: 'SmolLM2 360M (Q4)',
				size: '~250MB',
				vram: '~500MB',
				description: 'Very small and fast. For low-memory devices.',
				recommended: false,
				capabilities: ['basic tasks'],
			},
			{
				id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
				name: 'Qwen 2.5 0.5B (Q4)',
				size: '~350MB',
				vram: '~700MB',
				description: 'Small but capable. Good fallback option.',
				recommended: false,
				capabilities: ['basic tasks', 'faster loading'],
			},
			{
				id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
				name: 'Llama 3.2 1B (Q4)',
				size: '~700MB',
				vram: '~1GB',
				description: 'Meta Llama 3.2. Good quality responses.',
				recommended: false,
				capabilities: ['multi-step workflows'],
			},
			// Larger models for advanced users
			{
				id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
				name: 'Qwen 2.5 3B (Q4)',
				size: '~2.5GB',
				vram: '~3GB',
				description:
					'Larger model with better reasoning. Requires more VRAM.',
				recommended: false,
				capabilities: ['complex workflows', 'advanced reasoning'],
			},
			{
				id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
				name: 'Llama 3.2 3B (Q4)',
				size: '~2.3GB',
				vram: '~3GB',
				description: 'Meta Llama 3.2 3B. High quality responses.',
				recommended: false,
				capabilities: ['complex workflows', 'advanced reasoning'],
			},
		];
	}
}

// Create singleton instance
const modelLoader = new ModelLoader();

export { ModelLoader, modelLoader, DEFAULT_MODEL, MODEL_CONFIG };
export default modelLoader;
