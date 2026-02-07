/**
 * Workflow Orchestrator
 *
 * Executes multi-step workflows with rollback support.
 * Handles sequential step execution, dependency management,
 * confirmations, and error recovery.
 *
 * Supports semi-flexible workflows with includeIf conditions for
 * conditional step execution based on previous results.
 *
 */

/**
 * @typedef {Function|Object} IncludeIfCondition
 * @description Condition to determine if a step should execute.
 * 
 * Function form: (previousResults, params) => boolean
 * Object form: { prompt: "LLM prompt with {variables}" }
 */

/**
 * @typedef {Object} LLMDecisionOutput
 * @property {boolean} execute - Whether to execute the step
 * @property {string} reason - Explanation for the decision
 */

import toolRegistry from './tool-registry';
import workflowRegistry from './workflow-registry';

/**
 * @typedef {Object} WorkflowState
 * @property {string} workflowId - The workflow being executed
 * @property {string} status - 'pending' | 'running' | 'confirming' | 'completed' | 'failed' | 'rolled_back'
 * @property {number} currentStep - Current step index (0-based)
 * @property {number} totalSteps - Total number of steps
 * @property {StepResult[]} completedSteps - Results from completed steps
 * @property {Object[]} rollbackStack - Stack of rollback functions for completed write operations
 * @property {Error|null} error - Error that caused failure, if any
 */

/**
 * @typedef {Object} StepResult  
 * @property {string} abilityId - The ability that was executed
 * @property {string} label - Step label
 * @property {number} stepIndex - Step index
 * @property {boolean} success - Whether step succeeded
 * @property {Object} result - Result from ability execution
 * @property {number} duration - Execution time in ms
 */

/**
 * @typedef {Object} WorkflowResult
 * @property {boolean} success - Whether workflow completed successfully
 * @property {StepResult[]} steps - Results from all executed steps
 * @property {string} summary - Human-readable summary
 * @property {boolean} rolledBack - Whether rollback was performed
 * @property {Error|null} error - Error if failed
 */

/**
 * WorkflowOrchestrator class
 * Executes workflows and manages rollback
 */
class WorkflowOrchestrator {
    constructor() {
        /** @type {WorkflowState|null} */
        this.currentState = null;
        
        /** @type {AbortController|null} */
        this.abortController = null;

        // Callbacks for UI updates
        this.callbacks = {
            onWorkflowStart: () => {},
            onStepStart: () => {},
            onStepComplete: () => {},
            onStepFailed: () => {},
            onRollbackStart: () => {},
            onRollbackComplete: () => {},
            onWorkflowComplete: () => {},
            onWorkflowFailed: () => {},
            onConfirmationRequired: async () => true, // Default: auto-confirm
            onProgress: () => {},
        };
    }

