/**
 * Chat History Service
 *
 * Manages conversation state and message history.
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
    ABILITY_REQUEST: 'ability-request',
    ABILITY_RESULT: 'ability-result',
    ERROR: 'error',
};

/**
 * Generate a unique message ID
 *
 * @return {string} Unique ID
 */
const generateId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a new message object
 *
 * @param {string} type - Message type from MessageType enum
 * @param {string} content - Message content
 * @param {Object} meta - Optional metadata
 * @return {Object} Message object
 */
export const createMessage = (type, content, meta = {}) => {
    return {
        id: generateId(),
        type,
        content,
        timestamp: new Date().toISOString(),
        meta,
    };
};

/**
 * Create a user message
 *
 * @param {string} content - User's message text
 * @return {Object} Message object
 */
export const createUserMessage = (content) => {
    return createMessage(MessageType.USER, content);
};

/**
 * Create an assistant message
 *
 * @param {string} content - Assistant's response text
 * @return {Object} Message object
 */
export const createAssistantMessage = (content) => {
    return createMessage(MessageType.ASSISTANT, content);
};

/**
 * Create a system message
 *
 * @param {string} content - System notification text
 * @return {Object} Message object
 */
export const createSystemMessage = (content) => {
    return createMessage(MessageType.SYSTEM, content);
};

/**
 * Create an ability request message
 *
 * @param {string} abilityId - Full ability ID (namespace/name)
 * @param {string} label - Human-readable ability label
 * @param {Object} input - Input parameters
 * @return {Object} Message object
 */
export const createAbilityRequestMessage = (abilityId, label, input = {}) => {
    return createMessage(MessageType.ABILITY_REQUEST, `Executing: ${label}`, {
        abilityId,
        label,
        input,
        status: 'pending',
    });
};

/**
 * Create an ability result message
 *
 * @param {string} abilityId - Full ability ID
 * @param {Object} result - Execution result
 * @param {boolean} success - Whether execution succeeded
 * @return {Object} Message object
 */
export const createAbilityResultMessage = (abilityId, result, success = true) => {
    return createMessage(
        MessageType.ABILITY_RESULT,
        success ? 'Ability executed successfully' : 'Ability execution failed',
        {
            abilityId,
            result,
            success,
        }
    );
};

/**
 * Create an error message
 *
 * @param {string} content - Error message text
 * @param {Error|null} error - Optional error object
 * @return {Object} Message object
 */
export const createErrorMessage = (content, error = null) => {
    return createMessage(MessageType.ERROR, content, {
        error: error?.message || null,
    });
};

/**
 * Initial welcome message
 *
 * @return {Object} Welcome message object
 */
export const getWelcomeMessage = () => {
    return createMessage(
        MessageType.SYSTEM,
        `**Welcome to Neural Admin!**

I'm your AI assistant running locally in your browser. I can help you:

- Diagnose site errors by reading logs
- Optimize your database
- Manage plugins
- Check site health
- Flush caches

*Use the "Abilities" tab to manually test available tools, or chat with me once the AI model is loaded.*`
    );
};

/**
 * Chat history reducer actions
 */
export const ChatActions = {
    ADD_MESSAGE: 'ADD_MESSAGE',
    UPDATE_MESSAGE: 'UPDATE_MESSAGE',
    CLEAR_HISTORY: 'CLEAR_HISTORY',
    SET_MESSAGES: 'SET_MESSAGES',
};

/**
 * Chat history reducer
 *
 * @param {Array} state - Current messages array
 * @param {Object} action - Action object
 * @return {Array} New messages array
 */
export const chatReducer = (state, action) => {
    switch (action.type) {
        case ChatActions.ADD_MESSAGE:
            return [...state, action.payload];

        case ChatActions.UPDATE_MESSAGE:
            return state.map((msg) =>
                msg.id === action.payload.id
                    ? { ...msg, ...action.payload.updates }
                    : msg
            );

        case ChatActions.CLEAR_HISTORY:
            return [getWelcomeMessage()];

        case ChatActions.SET_MESSAGES:
            return action.payload;

        default:
            return state;
    }
};

/**
 * Get initial chat state
 *
 * @return {Array} Initial messages array with welcome message
 */
export const getInitialChatState = () => {
    return [getWelcomeMessage()];
};
