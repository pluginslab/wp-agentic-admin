/**
 * Services Index
 * 
 * Central export for all framework services.
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
export { registerWPTools, wpTools, getToolConfig } from './wp-tools';

// Legacy exports (for backwards compatibility during migration)
export { default as aiService } from './ai-service';
