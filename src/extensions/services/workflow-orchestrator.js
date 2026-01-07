/**
 * Workflow Orchestrator
 * 
 * Executes multi-step workflows with rollback support.
 * Handles sequential step execution, dependency management,
 * confirmations, and error recovery.
 * 
 * @package WPNeuralAdmin
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
