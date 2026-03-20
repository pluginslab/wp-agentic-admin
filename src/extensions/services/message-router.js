/**
 * Message Router
 *
 * 3-tier routing that decides whether to use:
 * 1. A registered workflow (keyword-based detection)
 * 2. ReAct loop (message matches tool keywords + action intent)
 * 3. Direct LLM (knowledge questions with no tool relevance)
 *
 * Tool-relevant messages go through ReAct with thinking disabled for speed.
 * Pure knowledge questions skip ReAct entirely and go straight to the LLM.
 *
 * @since 0.1.0
 */

import workflowRegistry from './workflow-registry';
import toolRegistry from './tool-registry';
import instructionRegistry from './instruction-registry';
import { createLogger } from '../utils/logger';

const log = createLogger( 'MessageRouter' );

/**
 * Words that signal the user wants to perform an action (not just ask about something).
 * Checked as word boundaries against the lowercased message.
 */
const ACTION_WORDS = [
	'list',
	'show',
	'check',
	'flush',
	'clear',
	'purge',
	'optimize',
	'activate',
	'deactivate',
	'enable',
	'disable',
	'turn on',
	'turn off',
	'read',
	'run',
	'delete',
	'clean',
	'fix',
	'refresh',
	'regenerate',
	'reset',
	'view',
];

/**
 * Words that signal a pure knowledge question (no action desired).
 */
const QUESTION_WORDS = [
	'what is',
	'what are',
	'what does',
	'explain',
	'define',
	'difference between',
	'tell me about',
	'meaning of',
];

/**
 * @typedef {Object} RouteResult
 * @property {'workflow'|'react'|'conversational'} type                  - Route type
 * @property {Object}                              [workflow]            - Workflow definition (if type is 'workflow')
 * @property {string[]}                            [preloadInstructions] - Instruction IDs to preload before ReAct loop
 */

/**
 * Detect which instruction keywords match a user message.
 *
 * @param {string} message - Lowercased user message
 * @return {string[]} Matching instruction IDs
 */
function matchesInstructionKeywords( message ) {
	return instructionRegistry.detectInstructions( message );
}

/**
 * Check if a message matches any tool keywords.
 *
 * @param {string} message - Lowercased user message
 * @return {boolean} True if any tool keyword is found in the message
 */
function matchesToolKeywords( message ) {
	const tools = toolRegistry.getAll();
	for ( const tool of tools ) {
		if ( ! tool.keywords ) {
			continue;
		}
		for ( const keyword of tool.keywords ) {
			if ( message.includes( keyword.toLowerCase() ) ) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Check if a message contains action intent.
 *
 * @param {string} message - Lowercased user message
 * @return {boolean} True if action words are present
 */
function hasActionIntent( message ) {
	return ACTION_WORDS.some( ( word ) => message.includes( word ) );
}

/**
 * Check if a message is a pure knowledge question.
 *
 * @param {string} message - Lowercased user message
 * @return {boolean} True if message is a knowledge question
 */
function isKnowledgeQuestion( message ) {
	return QUESTION_WORDS.some( ( word ) => message.startsWith( word ) );
}

/**
 * Route a user message to the appropriate handler
 *
 * Routing logic:
 * 1. Check if message matches a registered workflow → workflow mode
 * 2. Check if message has tool keyword + action intent → ReAct (no thinking)
 * 3. Check if message has tool keyword but is a knowledge question → conversational
 * 4. Check if message has tool keyword (ambiguous) → ReAct (with thinking)
 * 5. No tool keyword match → conversational (direct LLM)
 *
 * @param {string} userMessage - The user's message
 * @return {RouteResult} Route decision
 */
export function route( userMessage ) {
	if ( ! userMessage || typeof userMessage !== 'string' ) {
		log.warn( 'Invalid message, defaulting to ReAct' );
		return { type: 'react' };
	}

	// Step 1: Check for workflow keyword match
	const workflow = workflowRegistry.detectWorkflow( userMessage );
	if ( workflow ) {
		log.info( `Detected workflow: ${ workflow.id }` );
		return {
			type: 'workflow',
			workflow,
		};
	}

	const lower = userMessage.toLowerCase().trim();
	const hasKeyword = matchesToolKeywords( lower );
	const hasAction = hasActionIntent( lower );
	const preloadInstructions = matchesInstructionKeywords( lower );

	// Step 2: Tool keyword + action intent → ReAct without thinking (fast path)
	if ( hasKeyword && hasAction ) {
		log.info( 'Routing to ReAct (keyword + action match, no thinking)' );
		return { type: 'react', disableThinking: true, preloadInstructions };
	}

	// Step 3: Tool keyword + knowledge question → skip ReAct entirely
	const isQuestion = isKnowledgeQuestion( lower );
	if ( hasKeyword && isQuestion ) {
		log.info(
			'Routing to conversational (keyword present but knowledge question)'
		);
		return { type: 'conversational' };
	}

	// Step 4: Tool keyword but ambiguous intent → ReAct with thinking
	if ( hasKeyword ) {
		log.info( 'Routing to ReAct (keyword match, ambiguous intent)' );
		return { type: 'react', disableThinking: false, preloadInstructions };
	}

	// Step 5: No tool relevance → conversational
	log.info( 'Routing to conversational (no tool keyword match)' );
	return { type: 'conversational' };
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

export default { route, isWorkflowQuery };