    /**
     * Set callbacks for workflow events
     * 
     * @param {Object} callbacks - Callback functions
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * Execute a workflow
     * 
     * @param {Object} workflow - Workflow definition from WorkflowRegistry
     * @param {Object} initialParams - Initial parameters for the workflow
     * @return {Promise<WorkflowResult>} Workflow result
     */
    async execute(workflow, initialParams = {}) {
        if (this.isRunning()) {
            throw new Error('Another workflow is already running');
        }

        this.abortController = new AbortController();
        
        // Initialize state
        this.currentState = {
            workflowId: workflow.id,
            status: 'pending',
            currentStep: 0,
            totalSteps: workflow.steps.length,
            completedSteps: [],
            rollbackStack: [],
            error: null,
        };

        console.log(`[WorkflowOrchestrator] Starting workflow: ${workflow.id} (${workflow.steps.length} steps)`);
        this.callbacks.onWorkflowStart(workflow, this.currentState);

        try {
            // Request confirmation for the entire workflow if needed
            if (workflow.requiresConfirmation) {
                this.currentState.status = 'confirming';
                
                const confirmed = await this.callbacks.onConfirmationRequired(workflow, this.getConfirmationDetails(workflow));
                
                if (!confirmed) {
                    console.log('[WorkflowOrchestrator] Workflow cancelled by user');
                    return this.createResult(false, 'Workflow cancelled by user.');
                }
            }

            this.currentState.status = 'running';

            // Execute each step sequentially
            let previousResults = [];
            
            for (let i = 0; i < workflow.steps.length; i++) {
                if (this.abortController.signal.aborted) {
                    throw new Error('Workflow aborted');
                }

                const step = workflow.steps[i];
                this.currentState.currentStep = i;
                
                this.callbacks.onProgress({
                    step: i + 1,
                    total: workflow.steps.length,
                    label: step.label,
                    percentage: Math.round((i / workflow.steps.length) * 100),
                });

                const stepResult = await this.executeStep(step, i, initialParams, previousResults);
                
                if (!stepResult.success) {
                    if (step.optional) {
                        // Optional step failed, continue
                        console.log(`[WorkflowOrchestrator] Optional step ${i} failed, continuing...`);
                        this.currentState.completedSteps.push(stepResult);
                        previousResults.push(stepResult);
                        continue;
                    }
                    
                    // Non-optional step failed, trigger rollback
                    this.currentState.error = new Error(`Step ${i + 1} failed: ${stepResult.result.error || 'Unknown error'}`);
                    throw this.currentState.error;
                }

                this.currentState.completedSteps.push(stepResult);
                previousResults.push(stepResult);
            }

            // All steps completed successfully
            this.currentState.status = 'completed';
            
            const summary = workflow.summarize 
                ? workflow.summarize(this.currentState.completedSteps)
                : this.defaultSummarize(this.currentState.completedSteps);

            const result = this.createResult(true, summary);
            this.callbacks.onWorkflowComplete(result);
            
            console.log(`[WorkflowOrchestrator] Workflow completed successfully: ${workflow.id}`);
            return result;

        } catch (error) {
            console.error(`[WorkflowOrchestrator] Workflow failed: ${error.message}`);
            this.currentState.status = 'failed';
            this.currentState.error = error;

            // Perform rollback
            const rolledBack = await this.performRollback();

            const result = this.createResult(false, `Workflow failed: ${error.message}`, rolledBack);
            this.callbacks.onWorkflowFailed(result);
            
            return result;
        } finally {
            this.abortController = null;
        }
    }

