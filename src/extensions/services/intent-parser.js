/**
 * Intent Parser
 * 
 * Extracts multiple intents from natural language input using pattern matching.
 * Designed for small LLMs that cannot reliably do structured tool calling.
 * 
 * @package WPNeuralAdmin
 */

import toolRegistry from './tool-registry';

/**
 * @typedef {Object} ParsedIntent
 * @property {string} abilityId - The ability ID to execute (e.g., 'wp-neural-admin/plugin-list')
 * @property {Object} params - Extracted parameters for this intent
 * @property {string} rawMatch - The original text that matched this intent
 * @property {number} confidence - Confidence score (0-1)
 * @property {string[]} dependencies - IDs of other intents this depends on (for workflow chaining)
 */

/**
 * @typedef {Object} ParseResult
 * @property {ParsedIntent[]} intents - Array of parsed intents
 * @property {boolean} isMultiIntent - Whether multiple intents were detected
 * @property {boolean} requiresWorkflow - Whether this needs workflow orchestration
 * @property {string} originalMessage - The original user message
 */

/**
 * Conjunction patterns that indicate multiple actions
 */
const MULTI_ACTION_PATTERNS = [
    /\s+and\s+(?:then\s+)?/gi,
    /\s+then\s+/gi,
    /\s+after\s+that\s+/gi,
    /\s*,\s*(?:and\s+)?(?:then\s+)?/gi,
    /\s+also\s+/gi,
    /\s+plus\s+/gi,
];

/**
 * Action verb patterns for intent detection
 * Maps action verbs to likely ability categories
 */
