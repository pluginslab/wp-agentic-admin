/**
 * Tool Registry
 * 
 * Central registry for all available tools. Tools are registered with their
 * configuration including keywords for detection, messages, and handlers.
 * 
 * @package WPNeuralAdmin
 */

/**
 * @typedef {Object} ToolDefinition
 * @property {string} id - Unique tool identifier (e.g., 'wp-neural-admin/plugin-list')
 * @property {string[]} keywords - Keywords that trigger this tool
 * @property {string} initialMessage - Message shown when tool starts executing
 * @property {Function} summarize - Function that generates summary from result
 * @property {Function} execute - Async function that executes the tool
 * @property {boolean} [requiresConfirmation=false] - Whether to confirm before executing
 * @property {string} [confirmationMessage] - Custom confirmation message
 */

/**
 * ToolRegistry class
 * Manages registration and retrieval of tools
 */
class ToolRegistry {
    constructor() {
        /** @type {Map<string, ToolDefinition>} */
        this.tools = new Map();
    }

    /**
     * Register a new tool
     * 
     * @param {ToolDefinition} tool - Tool definition object
     * @throws {Error} If tool with same ID already exists
     */
    register(tool) {
        if (!tool.id) {
            throw new Error('Tool must have an id');
        }
        if (!tool.keywords || !Array.isArray(tool.keywords)) {
            throw new Error(`Tool ${tool.id} must have keywords array`);
        }
        if (!tool.execute || typeof tool.execute !== 'function') {
            throw new Error(`Tool ${tool.id} must have an execute function`);
        }

        if (this.tools.has(tool.id)) {
            console.warn(`[ToolRegistry] Overwriting existing tool: ${tool.id}`);
        }

        // Set defaults
        const toolWithDefaults = {
            requiresConfirmation: false,
            initialMessage: 'Working on it...',
            summarize: (result) => 'Task completed. See details below.',
            ...tool,
            // Normalize keywords to lowercase
            keywords: tool.keywords.map(k => k.toLowerCase()),
        };

        this.tools.set(tool.id, toolWithDefaults);
        console.log(`[ToolRegistry] Registered tool: ${tool.id}`);
    }

    /**
     * Register multiple tools at once
     * 
     * @param {ToolDefinition[]} tools - Array of tool definitions
     */
    registerAll(tools) {
        tools.forEach(tool => this.register(tool));
    }

    /**
     * Get a tool by ID
     * 
     * @param {string} id - Tool ID
     * @return {ToolDefinition|undefined}
     */
    get(id) {
        return this.tools.get(id);
    }

    /**
     * Get all registered tools
     * 
     * @return {ToolDefinition[]}
     */
    getAll() {
        return Array.from(this.tools.values());
    }

    /**
     * Check if a tool exists
     * 
     * @param {string} id - Tool ID
     * @return {boolean}
     */
    has(id) {
        return this.tools.has(id);
    }

    /**
     * Unregister a tool
     * 
     * @param {string} id - Tool ID
     * @return {boolean} True if tool was removed
     */
    unregister(id) {
        return this.tools.delete(id);
    }

    /**
     * Clear all registered tools
     */
    clear() {
        this.tools.clear();
    }

    /**
     * Get tools that require confirmation
     * 
     * @return {ToolDefinition[]}
     */
    getDestructiveTools() {
        return this.getAll().filter(tool => tool.requiresConfirmation);
    }
}

// Create singleton instance
const toolRegistry = new ToolRegistry();

export { ToolRegistry, toolRegistry };
export default toolRegistry;