    /**
     * Execute a single step
     * 
     * @param {Object} step - Step definition
     * @param {number} stepIndex - Step index
     * @param {Object} initialParams - Initial workflow parameters
     * @param {StepResult[]} previousResults - Results from previous steps
     * @return {Promise<StepResult>} Step result
     */
    async executeStep(step, stepIndex, initialParams, previousResults) {
        const startTime = Date.now();
        
        console.log(`[WorkflowOrchestrator] Executing step ${stepIndex + 1}: ${step.label}`);
        this.callbacks.onStepStart(step, stepIndex);

        // Check includeIf condition before executing (semi-flexible workflows)
        if (step.includeIf) {
            console.log(`[WorkflowOrchestrator] Evaluating includeIf condition for step ${stepIndex + 1}`);
            
            try {
                const shouldExecute = await this.evaluateIncludeIf(
                    step.includeIf,
                    previousResults,
                    initialParams
                );
                
                if (!shouldExecute) {
                    console.log(`[WorkflowOrchestrator] Skipping step ${stepIndex + 1}: ${step.label} (includeIf returned false)`);
                    return this.createSkippedStepResult(step, stepIndex, startTime);
                }
                
                console.log(`[WorkflowOrchestrator] Step ${stepIndex + 1} will execute (includeIf returned true)`);
            } catch (error) {
                console.error(`[WorkflowOrchestrator] Error evaluating includeIf for step ${stepIndex + 1}:`, error);
                // Default to true (execute step) on error (fail-safe behavior)
                console.log(`[WorkflowOrchestrator] Defaulting to execute step ${stepIndex + 1} due to includeIf error`);
            }
        }

        try {
            // Get the ability from the tool registry
            const ability = toolRegistry.get(step.abilityId);
            
            if (!ability) {
                throw new Error(`Ability not found: ${step.abilityId}`);
            }

            // Map parameters from previous results if mapper provided
            let params = { ...initialParams };
            if (step.mapParams) {
                params = step.mapParams(previousResults, initialParams);
            }

            // Check if this specific step requires confirmation
            if (step.requiresConfirmation && !step.confirmedByWorkflow) {
                const confirmed = await this.callbacks.onConfirmationRequired(
                    { label: step.label, id: step.abilityId },
                    { step: stepIndex + 1, message: `Confirm: ${step.label}?` }
                );
                
                if (!confirmed) {
                    throw new Error('Step cancelled by user');
                }
            }

            // Execute the ability
            const result = await ability.execute(params);
            
            // Check for error in result (some abilities return { error: ... })
            if (result && result.error) {
                throw new Error(result.error);
            }

            const stepResult = {
                abilityId: step.abilityId,
                label: step.label,
                stepIndex,
                success: true,
                result,
                duration: Date.now() - startTime,
            };

            // Add rollback function to stack if step has one
            if (step.rollback) {
                this.currentState.rollbackStack.push({
                    stepIndex,
                    label: step.label,
                    rollback: () => step.rollback(result, params),
                });
            }

            this.callbacks.onStepComplete(stepResult);
            console.log(`[WorkflowOrchestrator] Step ${stepIndex + 1} completed in ${stepResult.duration}ms`);
            
            return stepResult;

        } catch (error) {
            const stepResult = {
                abilityId: step.abilityId,
                label: step.label,
                stepIndex,
                success: false,
                result: { error: error.message },
                duration: Date.now() - startTime,
            };

            this.callbacks.onStepFailed(stepResult, error);
            console.error(`[WorkflowOrchestrator] Step ${stepIndex + 1} failed: ${error.message}`);
            
            return stepResult;
        }
    }

    /**
     * Evaluate includeIf condition (Hybrid: Function or LLM)
     *
     * Semi-flexible workflows with conditional step execution.
     * Supports two modes:
     * 1. Function-based (fast): includeIf is a JavaScript function
     * 2. LLM-based (flexible): includeIf is an object with a prompt template
     *
     * @since 2.0.0
     * @param {Function|Object} includeIf - The condition to evaluate
     * @param {StepResult[]} previousResults - Results from previous steps
     * @param {Object} initialParams - Initial workflow parameters
     * @return {Promise<boolean>} True if step should execute, false to skip
     */
    async evaluateIncludeIf(includeIf, previousResults, initialParams) {
        // Case A: Function-based (fast, deterministic)
        if (typeof includeIf === 'function') {
            console.log('[WorkflowOrchestrator] Evaluating function-based includeIf');
            const result = includeIf(previousResults, initialParams);
            console.log('[WorkflowOrchestrator] Function-based includeIf result:', result);
            return Boolean(result);
        }
        
        // Case B: LLM-based (flexible, slower)
        if (typeof includeIf === 'object' && includeIf.prompt) {
            console.log('[WorkflowOrchestrator] Evaluating LLM-based includeIf');
            return await this.evaluateLLMCondition(
                includeIf.prompt,
                previousResults,
                initialParams
            );
        }
        
        // Invalid config - log warning, default to true (execute step)
        console.warn('[WorkflowOrchestrator] Invalid includeIf config (not a function or {prompt}), defaulting to execute step');
        return true;
    }

