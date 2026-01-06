/**
 * ChatContainer Component
 *
 * Main container for the chat interface, orchestrating messages and input.
 *
 * @package WPNeuralAdmin
 */

import { useReducer, useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { Button, Modal } from '@wordpress/components';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import {
    chatReducer,
    getInitialChatState,
    ChatActions,
    createUserMessage,
    createAssistantMessage,
    createAbilityRequestMessage,
    createAbilityResultMessage,
    createErrorMessage,
} from '../services/chat-history';
import abilitiesApi from '../services/abilities-api';
import aiService from '../services/ai-service';

/**
 * Get initial message to show when an ability starts executing
 *
 * @param {string} abilityName - The ability being executed
 * @return {string} Initial message
 */
const getAbilityInitialMessage = (abilityName) => {
    switch (abilityName) {
        case 'wp-neural-admin/plugin-list':
            return "I'll check your installed plugins...";
        case 'wp-neural-admin/site-health':
            return "Let me check your site health information...";
        case 'wp-neural-admin/error-log-read':
            return "I'll look at your error log...";
        case 'wp-neural-admin/cache-flush':
            return "Flushing the cache...";
        case 'wp-neural-admin/db-optimize':
            return "Optimizing the database...";
        case 'wp-neural-admin/plugin-deactivate':
            return "Deactivating the plugin...";
        default:
            return "Working on it...";
    }
};

/**
 * Generate a human-readable summary of an ability result
 * Since SmolLM2-360M hallucinates, we generate summaries ourselves
 *
 * @param {string} abilityName - The ability that was executed
 * @param {Object} result - The ability result
 * @return {string} Human-readable summary
 */
const generateAbilitySummary = (abilityName, result) => {
    switch (abilityName) {
        case 'wp-neural-admin/plugin-list': {
            const { plugins, total, active } = result;
            const activePlugins = plugins.filter(p => p.active).map(p => p.name);
            const inactivePlugins = plugins.filter(p => !p.active).map(p => p.name);
            
            let summary = `I found ${total} plugins installed. ${active} are active and ${total - active} are inactive.\n\n`;
            
            if (activePlugins.length > 0) {
                summary += `**Active plugins:** ${activePlugins.join(', ')}\n\n`;
            }
            if (inactivePlugins.length > 0) {
                summary += `**Inactive plugins:** ${inactivePlugins.join(', ')}`;
            }
            return summary;
        }
        
        case 'wp-neural-admin/site-health': {
            const { wordpress, php, server, database } = result;
            return `Here's your site health information:\n\n` +
                `**WordPress:** ${wordpress?.version || 'Unknown'}\n` +
                `**PHP:** ${php?.version || 'Unknown'}\n` +
                `**Server:** ${server?.software || 'Unknown'}\n` +
                `**Database:** ${database?.server || 'Unknown'} ${database?.version || ''}`;
        }
        
        case 'wp-neural-admin/error-log-read': {
            if (result.errors && result.errors.length > 0) {
                return `I found ${result.errors.length} error(s) in the log. Click below to see the details.`;
            } else if (result.message) {
                return result.message;
            }
            return 'No errors found in the error log.';
        }
        
        case 'wp-neural-admin/cache-flush': {
            return result.message || 'Cache has been flushed successfully.';
        }
        
        case 'wp-neural-admin/db-optimize': {
            if (result.tables_optimized !== undefined) {
                return `Database optimization complete. ${result.tables_optimized} tables were optimized.`;
            }
            return result.message || 'Database optimization complete.';
        }
        
        case 'wp-neural-admin/plugin-deactivate': {
            return result.message || 'Plugin has been deactivated.';
        }
        
        default:
            return 'Task completed successfully. See the details below.';
    }
};

/**
 * ChatContainer component
 *
 * @param {Object} props - Component props
 * @param {boolean} props.modelReady - Whether AI model is loaded and ready
 * @param {boolean} props.isLoading - Whether a request is in progress
 * @param {Function} props.setIsLoading - Callback to set loading state
 * @return {JSX.Element} Rendered chat container
 */
const ChatContainer = ({ modelReady = false, isLoading = false, setIsLoading }) => {
    const [messages, dispatch] = useReducer(chatReducer, getInitialChatState());
    const [streamingText, setStreamingText] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [pendingAbility, setPendingAbility] = useState(null);
    const [abilityDetected, setAbilityDetected] = useState(false);
    const [isExecutingAbility, setIsExecutingAbility] = useState(false);
    const streamingMessageRef = useRef(null);

    /**
     * Simulate streaming text for a message (typewriter effect)
     * @param {string} text - Text to stream
     * @param {number} speed - Ms per character (default 20)
     * @return {Promise<void>}
     */
    const simulateStreaming = useCallback(async (text, speed = 20) => {
        setIsStreaming(true);
        setStreamingText('');
        
        for (let i = 0; i <= text.length; i++) {
            setStreamingText(text.substring(0, i));
            await new Promise(resolve => setTimeout(resolve, speed));
        }
        
        setIsStreaming(false);
        setStreamingText('');
        return text;
    }, []);

    /**
     * Set up AI service callbacks
     */
    useEffect(() => {
        // Ability request callback - called when AI wants to use an ability
        aiService.onAbilityRequest(async (abilityName, params) => {
            // Check if it's a destructive action
            const destructiveAbilities = ['wp-neural-admin/plugin-deactivate'];
            if (destructiveAbilities.includes(abilityName)) {
                // Show confirmation modal
                return new Promise((resolve) => {
                    setPendingAbility({ abilityName, params, resolve });
                });
            }
            // Non-destructive abilities auto-execute
            return true;
        });

        return () => {
            // Cleanup
            aiService.onStream(null);
            aiService.onAbilityRequest(null);
        };
    }, []);

    /**
     * Set up streaming callback - separate effect so it updates with abilityDetected
     */
    useEffect(() => {
        // Streaming callback - updates the current response as tokens arrive
        // We suppress streaming display when an ability was detected (keyword-based)
        // because the model's output is unreliable
        aiService.onStream((chunk, fullText) => {
            // Don't update streaming text if we detected an ability
            // The model output will be discarded anyway
            if (!abilityDetected) {
                setStreamingText(fullText);
            }
        });
    }, [abilityDetected]);

    /**
     * Add a message to the chat
     *
     * @param {Object} message - Message object
     */
    const addMessage = useCallback((message) => {
        dispatch({ type: ChatActions.ADD_MESSAGE, payload: message });
    }, []);

    /**
     * Handle sending a user message
     *
     * @param {string} text - User's message text
     */
    const handleSendMessage = useCallback(async (text) => {
        // Add user message
        addMessage(createUserMessage(text));

        // If model not ready, show placeholder response
        if (!modelReady) {
            addMessage(createAssistantMessage(
                'The AI model is not loaded yet. Please click "Load Model" at the bottom of the page, or use the "Abilities" tab to manually test the available tools.'
            ));
            return;
        }

        // Check if this message will likely trigger an ability (keyword detection)
        const detectedAbility = aiService.detectAbilityFromMessage(text);
        const willTriggerAbility = detectedAbility !== null;
        setAbilityDetected(willTriggerAbility);

        setIsLoading?.(true);

        try {
            if (willTriggerAbility) {
                // ABILITY FLOW: Simulated streaming for better UX
                // 1. Stream the initial message
                const initialMessage = getAbilityInitialMessage(detectedAbility);
                await simulateStreaming(initialMessage, 15);
                addMessage(createAssistantMessage(initialMessage));

                // 2. Show loading spinner while ability executes
                setIsExecutingAbility(true);
                
                // Execute the ability via AI service (model runs in background, we ignore its output)
                const response = await aiService.chat(text);
                console.log('[ChatContainer] AI response:', response);
                
                setIsExecutingAbility(false);

                // 3. Show results
                if (response.abilities.length > 0) {
                    for (const ability of response.abilities) {
                        console.log('[ChatContainer] Adding ability result:', ability);
                        if (ability.success) {
                            addMessage(createAbilityResultMessage(ability.name, ability.result, true));
                            
                            // 4. Stream the summary
                            const summary = generateAbilitySummary(ability.name, ability.result);
                            await simulateStreaming(summary, 10);
                            addMessage(createAssistantMessage(summary));
                        } else {
                            addMessage(createAbilityResultMessage(
                                ability.name,
                                { error: ability.error },
                                false
                            ));
                            const errorMsg = `I encountered an error while trying to help.`;
                            await simulateStreaming(errorMsg, 15);
                            addMessage(createAssistantMessage(errorMsg));
                        }
                    }
                }
            } else {
                // NON-ABILITY FLOW: Use real model streaming
                setIsStreaming(true);
                setStreamingText('');
                
                const response = await aiService.chat(text);
                console.log('[ChatContainer] AI response:', response);
                
                // Show the model's response as-is
                addMessage(createAssistantMessage(response.text));
            }
        } catch (error) {
            console.error('Chat error:', error);
            addMessage(createErrorMessage('Failed to process message', error));
        } finally {
            setIsLoading?.(false);
            setIsStreaming(false);
            setStreamingText('');
            setAbilityDetected(false);
            setIsExecutingAbility(false);
        }
    }, [modelReady, addMessage, setIsLoading, simulateStreaming]);

    /**
     * Handle ability confirmation (for destructive actions)
     */
    const handleAbilityConfirm = useCallback(() => {
        if (pendingAbility) {
            pendingAbility.resolve(true);
            setPendingAbility(null);
        }
    }, [pendingAbility]);

    /**
     * Handle ability cancellation
     */
    const handleAbilityCancel = useCallback(() => {
        if (pendingAbility) {
            pendingAbility.resolve(false);
            setPendingAbility(null);
            addMessage(createAssistantMessage(
                `Action cancelled. The ${pendingAbility.abilityName} ability was not executed.`
            ));
        }
    }, [pendingAbility, addMessage]);

    /**
     * Execute an ability directly (from quick actions or other UI)
     *
     * @param {string} abilityId - Full ability ID
     * @param {string} label - Human-readable ability label
     * @param {Object} input - Input parameters
     */
    const executeAbility = useCallback(async (abilityId, label, input = {}) => {
        // Add request message
        addMessage(createAbilityRequestMessage(abilityId, label, input));
        
        setIsLoading?.(true);

        try {
            const result = await abilitiesApi.executeAbilityById(abilityId, input);
            addMessage(createAbilityResultMessage(abilityId, result, true));

            // If AI is ready, let it analyze the result
            if (modelReady && aiService.isReady()) {
                const analysis = await aiService.analyzeAbilityResult(abilityId, result, true);
                addMessage(createAssistantMessage(analysis.text));
            }
        } catch (error) {
            addMessage(createAbilityResultMessage(
                abilityId,
                { error: error.message },
                false
            ));
        } finally {
            setIsLoading?.(false);
        }
    }, [addMessage, setIsLoading, modelReady]);

    /**
     * Clear chat history
     */
    const clearHistory = useCallback(() => {
        dispatch({ type: ChatActions.CLEAR_HISTORY });
        aiService.clearHistory();
    }, []);

    /**
     * Stop current AI generation
     */
    const handleStopGeneration = useCallback(async () => {
        await aiService.stopGeneration();
        setIsStreaming(false);
        setStreamingText('');
    }, []);

    // Combine messages with streaming message for display
    const displayMessages = isStreaming && streamingText
        ? [...messages, createAssistantMessage(streamingText + '▊')]
        : messages;

    return (
        <div className="wp-neural-admin-chat-container">
            <div className="wp-neural-admin-chat-header">
                <div className="wp-neural-admin-chat-header__actions">
                    <Button
                        variant="tertiary"
                        isDestructive
                        onClick={clearHistory}
                        disabled={messages.length <= 1 || isLoading || isStreaming || isExecutingAbility}
                    >
                        Clear Chat
                    </Button>
                </div>
            </div>

            <MessageList messages={displayMessages} />
            
            {/* Loading spinner while ability is executing */}
            {isExecutingAbility && (
                <div className="neural-message neural-message--loading">
                    <div className="neural-timeline">
                        <div className="neural-timeline__line" />
                        <div className="neural-timeline__dot neural-timeline__dot--loading" />
                    </div>
                    <div className="neural-loading">
                        <div className="neural-loading__spinner" />
                        <span className="neural-loading__text">Running tool...</span>
                    </div>
                </div>
            )}

            <ChatInput
                onSend={handleSendMessage}
                disabled={!modelReady || isStreaming}
                isLoading={isLoading || isStreaming}
                placeholder={
                    modelReady
                        ? "Describe your issue or what you want to do..."
                        : "Load the AI model to start chatting..."
                }
            />

            {isStreaming && (
                <div className="wp-neural-admin-chat-actions">
                    <Button variant="secondary" onClick={handleStopGeneration}>
                        Stop Generation
                    </Button>
                </div>
            )}

            {/* Confirmation Modal for destructive actions */}
            {pendingAbility && (
                <Modal
                    title="Confirm Action"
                    onRequestClose={handleAbilityCancel}
                    className="wp-neural-admin-confirm-modal"
                >
                    <p>
                        The AI wants to execute: <strong>{pendingAbility.abilityName}</strong>
                    </p>
                    <p>
                        This is a potentially destructive action. Are you sure you want to proceed?
                    </p>
                    {Object.keys(pendingAbility.params).length > 0 && (
                        <div className="wp-neural-admin-confirm-params">
                            <strong>Parameters:</strong>
                            <pre>{JSON.stringify(pendingAbility.params, null, 2)}</pre>
                        </div>
                    )}
                    <div className="wp-neural-admin-confirm-actions">
                        <Button variant="tertiary" onClick={handleAbilityCancel}>
                            Cancel
                        </Button>
                        <Button variant="primary" isDestructive onClick={handleAbilityConfirm}>
                            Confirm
                        </Button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export { ChatContainer };
export default ChatContainer;
