/**
 * Workflow Registry
 * 
 * Central registry for multi-step workflow definitions.
 * Workflows define sequences of abilities that work together.
 * 
 */

/**
 * @typedef {Object} WorkflowStep
 * @property {string} abilityId - The ability to execute for this step
 * @property {string} label - Human-readable label for this step
 * @property {Function} [mapParams] - Function to map previous step outputs to this step's params
 * @property {Function} [rollback] - Optional rollback function if step succeeds but later step fails
 * @property {boolean} [requiresConfirmation=false] - Whether this specific step needs confirmation
 * @property {boolean} [optional=false] - If true, workflow continues even if this step fails
 */

/**
 * @typedef {Object} WorkflowDefinition
 * @property {string} id - Unique workflow identifier (e.g., 'wp-agentic-admin/cleanup-site')
 * @property {string} label - Human-readable name
 * @property {string} description - Description of what this workflow does
 * @property {string[]} keywords - Keywords that trigger this workflow
 * @property {WorkflowStep[]} steps - Ordered array of steps to execute
 * @property {boolean} [requiresConfirmation=true] - Whether to confirm entire workflow before starting
 * @property {string} [confirmationMessage] - Custom confirmation message
 * @property {Function} [summarize] - Function to generate final summary from all step results
 */

/**
 * @typedef {Object} StepResult
 * @property {string} abilityId - The ability that was executed
 * @property {boolean} success - Whether the step succeeded
 * @property {Object} result - The result from the ability execution
 * @property {number} stepIndex - The index of this step in the workflow
 * @property {string} label - The step label
 */

/**
 * WorkflowRegistry class
 * Manages registration and retrieval of workflows
 */
class WorkflowRegistry {
    constructor() {
        /** @type {Map<string, WorkflowDefinition>} */
        this.workflows = new Map();
    }

    /**
     * Register a new workflow
     * 
     * @param {WorkflowDefinition} workflow - Workflow definition
     * @throws {Error} If workflow is invalid
     */
    register(workflow) {
        this.validateWorkflow(workflow);

        if (this.workflows.has(workflow.id)) {
            console.warn(`[WorkflowRegistry] Overwriting existing workflow: ${workflow.id}`);
        }

        // Set defaults
        const workflowWithDefaults = {
            requiresConfirmation: true,
            confirmationMessage: `This will perform ${workflow.steps.length} operations. Continue?`,
            summarize: (results) => this.defaultSummarize(results, workflow),
            ...workflow,
            // Normalize keywords to lowercase
            keywords: (workflow.keywords || []).map(k => k.toLowerCase()),
        };

        this.workflows.set(workflow.id, workflowWithDefaults);
        console.log(`[WorkflowRegistry] Registered workflow: ${workflow.id} (${workflow.steps.length} steps)`);
    }

    /**
     * Validate a workflow definition
     * 
     * @param {WorkflowDefinition} workflow - Workflow to validate
     * @throws {Error} If invalid
     */
    validateWorkflow(workflow) {
        if (!workflow.id) {
            throw new Error('Workflow must have an id');
        }
        if (!workflow.label) {
            throw new Error(`Workflow ${workflow.id} must have a label`);
        }
        if (!workflow.steps || !Array.isArray(workflow.steps) || workflow.steps.length === 0) {
            throw new Error(`Workflow ${workflow.id} must have at least one step`);
        }

        // Validate each step
        workflow.steps.forEach((step, index) => {
            if (!step.abilityId) {
                throw new Error(`Workflow ${workflow.id} step ${index} must have an abilityId`);
            }
            if (!step.label) {
                throw new Error(`Workflow ${workflow.id} step ${index} must have a label`);
            }
        });
    }

    /**
     * Get a workflow by ID
     * 
     * @param {string} id - Workflow ID
     * @return {WorkflowDefinition|undefined}
     */
    get(id) {
        return this.workflows.get(id);
    }

    /**
     * Get all registered workflows
     * 
     * @return {WorkflowDefinition[]}
     */
    getAll() {
        return Array.from(this.workflows.values());
    }

    /**
     * Check if a workflow exists
     * 
     * @param {string} id - Workflow ID
     * @return {boolean}
     */
    has(id) {
        return this.workflows.has(id);
    }

