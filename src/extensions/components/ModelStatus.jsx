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
 * ModelStatus component
 *
 * @param {Object} props - Component props
 * @param {Function} props.onModelReady - Callback when model is ready
 * @param {Function} props.onModelError - Callback when model loading fails
 */
const ModelStatus = ({ onModelReady, onModelError }) => {
    const [status, setStatus] = useState('not-loaded'); // not-loaded, checking, loading, ready, error
    const [message, setMessage] = useState('AI model not loaded. Click "Load Model" to start.');
    const [progress, setProgress] = useState(0);
    const [selectedModel, setSelectedModel] = useState('Phi-3.5-mini-instruct-q4f16_1-MLC');

    const availableModels = ModelLoader.getAvailableModels();

    /**
     * Set up model loader callbacks
     */
    useEffect(() => {
        modelLoader.onProgress((prog, msg) => {
            setProgress(prog);
            setMessage(msg);
        });

        modelLoader.onStatus((stat, msg) => {
            setStatus(stat);
            setMessage(msg);

            if (stat === 'ready' && onModelReady) {
                onModelReady();
            } else if (stat === 'error' && onModelError) {
                onModelError(msg);
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

    return (
        <div className="wp-neural-admin-model-status">
            <div className="wp-neural-admin-status">
                <span className={`wp-neural-admin-status__indicator ${getStatusClass()}`} />
                <span className="wp-neural-admin-status__text">{message}</span>

                {status === 'loading' && (
                    <div className="wp-neural-admin-progress">
                        <div
                            className="wp-neural-admin-progress__bar"
                            style={{ width: `${progress}%` }}
                        />
                        <span className="wp-neural-admin-progress__text">{progress}%</span>
                    </div>
                )}

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

            {status === 'not-loaded' && (
                <p className="wp-neural-admin-model-info">
                    The AI model runs entirely in your browser using WebGPU. The first load
                    will download ~2-3GB of model data, which is cached for future use.
                    No data is sent to external servers.
                </p>
            )}
        </div>
    );
};

export default ModelStatus;