    /**
     * Evaluate LLM-based condition
     * 
     * Calls the LLM with a prompt template, interpolates variables from context,
     * and enforces JSON schema: { "execute": boolean, "reason": "string" }
     * 
     * @since 2.0.0
     * @param {string} promptTemplate - Prompt with {variable} placeholders
     * @param {StepResult[]} previousResults - Results from previous steps
     * @param {Object} initialParams - Initial workflow parameters
     * @return {Promise<boolean>} True if step should execute
     */
    async evaluateLLMCondition(promptTemplate, previousResults, initialParams) {
        try {
            // Import modelLoader dynamically (it's a singleton)
            const { default: modelLoader } = await import('./model-loader');
            const engine = modelLoader.getEngine();
            
            if (!engine) {
                console.warn('[WorkflowOrchestrator] LLM not available for includeIf, defaulting to execute');
                return true; // Fail-safe: execute if LLM unavailable
            }
            
            // Step 1: Build context from previous results and params
            const context = this.buildContextFromResults(previousResults, initialParams);
            
            // Step 2: Interpolate variables in prompt
            const interpolatedPrompt = this.interpolatePrompt(promptTemplate, context);
            
            console.log('[WorkflowOrchestrator] LLM condition prompt:', interpolatedPrompt);
            
            // Step 3: Call LLM with JSON schema enforcement
            const systemPrompt = `You are evaluating whether a workflow step should execute.
Respond with JSON only: { "execute": true/false, "reason": "brief explanation" }`;

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: interpolatedPrompt }
            ];
            
            const response = await Promise.race([
                engine.chat.completions.create({
                    messages,
                    temperature: 0.2, // Low temp for consistent decisions
                    max_tokens: 150,
                    response_format: { type: 'json_object' },
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 3000)
                )
            ]);
            
            const content = response.choices[0]?.message?.content;
            if (!content) {
                console.warn('[WorkflowOrchestrator] Empty LLM response, defaulting to execute');
                return true;
            }
            
            // Step 4: Parse JSON response
            let decision;
            try {
                decision = JSON.parse(content);
            } catch (parseError) {
                console.error('[WorkflowOrchestrator] Failed to parse LLM decision JSON:', content);
                return true; // Fail-safe: execute on parse error
            }
            
            const { execute, reason } = decision;
            
            if (typeof execute !== 'boolean') {
                console.warn('[WorkflowOrchestrator] Invalid LLM decision format (missing "execute" boolean), defaulting to execute');
                return true;
            }
            
            // Step 5: Log the decision
            console.log(`[WorkflowOrchestrator] LLM decision: execute=${execute}, reason="${reason}"`);
            
