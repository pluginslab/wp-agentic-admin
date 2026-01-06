/**
 * WP Neural Admin - Main App Component
 *
 * @package WPNeuralAdmin
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import { Spinner, TabPanel, Notice } from '@wordpress/components';
import ChatContainer from './components/ChatContainer';
import AbilityBrowser from './components/AbilityBrowser';
import ModelStatus from './components/ModelStatus';
import WebGPUFallback from './components/WebGPUFallback';
import modelLoader from './services/model-loader';

const App = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modelReady, setModelReady] = useState(false);
    const [webGPUError, setWebGPUError] = useState(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [isAutoLoading, setIsAutoLoading] = useState(false);

    const settings = window.wpNeuralAdmin || {};
    const { i18n = {}, hasPrettyPermalinks = true, permalinksUrl = '' } = settings;

    /**
     * Initial WebGPU check and auto-load cached model on mount
     */
    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Check WebGPU support first
                const result = await modelLoader.checkWebGPUSupport();
                if (!result.supported) {
                    setWebGPUError(result.reason);
                    setIsLoading(false);
                    return;
                }

                // Check if model is already loaded in memory
                if (modelLoader.isModelReady()) {
                    setModelReady(true);
                    setIsLoading(false);
                    return;
                }

                // Check if model is cached - if so, auto-load it
                const isCached = await modelLoader.isModelCached();
                
                // Show the full UI now (with ModelStatus component)
                setIsLoading(false);
                
                if (isCached) {
                    console.log('[App] Model is cached, auto-loading...');
                    setIsAutoLoading(true);
                    try {
                        await modelLoader.load();
                        setModelReady(true);
                    } catch (loadErr) {
                        console.error('[App] Auto-load failed:', loadErr);
                        // Don't show error - user can manually load
                    } finally {
                        setIsAutoLoading(false);
                    }
                }
            } catch (err) {
                console.error('Initialization failed:', err);
                setIsLoading(false);
            }
        };

        initializeApp();
    }, []);

    /**
     * Warn user before leaving page if model is loaded
     */
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (modelReady) {
                const message = 'The AI model is loaded. Leaving this page will unload it and require re-initialization on return.';
                e.preventDefault();
                e.returnValue = message;
                return message;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [modelReady]);

    /**
     * Handle model ready callback
     */
    const handleModelReady = useCallback(() => {
        setModelReady(true);
        setWebGPUError(null);
    }, []);

    /**
     * Handle model error callback
     */
    const handleModelError = useCallback((errorMessage) => {
        setModelReady(false);
        // Only set WebGPU error if it's a WebGPU-specific error
        if (errorMessage.includes('WebGPU') || errorMessage.includes('GPU')) {
            setWebGPUError(errorMessage);
        }
    }, []);

    // If permalinks are not configured, show error
    if (!hasPrettyPermalinks) {
        return (
            <div className="wp-neural-admin-app">
                <div className="wp-neural-admin-header">
                    <h2>Neural Admin AI Assistant</h2>
                </div>
                <div className="wp-neural-admin-permalink-notice">
                    <Notice status="error" isDismissible={false}>
                        <p>
                            <strong>{i18n.permalinksRequired || 'Pretty permalinks are required for Neural Admin to work.'}</strong>
                        </p>
                        <p>
                            The REST API requires a permalink structure other than "Plain" to function properly.
                            Please go to <strong>Settings &rarr; Permalinks</strong> and select any option except "Plain".
                        </p>
                        <p>
                            <a href={permalinksUrl} className="button button-primary">
                                {i18n.updatePermalinks || 'Update Permalinks'}
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
            className: 'wp-neural-admin-tab',
        },
        {
            name: 'abilities',
            title: 'Abilities',
            className: 'wp-neural-admin-tab',
        },
    ];

    /**
     * Render tab content
     */
    const renderTabContent = (tab) => {
        switch (tab.name) {
            case 'chat':
                // If WebGPU has a fatal error, show fallback
                if (webGPUError && !modelReady) {
                    return <WebGPUFallback reason={webGPUError} />;
                }
                return (
                    <ChatContainer
                        modelReady={modelReady}
                        isLoading={isExecuting}
                        setIsLoading={setIsExecuting}
                    />
                );
            case 'abilities':
                return <AbilityBrowser />;
            default:
                return null;
        }
    };

    if (error) {
        return (
            <div className="wp-neural-admin-error notice notice-error">
                <p>{error}</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="wp-neural-admin-loading">
                <Spinner />
                <p>{i18n.loading || 'Loading...'}</p>
            </div>
        );
    }

    return (
        <div className="wp-neural-admin-app">
            <div className="wp-neural-admin-header">
                <h2>Neural Admin AI Assistant</h2>
                <p className="description">
                    Your local AI-powered Site Reliability Engineer. Use the Chat tab to interact with AI, or the Abilities tab to manually test tools.
                </p>
            </div>

            <div className="wp-neural-admin-main">
                <TabPanel
                    className="wp-neural-admin-tabs"
                    tabs={tabs}
                    initialTabName="chat"
                >
                    {(tab) => (
                        <div className="wp-neural-admin-tab-content">
                            {renderTabContent(tab)}
                        </div>
                    )}
                </TabPanel>
            </div>

            <ModelStatus
                onModelReady={handleModelReady}
                onModelError={handleModelError}
                isAutoLoading={isAutoLoading}
            />
        </div>
    );
};

export default App;
