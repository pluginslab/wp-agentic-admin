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
 * Tool System (tool-registry.js, wp-tools.js, agentic-abilities-api.js):
 * - toolRegistry: Singleton registry of all available tools
 * - ToolRegistry: Class for creating custom registries
 * - registerWPTools: Function to register all WordPress tools
 * - registerAbility: Public API for third-party plugins to register abilities
 * - getAbility: Get a specific ability by ID
 * - getAbilities: Get all registered abilities
 *
 * ReAct System (react-agent.js, message-router.js):
 * - ReactAgent: Reasoning + Acting loop for intelligent tool selection
 * - messageRouter: Simple routing (workflow keywords vs ReAct loop)
 *
 * Workflow System (workflow-registry.js, workflow-orchestrator.js):
 * - workflowRegistry: Singleton registry for multi-step workflows
 * - WorkflowRegistry: Class for custom workflow registries
 * - workflowOrchestrator: Executes workflows with rollback support
 * - WorkflowOrchestrator: Class for custom workflow execution
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
 */

// Core framework services
export { ToolRegistry, toolRegistry } from './tool-registry';
export { StreamSimulator, streamSimulator } from './stream-simulator';
export { ChatSession, createSession, MessageType } from './chat-session';
export { ChatOrchestrator, chatOrchestrator } from './chat-orchestrator';

// ReAct system (v1.5.0)
export { ReactAgent } from './react-agent';
export { default as messageRouter } from './message-router';

// Workflow system
export { WorkflowRegistry, workflowRegistry } from './workflow-registry';
export {
	WorkflowOrchestrator,
	workflowOrchestrator,
} from './workflow-orchestrator';

// LLM services
export { default as modelLoader } from './model-loader';

// WordPress-specific
export { default as abilitiesApi } from './abilities-api';
export { registerWPTools, getToolCount } from './wp-tools';
export {
	// Abilities API
	registerAbility,
	unregisterAbility,
	getAbility,
	getAbilities,
	hasAbility,
	executeAbility,
	exposeGlobalAPI,
	// Workflows API (v1.1)
	registerWorkflow,
	unregisterWorkflow,
	getWorkflow,
	getWorkflows,
	hasWorkflow,
} from './agentic-abilities-api';

// Legacy exports (kept for reference, not actively used)
export { default as aiService } from './ai-service';
