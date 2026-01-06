/**
 * Chat Session
 * 
 * Manages chat history, message state, and session persistence.
 * Provides a clean interface for adding/removing messages and saving sessions.
 * 
 * @package WPNeuralAdmin
 */

/**
 * Message types enum
 */
export const MessageType = {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system',
    TOOL_REQUEST: 'tool_request',
    TOOL_RESULT: 'tool_result',
    ERROR: 'error',
};

/**
 * Generate unique ID for messages
 * @return {string}
 */
const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * ChatSession class
 * Manages a single chat session with history and persistence
 */
class ChatSession {
    /**
     * Create a new chat session
     * 
     * @param {Object} options - Session options
     * @param {string} [options.id] - Session ID (generated if not provided)
     * @param {string} [options.storageKey] - LocalStorage key for persistence
     * @param {Function} [options.onChange] - Callback when messages change
     */
    constructor(options = {}) {
        this.id = options.id || `session_${Date.now()}`;
        this.storageKey = options.storageKey || 'wp-neural-admin-chat-session';
        this.onChange = options.onChange || (() => {});
        
        /** @type {Array} */
        this.messages = [];
        
        /** @type {Object} */
        this.metadata = {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    /**
     * Create a message object
     * 
     * @param {string} type - Message type from MessageType enum
     * @param {string} content - Message content
     * @param {Object} [meta] - Additional metadata
     * @return {Object} Message object
     */
    createMessage(type, content, meta = {}) {
        return {
            id: generateId(),
            type,
            content,
            timestamp: new Date().toISOString(),
            meta,
        };
    }

    /**
     * Add a message to the session
     * 
     * @param {Object} message - Message object
     * @return {Object} The added message
     */
    addMessage(message) {
        this.messages.push(message);
        this.metadata.updatedAt = new Date().toISOString();
        this.onChange(this.messages, message);
        return message;
    }

    /**
     * Add a user message
     * 
     * @param {string} content - Message content
     * @return {Object} The added message
     */
    addUserMessage(content) {
        return this.addMessage(this.createMessage(MessageType.USER, content));
    }

    /**
     * Add an assistant message
     * 
     * @param {string} content - Message content
     * @return {Object} The added message
     */
    addAssistantMessage(content) {
        return this.addMessage(this.createMessage(MessageType.ASSISTANT, content));
    }

    /**
     * Add a system message
     * 
     * @param {string} content - Message content
     * @return {Object} The added message
     */
    addSystemMessage(content) {
        return this.addMessage(this.createMessage(MessageType.SYSTEM, content));
    }

    /**
     * Add a tool request message
     * 
     * @param {string} toolId - Tool identifier
     * @param {Object} [params] - Tool parameters
     * @return {Object} The added message
     */
    addToolRequest(toolId, params = {}) {
        return this.addMessage(this.createMessage(
            MessageType.TOOL_REQUEST,
            `Executing ${toolId}...`,
            { toolId, params }
        ));
    }

    /**
     * Add a tool result message
     * 
     * @param {string} toolId - Tool identifier
     * @param {Object} result - Tool execution result
     * @param {boolean} [success=true] - Whether execution succeeded
     * @return {Object} The added message
     */
    addToolResult(toolId, result, success = true) {
        return this.addMessage(this.createMessage(
            MessageType.TOOL_RESULT,
            success ? 'Tool executed successfully' : 'Tool execution failed',
            { toolId, result, success }
        ));
    }

    /**
     * Add an error message
     * 
     * @param {string} content - Error message
     * @param {Error} [error] - Error object
     * @return {Object} The added message
     */
    addErrorMessage(content, error = null) {
        return this.addMessage(this.createMessage(
            MessageType.ERROR,
            content,
            { error: error?.message || null }
        ));
    }

    /**
     * Get all messages
     * 
     * @return {Array}
     */
    getMessages() {
        return [...this.messages];
    }

    /**
     * Get message count
     * 
     * @return {number}
     */
    getMessageCount() {
        return this.messages.length;
    }

    /**
     * Get the last message
     * 
     * @return {Object|null}
     */
    getLastMessage() {
        return this.messages.length > 0 
            ? this.messages[this.messages.length - 1] 
            : null;
    }

    /**
     * Remove a message by ID
     * 
     * @param {string} messageId - Message ID to remove
     * @return {boolean} True if message was removed
     */
    removeMessage(messageId) {
        const index = this.messages.findIndex(m => m.id === messageId);
        if (index !== -1) {
            this.messages.splice(index, 1);
            this.metadata.updatedAt = new Date().toISOString();
            this.onChange(this.messages, null);
            return true;
        }
        return false;
    }

    /**
     * Clear all messages
     */
    clear() {
        this.messages = [];
        this.metadata.updatedAt = new Date().toISOString();
        this.onChange(this.messages, null);
    }

    /**
     * Get conversation history for LLM context
     * Returns messages in a format suitable for LLM APIs
     * 
     * @param {number} [maxMessages] - Maximum messages to include
     * @return {Array} Conversation history
     */
    getConversationHistory(maxMessages) {
        const relevantMessages = this.messages.filter(m => 
            m.type === MessageType.USER || m.type === MessageType.ASSISTANT
        );

        const history = relevantMessages.map(m => ({
            role: m.type === MessageType.USER ? 'user' : 'assistant',
            content: m.content,
        }));

        if (maxMessages && history.length > maxMessages) {
            return history.slice(-maxMessages);
        }

        return history;
    }

    /**
     * Save session to localStorage
     * 
     * @return {boolean} True if saved successfully
     */
    save() {
        try {
            const data = {
                id: this.id,
                messages: this.messages,
                metadata: this.metadata,
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            console.log(`[ChatSession] Saved session: ${this.id}`);
            return true;
        } catch (error) {
            console.error('[ChatSession] Failed to save session:', error);
            return false;
        }
    }

    /**
     * Load session from localStorage
     * 
     * @return {boolean} True if loaded successfully
     */
    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (!data) {
                console.log('[ChatSession] No saved session found');
                return false;
            }

            const parsed = JSON.parse(data);
            this.id = parsed.id || this.id;
            this.messages = parsed.messages || [];
            this.metadata = {
                ...this.metadata,
                ...parsed.metadata,
            };

            console.log(`[ChatSession] Loaded session: ${this.id} (${this.messages.length} messages)`);
            this.onChange(this.messages, null);
            return true;
        } catch (error) {
            console.error('[ChatSession] Failed to load session:', error);
            return false;
        }
    }

    /**
     * Delete saved session from localStorage
     * 
     * @return {boolean} True if deleted
     */
    deleteSaved() {
        try {
            localStorage.removeItem(this.storageKey);
            console.log('[ChatSession] Deleted saved session');
            return true;
        } catch (error) {
            console.error('[ChatSession] Failed to delete session:', error);
            return false;
        }
    }

    /**
     * Check if there's a saved session
     * 
     * @return {boolean}
     */
    hasSavedSession() {
        return localStorage.getItem(this.storageKey) !== null;
    }

    /**
     * Export session data
     * 
     * @return {Object}
     */
    export() {
        return {
            id: this.id,
            messages: this.messages,
            metadata: this.metadata,
        };
    }

    /**
     * Import session data
     * 
     * @param {Object} data - Exported session data
     */
    import(data) {
        if (data.id) this.id = data.id;
        if (data.messages) this.messages = data.messages;
        if (data.metadata) this.metadata = { ...this.metadata, ...data.metadata };
        this.onChange(this.messages, null);
    }
}

// Factory function to create sessions
const createSession = (options) => new ChatSession(options);

export { ChatSession, createSession, generateId };
export default ChatSession;