    /**
     * Unregister a workflow
     * 
     * @param {string} id - Workflow ID
     * @return {boolean} True if workflow was removed
     */
    unregister(id) {
        return this.workflows.delete(id);
    }

    /**
     * Clear all registered workflows
     */
    clear() {
        this.workflows.clear();
    }

    /**
     * Detect workflow from user message based on keywords
     * 
     * @param {string} message - User message
     * @return {WorkflowDefinition|null} Matched workflow or null
     */
    detectWorkflow(message) {
        if (!message || typeof message !== 'string') {
            return null;
        }

        const lowerMessage = message.toLowerCase();
        let bestMatch = null;
        let bestScore = 0;

        for (const workflow of this.workflows.values()) {
            const score = this.calculateMatchScore(lowerMessage, workflow.keywords);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = workflow;
            }
        }

        // Require minimum score threshold
        if (bestScore >= 5) {
            console.log(`[WorkflowRegistry] Detected workflow: ${bestMatch.id} (score: ${bestScore})`);
            return bestMatch;
        }

        return null;
    }

    /**
     * Calculate keyword match score
     * 
     * @param {string} message - Lowercase message
     * @param {string[]} keywords - Keywords to match
     * @return {number} Match score
     */
    calculateMatchScore(message, keywords) {
        let score = 0;

        for (const keyword of keywords) {
            if (message.includes(keyword)) {
                score += keyword.length;
            }
        }

        return score;
    }

    /**
     * Default summarize function for workflows
     * 
     * @param {StepResult[]} results - Results from all steps
     * @param {WorkflowDefinition} workflow - The workflow definition
     * @return {string} Summary message
     */
    defaultSummarize(results, workflow) {
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;

        if (successCount === totalCount) {
            return `Completed "${workflow.label}" successfully (${totalCount} steps).`;
        } else if (successCount === 0) {
            return `Failed to complete "${workflow.label}". All ${totalCount} steps failed.`;
        } else {
            return `Partially completed "${workflow.label}". ${successCount}/${totalCount} steps succeeded.`;
        }
    }

    /**
     * Create a workflow from an array of parsed intents
     * This creates an "ad-hoc" workflow from multi-intent parsing
     * 
     * @param {Object[]} intents - Array of parsed intents from IntentParser
     * @param {string} originalMessage - The original user message
     * @return {WorkflowDefinition} A dynamically created workflow
     */
    createFromIntents(intents, originalMessage) {
        const workflowId = `adhoc-${Date.now()}`;
        
        const steps = intents.map((intent, index) => ({
            abilityId: intent.abilityId,
            label: `Step ${index + 1}: ${intent.abilityId.split('/').pop().replace(/-/g, ' ')}`,
            mapParams: (previousResults) => ({
                userMessage: intent.params.userMessage || originalMessage,
                ...intent.params,
                previousResults,
            }),
            requiresConfirmation: intent.category === 'write',
        }));

        const workflow = {
            id: workflowId,
            label: 'Multi-step Action',
            description: `Executing ${intents.length} actions from: "${originalMessage}"`,
            keywords: [], // Ad-hoc workflows don't have keywords
            steps,
            requiresConfirmation: steps.some(s => s.requiresConfirmation),
            isAdhoc: true, // Flag to indicate this was dynamically created
        };

        // Don't register ad-hoc workflows, just return them
        return workflow;
    }

    /**
     * Get workflows that contain a specific ability
     * 
     * @param {string} abilityId - Ability ID to search for
     * @return {WorkflowDefinition[]} Workflows containing this ability
     */
    getWorkflowsWithAbility(abilityId) {
        return this.getAll().filter(workflow =>
            workflow.steps.some(step => step.abilityId === abilityId)
        );
    }

    /**
     * Get a readable description of a workflow's steps
     * 
     * @param {string} workflowId - Workflow ID
     * @return {string[]} Array of step descriptions
     */
    getWorkflowStepDescriptions(workflowId) {
        const workflow = this.get(workflowId);
        if (!workflow) return [];

        return workflow.steps.map((step, index) => 
            `${index + 1}. ${step.label}`
        );
    }
}

// Create singleton instance
const workflowRegistry = new WorkflowRegistry();

export { WorkflowRegistry, workflowRegistry };
export default workflowRegistry;
