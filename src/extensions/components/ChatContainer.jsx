/**
 * ChatContainer Component
 *
 * Main container for the chat interface using the ChatOrchestrator framework.
 * This component:
 * - Initializes the chat framework (tools, session, orchestrator) on mount
 * - Manages React state for messages and streaming UI
 * - Handles user input and routes to ChatOrchestrator
 * - Displays messages via MessageList component
 * - Shows confirmation modals for destructive actions
 * 
 * ARCHITECTURE:
 * - ChatSession: Manages message history (persisted to localStorage)
 * - ChatOrchestrator: Coordinates LLM + tools + streaming
 * - registerWPTools(): Registers all WordPress tools with the ToolRegistry
 * 
 * The orchestrator uses callbacks to update React state:
 * - onStreamStart/Chunk/End: For typewriter streaming effect
 * - onToolStart/End: For loading spinner during tool execution
 * - onMessageAdd: To update displayed messages
 * - onStateChange: To sync isProcessing state
 *
 * @package WPNeuralAdmin
 */

import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { Button, Modal, Notice } from '@wordpress/components';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import {
    chatOrchestrator,
    ChatSession,
    registerWPTools,
    MessageType,
    modelLoader,
} from '../services';

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
    // Messages state - managed by ChatSession but we need React state for re-renders
    const [messages, setMessages] = useState([]);
    const [streamingText, setStreamingText] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isExecutingTool, setIsExecutingTool] = useState(false);
    const [pendingConfirmation, setPendingConfirmation] = useState(null);
    const [contextUsage, setContextUsage] = useState(null);
    
    // Session ref to persist across renders
    const sessionRef = useRef(null);
    const initializedRef = useRef(false);

    /**
     * Initialize the chat framework on mount
     */
    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        console.log('[ChatContainer] Initializing chat framework...');

        // Register WordPress tools
        registerWPTools();

        // Create and initialize session
        const session = new ChatSession({
            storageKey: 'wp-neural-admin-chat-session',
            onChange: (msgs) => {
                // Convert session messages to display format
                setMessages(convertMessagesToDisplay(msgs));
            },
        });
        sessionRef.current = session;

        // Initialize orchestrator with session
        chatOrchestrator.initialize(session);

        // Set up orchestrator callbacks for UI updates
        chatOrchestrator.setCallbacks({
            onStreamStart: () => {
                setIsStreaming(true);
                setStreamingText('');
            },
            onStreamChunk: (chunk, fullText) => {
                setStreamingText(fullText);
            },
            onStreamEnd: (finalText) => {
                setIsStreaming(false);
                setStreamingText('');
            },
            onToolStart: (toolId) => {
                setIsExecutingTool(true);
            },
            onToolEnd: (toolId, result, success) => {
                setIsExecutingTool(false);
            },
            onMessageAdd: (msgs, newMessage) => {
                setMessages(convertMessagesToDisplay(msgs));
            },
            onError: (error) => {
                console.error('[ChatContainer] Orchestrator error:', error);
            },
            onStateChange: ({ isProcessing }) => {
                setIsLoading?.(isProcessing);
                // Update context usage after each message
                const usage = modelLoader.getContextUsage();
                setContextUsage(usage);
            },
        });

        // Set up confirmation handler for destructive actions
        chatOrchestrator.setConfirmationHandler((tool) => {
            return new Promise((resolve) => {
                setPendingConfirmation({
                    toolId: tool.id,
                    message: tool.confirmationMessage || `Execute ${tool.id}?`,
                    resolve,
                });
            });
        });

        // Load saved session if available
        session.load();

        // Add welcome message if session is empty
        if (session.getMessageCount() === 0) {
            session.addAssistantMessage(
                "Hey there! I'm your WordPress assistant. Need help with site health, error logs, plugins, caching, or database optimization? Just ask!"
            );
        }

        return () => {
            // Save session on unmount
            session.save();
        };
    }, [setIsLoading]);

    /**
     * Convert session messages to display format for MessageList
     * 
     * @param {Array} sessionMessages - Messages from ChatSession
     * @return {Array} Display-formatted messages
     */
    const convertMessagesToDisplay = (sessionMessages) => {
        return sessionMessages.map(msg => {
            // Map session message types to display format
            switch (msg.type) {
                case MessageType.USER:
                    return {
                        id: msg.id,
                        type: 'user',
                        content: msg.content,
                        timestamp: msg.timestamp,
                    };
                case MessageType.ASSISTANT:
                    return {
                        id: msg.id,
                        type: 'assistant',
                        content: msg.content,
                        timestamp: msg.timestamp,
                    };
                case MessageType.TOOL_REQUEST:
                    return {
                        id: msg.id,
                        type: 'ability_request',
                        abilityName: msg.meta?.toolId,
                        abilityLabel: msg.meta?.toolId?.split('/').pop(),
                        input: msg.meta?.params || {},
                        timestamp: msg.timestamp,
                    };
                case MessageType.TOOL_RESULT:
                    return {
                        id: msg.id,
                        type: 'ability_result',
                        abilityName: msg.meta?.toolId,
                        result: msg.meta?.result,
                        success: msg.meta?.success,
                        timestamp: msg.timestamp,
                    };
                case MessageType.ERROR:
                    return {
                        id: msg.id,
                        type: 'error',
                        content: msg.content,
                        error: msg.meta?.error,
                        timestamp: msg.timestamp,
                    };
                case MessageType.SYSTEM:
                default:
                    return {
                        id: msg.id,
                        type: 'assistant',
                        content: msg.content,
                        timestamp: msg.timestamp,
                    };
            }
        });
    };

    /**
     * Handle sending a user message
     *
     * @param {string} text - User's message text
     */
    const handleSendMessage = useCallback(async (text) => {
        if (!text.trim()) return;

        // If model not ready, show placeholder response
        if (!modelReady) {
            sessionRef.current?.addUserMessage(text);
            sessionRef.current?.addAssistantMessage(
                'The AI model is not loaded yet. Please click "Load Model" at the bottom of the page, or use the "Abilities" tab to manually test the available tools.'
            );
            return;
        }

        // Process message through orchestrator
        try {
            await chatOrchestrator.processMessage(text);
        } catch (error) {
            console.error('[ChatContainer] Error processing message:', error);
        }
    }, [modelReady]);

    /**
     * Handle confirmation of destructive actions
     */
    const handleConfirm = useCallback(() => {
        if (pendingConfirmation) {
            pendingConfirmation.resolve(true);
            setPendingConfirmation(null);
        }
    }, [pendingConfirmation]);

    /**
     * Handle cancellation of destructive actions
     */
    const handleCancel = useCallback(() => {
        if (pendingConfirmation) {
            pendingConfirmation.resolve(false);
            setPendingConfirmation(null);
        }
    }, [pendingConfirmation]);

    /**
     * Clear chat history
     */
    const clearHistory = useCallback(() => {
        chatOrchestrator.clearSession();
        sessionRef.current?.deleteSaved();
        
        // Reset context usage tracking
        modelLoader.resetContextUsage();
        setContextUsage(null);
        
        // Add welcome message back
        sessionRef.current?.addAssistantMessage(
            "Hey there! I'm your WordPress assistant. Need help with site health, error logs, plugins, caching, or database optimization? Just ask!"
        );
    }, []);

    /**
     * Stop current AI generation
     */
    const handleStopGeneration = useCallback(() => {
        chatOrchestrator.abort();
        setIsStreaming(false);
        setStreamingText('');
    }, []);

    // Combine messages with streaming message for display
    const displayMessages = isStreaming && streamingText
        ? [...messages, {
            id: 'streaming',
            type: 'assistant',
            content: streamingText + '▊',
            timestamp: new Date().toISOString(),
        }]
        : messages;

    return (
        <div className="wp-neural-admin-chat-container">
            <div className="wp-neural-admin-chat-header">
                <div className="wp-neural-admin-chat-header__actions">
                    <Button
                        variant="tertiary"
                        isDestructive
                        onClick={clearHistory}
                        disabled={messages.length <= 1 || isLoading || isStreaming || isExecutingTool}
                    >
                        Clear Chat
                    </Button>
                </div>
            </div>

            <MessageList messages={displayMessages} />

            {/* Context usage warning */}
            {contextUsage?.isHigh && (
                <div className="wp-neural-admin-context-warning">
                    <Notice 
                        status={contextUsage.isCritical ? "error" : "warning"} 
                        isDismissible={false}
                    >
                        <span>
                            {contextUsage.isCritical 
                                ? `Context is almost full (${contextUsage.percentage}%). The AI may lose track of earlier messages.`
                                : `Context is ${contextUsage.percentage}% full. Consider clearing the chat soon.`
                            }
                        </span>
                        <Button 
                            variant="link" 
                            onClick={clearHistory}
                            className="wp-neural-admin-context-warning__clear"
                        >
                            Clear Chat
                        </Button>
                    </Notice>
                </div>
            )}
            
            {/* Loading spinner while tool is executing */}
            {isExecutingTool && (
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
            {pendingConfirmation && (
                <Modal
                    title="Confirm Action"
                    onRequestClose={handleCancel}
                    className="wp-neural-admin-confirm-modal"
                >
                    <p>
                        The AI wants to execute: <strong>{pendingConfirmation.toolId}</strong>
                    </p>
                    <p>
                        {pendingConfirmation.message}
                    </p>
                    <div className="wp-neural-admin-confirm-actions">
                        <Button variant="tertiary" onClick={handleCancel}>
                            Cancel
                        </Button>
                        <Button variant="primary" isDestructive onClick={handleConfirm}>
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
