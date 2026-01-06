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
    const streamingMessageRef = useRef(null);

    /**
     * Set up AI service callbacks
     */
    useEffect(() => {
        // Streaming callback - updates the current response as tokens arrive
        aiService.onStream((chunk, fullText) => {
            setStreamingText(fullText);
        });

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

        setIsLoading?.(true);
        setIsStreaming(true);
        setStreamingText('');

        try {
            // Get response from AI service with streaming
            const response = await aiService.chat(text);

            // Add the final assistant message
            addMessage(createAssistantMessage(response.text));

            // If abilities were called, add their results
            for (const ability of response.abilities) {
                if (ability.success) {
                    addMessage(createAbilityResultMessage(ability.name, ability.result, true));
                    
                    // Let AI analyze the result
                    const analysis = await aiService.analyzeAbilityResult(
                        ability.name,
                        ability.result,
                        true
                    );
                    addMessage(createAssistantMessage(analysis.text));
                } else {
                    addMessage(createAbilityResultMessage(
                        ability.name,
                        { error: ability.error },
                        false
                    ));
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            addMessage(createErrorMessage('Failed to process message', error));
        } finally {
            setIsLoading?.(false);
            setIsStreaming(false);
            setStreamingText('');
        }
    }, [modelReady, addMessage, setIsLoading]);

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
                    {messages.length > 1 && (
                        <Button
                            variant="tertiary"
                            isDestructive
                            onClick={clearHistory}
                            disabled={isLoading || isStreaming}
                        >
                            Clear Chat
                        </Button>
                    )}
                </div>
            </div>

            <MessageList messages={displayMessages} />

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