            return execute;
            
        } catch (error) {
            if (error.message === 'Timeout') {
                console.warn('[WorkflowOrchestrator] LLM condition timeout (3s), defaulting to execute');
            } else {
                console.error('[WorkflowOrchestrator] Error evaluating LLM condition:', error);
            }
            return true; // Fail-safe: execute on error
        }
    }

    /**
     * Build context object from previous step results
     * 
     * Extracts data from completed steps and flattens it into a single context object
     * for variable interpolation.
     * 
     * @since 2.0.0
     * @param {StepResult[]} previousResults - Results from previous steps
     * @param {Object} initialParams - Initial workflow parameters
     * @return {Object} Context object with variables
     */
    buildContextFromResults(previousResults, initialParams) {
        const context = { ...initialParams };
        
        // Add result data from each completed step
        previousResults.forEach((stepResult, index) => {
            if (stepResult.success && stepResult.result) {
                // Flatten common result patterns
                const result = stepResult.result;
                
                // Extract common WordPress data patterns
                if (result.database_size) context.dbSize = result.database_size;
                if (result.last_optimized) context.lastOptimized = result.last_optimized;
                if (result.plugins) context.pluginCount = result.plugins.length;
                if (result.cache_size) context.cacheSize = result.cache_size;
                if (result.error_count) context.errorCount = result.error_count;
                
                // Store raw result by step index
                context[`step${index}Result`] = result;
                
                // Store by ability ID (for named access)
                if (stepResult.abilityId) {
                    const shortId = stepResult.abilityId.split('/').pop();
                    context[shortId] = result;
                }
            }
        });
        
        // Add helpful meta info
        context.completedSteps = previousResults.length;
        context.timestamp = Date.now();
        
        return context;
    }

    /**
     * Interpolate variables in a prompt template
     * 
     * Replaces {variableName} placeholders with actual values from context.
     * Logs warnings for missing variables but doesn't fail.
     * 
     * @since 2.0.0
     * @param {string} template - Prompt template with {variable} placeholders
     * @param {Object} context - Context object with variable values
     * @return {string} Interpolated prompt
     */
    interpolatePrompt(template, context) {
        let interpolated = template;
        
        // Find all {variable} placeholders
        const variables = template.match(/\{([^}]+)\}/g) || [];
        
        variables.forEach(placeholder => {
            const varName = placeholder.slice(1, -1); // Remove { and }
            
            if (varName in context) {
                const value = context[varName];
                // Convert to string representation
                const stringValue = typeof value === 'object' 
                    ? JSON.stringify(value) 
                    : String(value);
                
                interpolated = interpolated.replace(placeholder, stringValue);
            } else {
                console.warn(`[WorkflowOrchestrator] Variable "${varName}" not found in context, leaving placeholder`);
            }
        });
        
        return interpolated;
    }

    /**
     * Create a result object for a skipped step
     * 
     * @since 2.0.0
     * @param {Object} step - Step definition
     * @param {number} stepIndex - Step index
     * @param {number} startTime - Start timestamp
     * @return {StepResult} Step result with success=true but skipped flag
     */
    createSkippedStepResult(step, stepIndex, startTime) {
        return {
            abilityId: step.abilityId,
            label: step.label,
            stepIndex,
            success: true,
            skipped: true, // NEW: Flag to indicate this step was skipped
            result: { message: 'Step skipped due to includeIf condition' },
            duration: Date.now() - startTime,
        };
    }

    /**
     * Perform rollback of completed steps
     * 
     * @return {Promise<boolean>} True if rollback was performed
     */
    async performRollback() {
        if (this.currentState.rollbackStack.length === 0) {
            console.log('[WorkflowOrchestrator] No rollback operations needed');
            return false;
        }

        console.log(`[WorkflowOrchestrator] Rolling back ${this.currentState.rollbackStack.length} operations...`);
        this.callbacks.onRollbackStart(this.currentState.rollbackStack);

        const rollbackResults = [];

        // Execute rollbacks in reverse order (LIFO)
        while (this.currentState.rollbackStack.length > 0) {
            const rollbackItem = this.currentState.rollbackStack.pop();
            
            try {
                console.log(`[WorkflowOrchestrator] Rolling back: ${rollbackItem.label}`);
                await rollbackItem.rollback();
                rollbackResults.push({ step: rollbackItem.label, success: true });
            } catch (error) {
                console.error(`[WorkflowOrchestrator] Rollback failed for ${rollbackItem.label}: ${error.message}`);
                rollbackResults.push({ step: rollbackItem.label, success: false, error: error.message });
            }
        }

        this.currentState.status = 'rolled_back';
        this.callbacks.onRollbackComplete(rollbackResults);
        
        const successCount = rollbackResults.filter(r => r.success).length;
        console.log(`[WorkflowOrchestrator] Rollback complete: ${successCount}/${rollbackResults.length} succeeded`);
        
        return true;
    }

    /**
     * Get confirmation details for a workflow
     * 
     * @param {Object} workflow - Workflow definition
     * @return {Object} Confirmation details
     */
    getConfirmationDetails(workflow) {
        const stepsWithDetails = workflow.steps.map((s, i) => {
            const tool = toolRegistry.get(s.abilityId);
            const annotations = tool?.annotations || {};
            
            // Determine operation type from annotations
            let operationType = 'read';
            if (annotations.destructive) {
                operationType = 'delete';
            } else if (!annotations.readonly) {
                operationType = 'write';
            }
            
            return {
                index: i + 1,
                label: s.label,
                abilityId: s.abilityId,
                operationType,
                isWrite: !annotations.readonly,
                isDestructive: annotations.destructive || false,
                isIdempotent: annotations.idempotent || false,
            };
        });

        const writeSteps = stepsWithDetails.filter(s => s.isWrite);
        const destructiveSteps = stepsWithDetails.filter(s => s.isDestructive);

        return {
            workflowId: workflow.id,
            label: workflow.label,
            description: workflow.description,
            totalSteps: workflow.steps.length,
            writeOperations: writeSteps.length,
            destructiveOperations: destructiveSteps.length,
            steps: stepsWithDetails,
            message: workflow.confirmationMessage,
        };
    }

    /**
     * Create a workflow result object
     * 
     * @param {boolean} success - Whether workflow succeeded
     * @param {string} summary - Summary message
     * @param {boolean} rolledBack - Whether rollback was performed
     * @return {WorkflowResult}
     */
    createResult(success, summary, rolledBack = false) {
        return {
            success,
            steps: this.currentState?.completedSteps || [],
            summary,
            rolledBack,
            error: this.currentState?.error || null,
        };
    }

    /**
     * Default summary generator
     * 
     * @param {StepResult[]} steps - Completed steps
     * @return {string} Summary
     */
    defaultSummarize(steps) {
        const successCount = steps.filter(s => s.success).length;
        const totalCount = steps.length;
        
        if (successCount === totalCount) {
            return `Successfully completed all ${totalCount} steps.`;
        } else {
            return `Completed ${successCount}/${totalCount} steps.`;
        }
    }

    /**
     * Check if a workflow is currently running
     * 
     * @return {boolean}
     */
    isRunning() {
        return this.currentState?.status === 'running' || 
               this.currentState?.status === 'confirming';
    }

    /**
     * Get current workflow state
     * 
     * @return {WorkflowState|null}
     */
    getState() {
        return this.currentState;
    }

    /**
     * Abort the current workflow
     */
    abort() {
        if (this.abortController) {
            this.abortController.abort();
        }
        
        if (this.currentState) {
            this.currentState.status = 'failed';
            this.currentState.error = new Error('Workflow aborted by user');
        }
    }

    /**
     * Reset orchestrator state
     */
    reset() {
        this.currentState = null;
        this.abortController = null;
    }

    /**
     * Execute an ad-hoc workflow from parsed intents
     * 
     * @param {Object[]} intents - Parsed intents from IntentParser
     * @param {string} originalMessage - Original user message
     * @return {Promise<WorkflowResult>}
     */
    async executeFromIntents(intents, originalMessage) {
        // Create ad-hoc workflow from intents
        const workflow = workflowRegistry.createFromIntents(intents, originalMessage);
        
        // Execute the workflow
        return this.execute(workflow, { userMessage: originalMessage });
    }

    /**
     * Get a human-readable progress message
     * 
     * @return {string}
     */
    getProgressMessage() {
        if (!this.currentState) {
            return 'No workflow in progress';
        }

        const { currentStep, totalSteps, status } = this.currentState;

        switch (status) {
            case 'pending':
                return 'Preparing workflow...';
            case 'confirming':
                return 'Waiting for confirmation...';
            case 'running':
                return `Step ${currentStep + 1} of ${totalSteps}...`;
            case 'completed':
                return `Completed ${totalSteps} steps`;
            case 'failed':
                return `Failed at step ${currentStep + 1}`;
            case 'rolled_back':
                return 'Rolled back changes';
            default:
                return status;
        }
    }
}

// Create singleton instance
const workflowOrchestrator = new WorkflowOrchestrator();

export { WorkflowOrchestrator, workflowOrchestrator };
export default workflowOrchestrator;
