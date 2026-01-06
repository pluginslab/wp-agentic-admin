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
 * Context window sizes for different models
 */
const MODEL_CONTEXT_SIZES = {
    'SmolLM2-360M-Instruct-q4f16_1-MLC': 2048,
    'SmolLM2-1.7B-Instruct-q4f16_1-MLC': 2048,
    'Qwen2.5-0.5B-Instruct-q4f16_1-MLC': 2048,
    'Llama-3.2-1B-Instruct-q4f16_1-MLC': 2048,
    // Default fallback
    default: 2048,
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
        this.lastUsageStats = null; // Store usage stats from completions
        this.gpuAdapterInfo = null; // Store GPU adapter info (vendor, architecture, device)
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
            };
        }

        // Fallback for unknown models
        return {
            id: this.modelId,
            name: this.modelId,
            size: 'Unknown',
            description: '',
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
                // Calculate tokens per second if we have the data
                // WebLLM usage includes: prompt_tokens, completion_tokens, total_tokens
                // and extra fields like prefill_tokens_per_s, decode_tokens_per_s
                
                let formatted = '';
                if (usage.extra?.decode_tokens_per_s) {
                    const decodeTps = usage.extra.decode_tokens_per_s.toFixed(1);
                    formatted = `${decodeTps} tok/s`;
                    
                    if (usage.extra?.prefill_tokens_per_s) {
                        const prefillTps = usage.extra.prefill_tokens_per_s.toFixed(1);
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

        const maxContext = MODEL_CONTEXT_SIZES[this.modelId] || MODEL_CONTEXT_SIZES.default;
        const usedTokens = this.lastUsageStats.prompt_tokens || 0;
        const percentage = Math.round((usedTokens / maxContext) * 100);

        return {
            used: usedTokens,
            max: maxContext,
            percentage: Math.min(percentage, 100), // Cap at 100%
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
