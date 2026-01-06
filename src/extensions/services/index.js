/**
 * Services Index
 * 
 * Central export for all framework services.
 * Import from here rather than individual files:
 * 
 * @example
 * import { chatOrchestrator, ChatSession, registerWPTools } from '../services';
 * 
 * AVAILABLE EXPORTS:
 * 
 * Core Framework (chat-orchestrator.js, chat-session.js):
 * - chatOrchestrator: Main coordinator singleton - handles message processing
 * - ChatOrchestrator: Class for creating custom orchestrator instances
 * - ChatSession: Class for message history management
 * - createSession: Factory function for creating sessions
 * - MessageType: Enum for message types (USER, ASSISTANT, TOOL_RESULT, etc.)
 * 
 * Tool System (tool-registry.js, tool-router.js, wp-tools.js, neural-abilities-api.js):
 * - toolRegistry: Singleton registry of all available tools
 * - ToolRegistry: Class for creating custom registries
 * - toolRouter: Singleton for keyword-based tool detection
 * - ToolRouter: Class for custom routing logic
 * - registerWPTools: Function to register all WordPress tools
 * - registerAbility: Public API for third-party plugins to register abilities
 * - getAbility: Get a specific ability by ID
 * - getAbilities: Get all registered abilities
 * 
 * Streaming (stream-simulator.js):
 * - streamSimulator: Singleton for typewriter effects
 * - StreamSimulator: Class for custom streaming instances
 * 
 * LLM (model-loader.js):
 * - modelLoader: WebLLM model management (load, unload, status)
 * 
 * WordPress API (abilities-api.js):
 * - abilitiesApi: REST client for WordPress Abilities API
 * 
 * @package WPNeuralAdmin
 */

// Core framework services
export { ToolRegistry, toolRegistry } from './tool-registry';
export { ToolRouter, toolRouter } from './tool-router';
export { StreamSimulator, streamSimulator } from './stream-simulator';
export { ChatSession, createSession, MessageType } from './chat-session';
export { ChatOrchestrator, chatOrchestrator } from './chat-orchestrator';

// LLM services
export { default as modelLoader } from './model-loader';

// WordPress-specific
export { default as abilitiesApi } from './abilities-api';
export { registerWPTools, getToolCount } from './wp-tools';
export { 
    registerAbility, 
    unregisterAbility, 
    getAbility, 
    getAbilities,
    hasAbility,
    executeAbility,
    exposeGlobalAPI 
} from './neural-abilities-api';

// Legacy exports (kept for reference, not actively used)
export { default as aiService } from './ai-service';