const ACTION_PATTERNS = {
    // Read/List operations
    list: {
        patterns: [
            /(?:list|show|display|get|check|view|see)\s+(?:all\s+)?(?:the\s+)?(\w+)/gi,
        ],
        category: 'read',
    },
    // Status/Health checks  
    status: {
        patterns: [
            /(?:check|get|show|view)\s+(?:the\s+)?(?:site\s+)?(?:health|status)/gi,
            /(?:site\s+)?health\s+(?:check|status|report)/gi,
            /how\s+(?:is|are)\s+(?:the\s+)?(?:site|server|database)/gi,
        ],
        category: 'read',
    },
    // Deactivate/Disable operations
    deactivate: {
        patterns: [
            /(?:deactivate|disable|turn\s+off)\s+(?:the\s+)?(?:plugin\s+)?["']?([a-z0-9-_ ]+)["']?/gi,
        ],
        category: 'write',
    },
    // Activate/Enable operations  
    activate: {
        patterns: [
            /(?:activate|enable|turn\s+on)\s+(?:the\s+)?(?:plugin\s+)?["']?([a-z0-9-_ ]+)["']?/gi,
        ],
        category: 'write',
    },
    // Cache operations
    cache: {
        patterns: [
            /(?:clear|flush|purge|empty|clean)\s+(?:the\s+)?(?:cache|caches)/gi,
            /(?:cache|caches)\s+(?:clear|flush|purge)/gi,
        ],
        category: 'write',
    },
    // Database operations
    database: {
        patterns: [
            /(?:optimize|clean|repair)\s+(?:the\s+)?(?:database|db)/gi,
            /(?:database|db)\s+(?:optimization|cleanup|repair)/gi,
        ],
        category: 'write',
    },
    // Error log operations
    errors: {
        patterns: [
            /(?:show|check|view|read|get)\s+(?:the\s+)?(?:error|debug)\s*(?:log|logs)?/gi,
            /(?:error|debug)\s*(?:log|logs)/gi,
            /(?:any|recent)\s+errors/gi,
        ],
        category: 'read',
    },
};

/**
 * Map action types to ability IDs
 */
const ACTION_TO_ABILITY = {
    'list-plugins': 'wp-neural-admin/plugin-list',
    'list-plugin': 'wp-neural-admin/plugin-list',
    'check-plugins': 'wp-neural-admin/plugin-list',
    'deactivate': 'wp-neural-admin/plugin-deactivate',
    'disable': 'wp-neural-admin/plugin-deactivate',
    'cache': 'wp-neural-admin/cache-flush',
    'clear-cache': 'wp-neural-admin/cache-flush',
    'flush-cache': 'wp-neural-admin/cache-flush',
    'database': 'wp-neural-admin/db-optimize',
    'optimize-database': 'wp-neural-admin/db-optimize',
    'db-optimize': 'wp-neural-admin/db-optimize',
    'errors': 'wp-neural-admin/error-log-read',
    'error-log': 'wp-neural-admin/error-log-read',
    'status': 'wp-neural-admin/site-health',
    'site-health': 'wp-neural-admin/site-health',
    'health-check': 'wp-neural-admin/site-health',
};

/**
 * IntentParser class
 * Parses user messages to extract one or more intents
 */
class IntentParser {
    constructor(registry = toolRegistry) {
        this.registry = registry;
    }

    /**
     * Parse a user message to extract intents
     * 
     * @param {string} message - User message to parse
     * @return {ParseResult} Parsed result with intents
     */
    parse(message) {
        if (!message || typeof message !== 'string') {
            return this.createEmptyResult(message);
        }

        const originalMessage = message;
        const normalizedMessage = message.toLowerCase().trim();
        
        // First, try to detect if this is a multi-intent message
        const segments = this.segmentMessage(normalizedMessage);
        
        // Parse each segment for intents
        const intents = [];
        
        for (const segment of segments) {
            const segmentIntents = this.parseSegment(segment, originalMessage);
            intents.push(...segmentIntents);
        }

        // Deduplicate intents (same ability appearing multiple times)
        const uniqueIntents = this.deduplicateIntents(intents);
        
        // Determine dependencies between intents
        this.resolveDependencies(uniqueIntents);

        return {
            intents: uniqueIntents,
            isMultiIntent: uniqueIntents.length > 1,
            requiresWorkflow: uniqueIntents.length > 1 || uniqueIntents.some(i => i.dependencies.length > 0),
            originalMessage,
        };
    }

    /**
     * Segment a message by conjunctions/separators
     * 
     * @param {string} message - Normalized message
     * @return {string[]} Array of segments
     */
    segmentMessage(message) {
        let segments = [message];
        
        // Apply each multi-action pattern to split the message
        for (const pattern of MULTI_ACTION_PATTERNS) {
            const newSegments = [];
            for (const segment of segments) {
                const parts = segment.split(pattern).filter(s => s.trim().length > 0);
                newSegments.push(...parts);
            }
            segments = newSegments;
        }

        // Clean up segments
        return segments
            .map(s => s.trim())
            .filter(s => s.length > 2); // Filter out very short segments
    }

    /**
     * Parse a single segment for intents
     * 
     * @param {string} segment - Message segment to parse
     * @param {string} originalMessage - Original full message
     * @return {ParsedIntent[]} Array of parsed intents
     */
    parseSegment(segment, originalMessage) {
        const intents = [];
        
        // Try pattern-based detection first
        for (const [actionType, config] of Object.entries(ACTION_PATTERNS)) {
            for (const pattern of config.patterns) {
                // Reset lastIndex for global patterns
                pattern.lastIndex = 0;
                const match = pattern.exec(segment);
                
                if (match) {
                    const abilityId = this.resolveAbilityId(actionType, match[1]);
                    
                    if (abilityId && this.registry.has(abilityId)) {
                        intents.push({
                            abilityId,
                            params: this.extractParams(abilityId, segment, match),
                            rawMatch: match[0],
                            confidence: this.calculateConfidence(match, segment),
                            dependencies: [],
                            category: config.category,
                        });
                    }
                }
            }
        }

        // If no pattern matches, try keyword-based detection (fallback to existing tool-router logic)
        if (intents.length === 0) {
            const tools = this.registry.getAll();
            
            for (const tool of tools) {
                const score = this.calculateKeywordScore(segment, tool.keywords);
                if (score > 0) {
                    intents.push({
                        abilityId: tool.id,
                        params: { userMessage: originalMessage },
                        rawMatch: segment,
                        confidence: Math.min(score / 20, 1), // Normalize score to 0-1
                        dependencies: [],
                        category: tool.requiresConfirmation ? 'write' : 'read',
                    });
                }
            }
        }

        return intents;
    }

    /**
     * Resolve action type to ability ID
     * 
     * @param {string} actionType - Action type from patterns
     * @param {string} target - Matched target (e.g., "plugins")
     * @return {string|null} Ability ID or null
     */
    resolveAbilityId(actionType, target) {
        // Direct mapping
        if (ACTION_TO_ABILITY[actionType]) {
            return ACTION_TO_ABILITY[actionType];
        }

        // Target-based mapping
        if (target) {
            const normalizedTarget = target.toLowerCase().trim();
            
            // Check if target indicates a specific ability
            if (normalizedTarget.includes('plugin')) {
                if (actionType === 'list') return 'wp-neural-admin/plugin-list';
                if (actionType === 'deactivate') return 'wp-neural-admin/plugin-deactivate';
            }
            if (normalizedTarget.includes('cache')) {
                return 'wp-neural-admin/cache-flush';
            }
            if (normalizedTarget.includes('database') || normalizedTarget.includes('db')) {
                return 'wp-neural-admin/db-optimize';
            }
            if (normalizedTarget.includes('error') || normalizedTarget.includes('log')) {
                return 'wp-neural-admin/error-log-read';
            }
            if (normalizedTarget.includes('health') || normalizedTarget.includes('status')) {
                return 'wp-neural-admin/site-health';
            }
        }

        // Compound key lookup
        const compoundKey = target ? `${actionType}-${target}` : actionType;
        return ACTION_TO_ABILITY[compoundKey] || null;
    }

    /**
     * Extract parameters for a specific ability from the segment
     * 
     * @param {string} abilityId - Ability ID
     * @param {string} segment - Message segment
     * @param {RegExpExecArray} match - Regex match result
     * @return {Object} Extracted parameters
     */
    extractParams(abilityId, segment, match) {
        const params = { userMessage: segment };

        // Ability-specific parameter extraction
        if (abilityId === 'wp-neural-admin/plugin-deactivate' && match[1]) {
            // Extract plugin name/slug
            const pluginName = match[1].trim().replace(/["']/g, '');
            params.pluginName = pluginName;
        }

        return params;
    }

    /**
     * Calculate confidence score for a match
     * 
     * @param {RegExpExecArray} match - Regex match
     * @param {string} segment - Original segment
     * @return {number} Confidence score 0-1
     */
    calculateConfidence(match, segment) {
        // Base confidence on match length relative to segment length
        const matchRatio = match[0].length / segment.length;
        
        // Boost confidence for exact action verbs
        const hasActionVerb = /^(list|show|check|deactivate|disable|clear|flush|optimize|get)/i.test(segment);
        
        return Math.min(matchRatio + (hasActionVerb ? 0.3 : 0), 1);
    }

    /**
     * Calculate keyword match score (same as tool-router)
     * 
     * @param {string} message - Message to check
     * @param {string[]} keywords - Keywords to match
     * @return {number} Score
     */
    calculateKeywordScore(message, keywords) {
        let score = 0;
        const lowerMessage = message.toLowerCase();

        for (const keyword of keywords) {
            if (lowerMessage.includes(keyword.toLowerCase())) {
                score += keyword.length;
            }
        }

        return score;
    }

    /**
     * Remove duplicate intents (same ability matched multiple times)
     * 
     * @param {ParsedIntent[]} intents - Array of intents
     * @return {ParsedIntent[]} Deduplicated intents
     */
    deduplicateIntents(intents) {
        const seen = new Map();
        
        for (const intent of intents) {
            const existing = seen.get(intent.abilityId);
            if (!existing || intent.confidence > existing.confidence) {
                seen.set(intent.abilityId, intent);
            }
        }

        return Array.from(seen.values());
    }

    /**
     * Resolve dependencies between intents
     * For example: "list plugins and deactivate hello-dolly" - deactivate might depend on list
     * 
     * @param {ParsedIntent[]} intents - Array of intents to analyze
     */
    resolveDependencies(intents) {
        // Currently, dependencies are sequential by default
        // Future: analyze semantic dependencies
        // For now, write operations that follow read operations
        // may optionally depend on read results
        
        for (let i = 1; i < intents.length; i++) {
            const current = intents[i];
            const previous = intents[i - 1];
            
            // If current is a write and previous was a read of same resource type
            // mark as potential dependency
            if (current.category === 'write' && previous.category === 'read') {
                // Check if they're related (e.g., both about plugins)
                if (this.areRelated(previous.abilityId, current.abilityId)) {
                    current.dependencies.push(previous.abilityId);
                }
            }
        }
    }

    /**
     * Check if two abilities are related (operate on same resource type)
     * 
     * @param {string} abilityId1 - First ability ID
     * @param {string} abilityId2 - Second ability ID
     * @return {boolean} True if related
     */
    areRelated(abilityId1, abilityId2) {
        // Extract resource type from ability ID
        const getResourceType = (id) => {
            if (id.includes('plugin')) return 'plugin';
            if (id.includes('cache')) return 'cache';
            if (id.includes('db') || id.includes('database')) return 'database';
            if (id.includes('error') || id.includes('log')) return 'log';
            if (id.includes('health') || id.includes('site')) return 'site';
            return null;
        };

        return getResourceType(abilityId1) === getResourceType(abilityId2);
    }

    /**
     * Create an empty parse result
     * 
     * @param {string} originalMessage - Original message
     * @return {ParseResult}
     */
    createEmptyResult(originalMessage) {
        return {
            intents: [],
            isMultiIntent: false,
            requiresWorkflow: false,
            originalMessage: originalMessage || '',
        };
    }

    /**
     * Check if a message likely contains multiple intents
     * Quick check before full parsing
     * 
     * @param {string} message - Message to check
     * @return {boolean}
     */
    hasMultipleIntents(message) {
        if (!message) return false;
        
        const lowerMessage = message.toLowerCase();
        
        // Quick check for multi-action indicators
        return MULTI_ACTION_PATTERNS.some(pattern => {
            pattern.lastIndex = 0;
            return pattern.test(lowerMessage);
        });
    }
}

// Create singleton instance
const intentParser = new IntentParser();

export { IntentParser, intentParser };
export default intentParser;
