/**
 * Message Router
 *
 * Simple routing logic that decides whether to use:
 * 1. Conversational mode (for informational questions)
 * 2. A registered workflow (keyword-based detection)
 * 3. ReAct loop (default for everything else)
 *
 * This replaces the complex 4-tier routing with a clean 3-option system.
 *
 * @since 0.1.0
 */

import workflowRegistry from './workflow-registry';
import { createLogger } from '../utils/logger';

const log = createLogger( 'MessageRouter' );

/**
 * @typedef {Object} RouteResult
 * @property {'workflow'|'react'|'conversational'} type       - Route type
 * @property {Object}                              [workflow] - Workflow definition (if type is 'workflow')
 */

/**
 * Question patterns that indicate informational queries
 *
 * This regex-based pre-filter catches obvious questions before the ReAct loop.
 * With 7B models, this serves as a performance optimization — routing pure
 * informational questions to the cheaper conversational path avoids unnecessary
 * tool-calling overhead.
 */
const QUESTION_PATTERNS = [
	/^what (is|are|does|do|was|were)/i,
	/^how (do|does|can|to|is|are)/i,
	/^why (is|are|does|do|did)/i,
	/^when (is|are|does|do|did)/i,
	/^where (is|are|does|do)/i,
	/^who (is|are|does|do)/i,
	/^can you (explain|tell me|describe)/i,
	/^(explain|describe|tell me about)/i,
];

/**
 * Check if message is an informational question
 *
 * @param {string} message - User message
 * @return {boolean} True if message looks like a question
 */
function isQuestion( message ) {
	const trimmed = message.trim();
	return QUESTION_PATTERNS.some( ( pattern ) => pattern.test( trimmed ) );
}

/**
 * Route a user message to the appropriate handler
 *
 * Routing logic:
 * 1. Check if it's an informational question → conversational mode
 * 2. Check if message matches a registered workflow → workflow mode
 * 3. Default to ReAct loop for actions
 *
 * @param {string} userMessage - The user's message
 * @return {RouteResult} Route decision
 */
export function route( userMessage ) {
	if ( ! userMessage || typeof userMessage !== 'string' ) {
		log.warn( 'Invalid message, defaulting to ReAct' );
		return { type: 'react' };
	}

	// Step 1: Check for informational questions
	if ( isQuestion( userMessage ) ) {
		log.info(
			'Detected informational question, routing to conversational mode'
		);
		return { type: 'conversational' };
	}

	// Step 2: Check for workflow keyword match
	const workflow = workflowRegistry.detectWorkflow( userMessage );
	if ( workflow ) {
		log.info( `Detected workflow: ${ workflow.id }` );
		return {
			type: 'workflow',
			workflow,
		};
	}

	// Step 3: Default to ReAct loop for actions
	log.info( 'No workflow or question detected, routing to ReAct' );
	return { type: 'react' };
}

/**
 * Check if a message would trigger a workflow
 *
 * Utility function for testing/debugging.
 *
 * @param {string} userMessage - The user's message
 * @return {boolean} True if a workflow would be triggered
 */
export function isWorkflowQuery( userMessage ) {
	return route( userMessage ).type === 'workflow';
}

/**
 * Check if a message would be treated as conversational
 *
 * Utility function for testing/debugging.
 *
 * @param {string} userMessage - The user's message
 * @return {boolean} True if message is detected as a question
 */
export function isConversationalQuery( userMessage ) {
	return route( userMessage ).type === 'conversational';
}

export default { route, isWorkflowQuery, isConversationalQuery };
