/**
 * Model Status Component
 *
 * Displays the AI model loading status with progress bar and controls.
 *
 * @package WPNeuralAdmin
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import modelLoader, { ModelLoader } from '../services/model-loader';

/**
 * Parse the loading stage from WebLLM progress message
 *
 * @param {string} message - Progress message from WebLLM
 * @param {number} progress - Current progress percentage
 * @return {Object} Stage info with icon, title, and description
 */
const getLoadingStage = (message, progress) => {
    const lowerMsg = message.toLowerCase();

    if (progress < 5 || lowerMsg.includes('webgpu')) {
        return {
            icon: '🔍',
            title: 'Checking WebGPU',
            description: 'Verifying your browser supports GPU acceleration...',
        };
    }

    if (lowerMsg.includes('initializing') || lowerMsg.includes('engine')) {
        return {
            icon: '⚙️',
            title: 'Initializing Engine',
            description: 'Setting up the WebLLM inference engine...',
        };
    }

    if (lowerMsg.includes('loading model') || lowerMsg.includes('fetching')) {
        return {
            icon: '📦',
            title: 'Loading Model Weights',
            description: 'Loading neural network weights from cache...',
        };
    }

    if (lowerMsg.includes('shader') || lowerMsg.includes('compiling')) {
        return {
            icon: '🔧',
            title: 'Compiling Shaders',
            description: 'Compiling GPU shaders for your graphics card...',
        };
    }

    if (lowerMsg.includes('tokenizer')) {
        return {
            icon: '📝',
            title: 'Loading Tokenizer',
            description: 'Loading the text tokenizer...',
        };
    }

    if (progress >= 95) {
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
 * @param {Object} props - Component props
 * @param {Function} props.onModelReady - Callback when model is ready
 * @param {Function} props.onModelError - Callback when model loading fails
 * @param {boolean} props.isAutoLoading - Whether model is currently auto-loading from cache
 */
const ModelStatus = ({ onModelReady, onModelError, isAutoLoading = false }) => {
    const [status, setStatus] = useState('not-loaded'); // not-loaded, checking, loading, ready, error
    const [message, setMessage] = useState('AI model not loaded. Click "Load Model" to start.');
    const [progress, setProgress] = useState(0);
    const [selectedModel, setSelectedModel] = useState('SmolLM2-360M-Instruct-q4f16_1-MLC');
    const [isFromCache, setIsFromCache] = useState(false);
    const [rawMessage, setRawMessage] = useState('');

    const availableModels = ModelLoader.getAvailableModels();

    // Track if we're in a loading state (loading or checking)
    const isInLoadingState = status === 'loading' || status === 'checking' || isAutoLoading;

    /**
     * Update status when auto-loading starts - do this FIRST before callbacks
     */
    useEffect(() => {
        if (isAutoLoading) {
            setIsFromCache(true);
            setStatus('loading');
            setMessage('Loading AI model from cache...');
            setRawMessage('Initializing...');
        }
    }, [isAutoLoading]);

    /**
     * Set up model loader callbacks
     */
    useEffect(() => {
        modelLoader.onProgress((prog, msg) => {
            setProgress(prog);
            setRawMessage(msg);
            setMessage(msg);
        });

        modelLoader.onStatus((stat, msg) => {
            setStatus(stat);
            setMessage(msg);
            setRawMessage(msg);

            if (stat === 'ready' && onModelReady) {
                onModelReady();
                setIsFromCache(false);
            } else if (stat === 'error' && onModelError) {
                onModelError(msg);
                setIsFromCache(false);
            }
        });

        // Check if model is already loaded
        if (modelLoader.isModelReady()) {
            setStatus('ready');
            setMessage('AI model ready');
            setProgress(100);
        }
    }, [onModelReady, onModelError]);

    /**
     * Handle Load Model button click
     */
    const handleLoadModel = useCallback(async () => {
        try {
            await modelLoader.load(selectedModel);
        } catch (err) {
            console.error('Failed to load model:', err);
            // Error state is handled by the status callback
        }
    }, [selectedModel]);

    /**
     * Handle Unload Model
     */
    const handleUnloadModel = useCallback(async () => {
        await modelLoader.unload();
        setProgress(0);
        setIsFromCache(false);
    }, []);

    /**
     * Get CSS class for status indicator
     */
    const getStatusClass = () => {
        switch (status) {
            case 'ready':
                return 'wp-neural-admin-status__indicator--ready';
            case 'loading':
            case 'checking':
                return 'wp-neural-admin-status__indicator--loading';
            case 'error':
                return 'wp-neural-admin-status__indicator--error';
            default:
                return 'wp-neural-admin-status__indicator--pending';
        }
    };

    /**
     * Get button text based on status
     */
    const getButtonText = () => {
        switch (status) {
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
        if (status === 'ready') {
            return handleUnloadModel;
        }
        return handleLoadModel;
    };

    // Get current loading stage info
    const loadingStage = getLoadingStage(rawMessage, progress);

    return (
        <div className="wp-neural-admin-model-status">
            {/* Loading State - Full Progress UI */}
            {isInLoadingState && (
                <div className="wp-neural-admin-loading-card">
                    <div className="wp-neural-admin-loading-card__header">
                        <span className="wp-neural-admin-loading-card__icon">{loadingStage.icon}</span>
                        <div className="wp-neural-admin-loading-card__title-wrap">
                            <h4 className="wp-neural-admin-loading-card__title">
                                {isFromCache ? 'Loading from Cache' : 'Loading Model'}
                            </h4>
                            <span className="wp-neural-admin-loading-card__subtitle">
                                {loadingStage.title}
                            </span>
                        </div>
                        <span className="wp-neural-admin-loading-card__percent">{progress}%</span>
                    </div>

                    <div className="wp-neural-admin-loading-card__progress">
                        <div
                            className="wp-neural-admin-loading-card__progress-bar"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <p className="wp-neural-admin-loading-card__description">
                        {loadingStage.description}
                    </p>

                    {isFromCache && (
                        <p className="wp-neural-admin-loading-card__cache-note">
                            Model files are cached locally. No download needed!
                        </p>
                    )}
                </div>
            )}

            {/* Not Loading State - Standard Status Bar */}
            {!isInLoadingState && (
                <div className="wp-neural-admin-status">
                    <span className={`wp-neural-admin-status__indicator ${getStatusClass()}`} />
                    <span className="wp-neural-admin-status__text">{message}</span>

                    {status === 'checking' && <Spinner />}

                    {(status === 'not-loaded' || status === 'error' || status === 'ready') && (
                        <div className="wp-neural-admin-status__controls">
                            {status !== 'ready' && (
                                <select
                                    className="wp-neural-admin-model-select"
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    disabled={status === 'loading' || status === 'checking'}
                                >
                                    {availableModels.map((model) => (
                                        <option key={model.id} value={model.id}>
                                            {model.name} ({model.size})
                                            {model.recommended ? ' - Recommended' : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <Button
                                variant={status === 'ready' ? 'secondary' : 'primary'}
                                onClick={getButtonHandler()}
                                disabled={status === 'loading' || status === 'checking'}
                                className="wp-neural-admin-load-model"
                            >
                                {getButtonText()}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {status === 'not-loaded' && (
                <p className="wp-neural-admin-model-info">
                    The AI model runs entirely in your browser using WebGPU. The first load
                    will download model data (250MB-1GB depending on model), which is cached for future use.
                    Cached models auto-load on page refresh. No data is sent to external servers.
                </p>
            )}
        </div>
    );
};

export default ModelStatus;
