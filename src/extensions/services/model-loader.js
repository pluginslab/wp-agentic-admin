/**
 * Model Loader Service
 *
 * Handles loading and managing the WebLLM model for in-browser AI inference.
 *
 * @package WPNeuralAdmin
 */

import * as webllm from '@mlc-ai/web-llm';

/**
 * Default model configuration
 * Using SmolLM2-360M for fast loading and good capability
 * See: https://github.com/nicholaschuayunzhi/nicholaschuayunzhi.github.io/tree/master/webllm-models
 */
const DEFAULT_MODEL = 'SmolLM2-360M-Instruct-q4f16_1-MLC';

/**
 * Model configuration options
 */
const MODEL_CONFIG = {
    // Context window size (smaller = faster, less memory)
    context_window_size: 2048,
};

/**
 * ModelLoader class for managing WebLLM model lifecycle
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
                reason: 'WebGPU is not available in this browser. Please use Chrome 113+, Edge 113+, or another WebGPU-enabled browser.',
            };
        }

        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                return {
                    supported: false,
                    reason: 'No WebGPU adapter found. Your GPU may not be supported.',
                };
            }

            // Get adapter info for logging - handle both old and new API
            let info = {};
            try {
                // New API (Chrome 121+): adapter.info is a property
                if (adapter.info) {
                    info = adapter.info;
                }
                // Old API: requestAdapterInfo() was a method
                else if (typeof adapter.requestAdapterInfo === 'function') {
                    info = await adapter.requestAdapterInfo();
                }
            } catch (infoErr) {
                // Info is optional, continue without it
                console.warn('Could not get adapter info:', infoErr);
            }
            
            console.log('WebGPU Adapter:', info);

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
            this.reportStatus('loading', 'Initializing WebLLM engine...');

            // Create progress callback for WebLLM
            const initProgressCallback = (report) => {
                // WebLLM progress report has: progress (0-1), text
                const progress = Math.round(5 + report.progress * 90); // Scale to 5-95%
                this.reportProgress(progress, report.text);
            };

            // Create the MLCEngine using WebLLM's prebuilt model list
            // This uses the official MLC-AI model repository with proper CORS headers
            this.engine = await webllm.CreateMLCEngine(this.modelId, {
                initProgressCallback,
            });

            this.reportProgress(100, 'Model loaded successfully!');
            this.reportStatus('ready', 'AI model ready');
            this.isReady = true;
            this.isLoading = false;

            console.log('WebLLM model loaded:', this.modelId);
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
     */
    async unload() {
        if (this.engine) {
            try {
                await this.engine.unload();
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
     * Get available models list
     * These are from WebLLM's prebuilt model repository
     *
     * @return {Array} List of available model configurations
     */
    static getAvailableModels() {
        return [
            {
                id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
                name: 'SmolLM2 360M (Q4)',
                size: '~250MB',
                description: 'Very small and fast model. Good for quick testing.',
                recommended: true,
            },
            {
                id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
                name: 'SmolLM2 1.7B (Q4)',
                size: '~1GB',
                description: 'Larger SmolLM model with better capability.',
                recommended: false,
            },
            {
                id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
                name: 'Qwen 2.5 0.5B (Q4)',
                size: '~350MB',
                description: 'Alibaba Qwen 2.5 0.5B. Small and capable.',
                recommended: false,
            },
            {
                id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
                name: 'Llama 3.2 1B (Q4)',
                size: '~700MB',
                description: 'Meta Llama 3.2 1B. Good balance of size and quality.',
                recommended: false,
            },
        ];
    }
}

// Create singleton instance
const modelLoader = new ModelLoader();

export { ModelLoader, modelLoader, DEFAULT_MODEL, MODEL_CONFIG };
export default modelLoader;
