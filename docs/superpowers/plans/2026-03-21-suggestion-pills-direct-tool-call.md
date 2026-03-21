# Suggestion Pills — Direct Tool Call Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a suggestion pill is clicked, execute the linked ability directly and summarize the result with one LLM call — instead of sending the label as a new user message through the full ReAct loop.

**Architecture:** Four changes: (1) pass `toolId` through the pill click handler in the UI, (2) add a suggestion fallback in `ReactAgent` so pills always appear, (3) extract `ensureReactAgent()` helper from `ChatOrchestrator`, (4) add `processDirectAbility()` to `ChatOrchestrator` that runs the tool directly then calls the LLM once for a summary.

**Tech Stack:** React (WordPress `@wordpress/element`), Jest, ES modules in `src/`, no PHP changes.

**Spec:** `docs/superpowers/specs/2026-03-21-suggestion-pills-direct-tool-call-design.md`

---

## File Map

| File | Change |
|---|---|
| `src/extensions/components/MessageItem.jsx` | Modify: pass `{ label, toolId }` instead of just `label` to `onSuggestionClick` |
| `src/extensions/components/ChatContainer.jsx` | Modify: route `{ label, toolId }` pill clicks to `processDirectAbility` |
| `src/extensions/services/react-agent.js` | Modify: tighten suggestions rule in system prompt; add client-side suggestion fallback in `final_answer` branch |
| `src/extensions/services/chat-orchestrator.js` | Modify: extract `ensureReactAgent()` from `processWithReact`; add `processDirectAbility(toolId, label)` |
| `src/extensions/services/__tests__/react-agent.test.js` | Modify: add tests for suggestion fallback |
| `src/extensions/services/__tests__/chat-orchestrator.test.js` | Create: tests for `processDirectAbility` |

---

## Task 1: Suggestion fallback in `ReactAgent`

Add a client-side fallback: when the LLM's `final_answer` has no suggestions, auto-populate them from a semantic search over the answer text.

**Files:**
- Modify: `src/extensions/services/react-agent.js` (lines around 430–447, the `final_answer` case)
- Modify: `src/extensions/services/__tests__/react-agent.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `src/extensions/services/__tests__/react-agent.test.js`, inside the existing `describe('ReactAgent', ...)` block. Add a mock for `search-abilities` at the top of the file alongside other mocks:

```js
// At top of file alongside other jest.mock() calls:
jest.mock( '../../abilities/search-abilities', () => ( {
	filterToolsForPrompt: jest.fn( () => [] ),
} ) );
```

Then import it at the top:
```js
import { filterToolsForPrompt } from '../../abilities/search-abilities';
```

Add this describe block:

```js
describe( 'Suggestion fallback', () => {
	it( 'populates suggestions from filterToolsForPrompt when LLM omits them', async () => {
		filterToolsForPrompt.mockReturnValueOnce( [] ); // search query extraction
		filterToolsForPrompt.mockReturnValueOnce( [
			{ id: 'wp-agentic-admin/cache-flush', label: 'Flush Cache' },
		] );

		mockStreamOnce(
			mockEngine,
			'{"action": "tool_call", "tool": "wp-agentic-admin/plugin-list", "args": {}}',
			'{"action": "final_answer", "content": "You should flush your cache.", "suggestions": []}'
		);

		const result = await reactAgent.execute( 'flush cache', [] );

		expect( result.suggestions ).toEqual( [
			{ label: 'Flush Cache', tool: 'wp-agentic-admin/cache-flush' },
		] );
	} );

	it( 'keeps LLM suggestions when they are non-empty', async () => {
		filterToolsForPrompt.mockReturnValueOnce( [] ); // search query extraction

		mockStreamOnce(
			mockEngine,
			'{"action": "final_answer", "content": "Done.", "suggestions": [{"label": "Check Updates", "tool": "wp-agentic-admin/update-check"}]}'
		);

		const result = await reactAgent.execute( 'done', [] );

		expect( result.suggestions ).toEqual( [
			{ label: 'Check Updates', tool: 'wp-agentic-admin/update-check' },
		] );
		expect( filterToolsForPrompt ).not.toHaveBeenCalledWith(
			expect.any( String ),
			expect.any( Array ),
			expect.objectContaining( { max: 3 } )
		);
	} );
} );
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd "/Users/dreiqbik-mb/Local Sites/cfhack26-agentic-admin/app/public/wp-content/plugins/wp-agentic-admin"
npm test -- --testPathPattern="react-agent" 2>&1 | tail -20
```

Expected: tests fail (filterToolsForPrompt not called for fallback yet).

- [ ] **Step 3: Tighten system prompt rule in `buildSystemPromptPromptBased`**

In `src/extensions/services/react-agent.js`, find the line:
```
- Add a suggestion for every tool you recommend in your answer (up to 6). Use only tool IDs from the TOOLS list.
```

Replace with:
```
- Always include a \`suggestions\` array in every final_answer — never omit it. If you used a tool, called one, or mentioned one by name, add it. If you made recommendations, add the most relevant available tool. Use only tool IDs from the TOOLS list. Up to 6 suggestions.
```

- [ ] **Step 4: Add suggestion fallback in `executeWithPromptBased`**

In `src/extensions/services/react-agent.js`, find the `final_answer` case (around line 431):

```js
// Case 2: Final answer
if ( action.action === 'final_answer' ) {
    log.info( 'LLM provided final answer' );
    const rawAnswer =
        action.content || action.answer || 'Task completed.';
    const suggestions = Array.isArray( action.suggestions )
        ? action.suggestions
        : [];

    return {
        success: true,
        finalAnswer: extractContent( rawAnswer ),
        suggestions,
        ...
    };
}
```

Replace with:

```js
// Case 2: Final answer
if ( action.action === 'final_answer' ) {
    log.info( 'LLM provided final answer' );
    const rawAnswer =
        action.content || action.answer || 'Task completed.';
    let suggestions = Array.isArray( action.suggestions )
        ? action.suggestions
        : [];

    // Fallback: if LLM omitted suggestions, auto-populate from semantic search
    if ( suggestions.length === 0 ) {
        const cleanedAnswer = extractContent( rawAnswer );
        const matched = filterToolsForPrompt(
            cleanedAnswer,
            this.toolRegistry.getAll(),
            { max: 3, exclude: 'wp-agentic-admin/search-abilities' }
        );
        suggestions = matched.map( ( t ) => ( {
            label: t.label,
            tool: t.id,
        } ) );
    }

    return {
        success: true,
        finalAnswer: extractContent( rawAnswer ),
        suggestions,
        iterations: iteration,
        toolsUsed,
        observations,
    };
}
```

Also add the import at the top of `react-agent.js` — check if `filterToolsForPrompt` is already imported. It is (line 14):
```js
import { filterToolsForPrompt } from '../abilities/search-abilities';
```
No change needed.

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern="react-agent" 2>&1 | tail -20
```

Expected: all tests pass including the two new ones.

- [ ] **Step 6: Lint**

```bash
npx wp-scripts lint-js src/extensions/services/react-agent.js src/extensions/services/__tests__/react-agent.test.js
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/extensions/services/react-agent.js src/extensions/services/__tests__/react-agent.test.js
git commit -m "feat: add client-side suggestion fallback and tighten system prompt rule"
```

---

## Task 2: Extract `ensureReactAgent()` from `ChatOrchestrator`

Refactor the lazy-init block in `processWithReact` into a shared helper so both `processWithReact` and the upcoming `processDirectAbility` can use it.

**Files:**
- Modify: `src/extensions/services/chat-orchestrator.js`

- [ ] **Step 1: Extract the helper**

In `src/extensions/services/chat-orchestrator.js`, find the lazy-init block inside `processWithReact` (lines 301–334):

```js
// Create ReAct agent if not exists
if ( ! this.reactAgent ) {
    this.reactAgent = new ReactAgent( modelLoader, toolRegistry );

    // Wire up callbacks
    this.reactAgent.setCallbacks( {
        onToolStart: ( toolId ) => { ... },
        onToolEnd: ( toolId, result, success ) => { ... },
        onThinkingStart: () => { ... },
        onThinkingChunk: ( delta, fullThinkText ) => { ... },
        onThinkingEnd: ( thinkContent ) => { ... },
        onContextFiltered: ( tools ) => { ... },
        onConfirmationRequired: async ( tool ) => { ... },
    } );
}
```

Replace it in `processWithReact` with:
```js
this.ensureReactAgent();
```

Add `ensureReactAgent()` as a new method directly above `processWithReact`:

```js
/**
 * Ensure the ReAct agent is created and callbacks are wired.
 * Safe to call multiple times — idempotent.
 */
ensureReactAgent() {
    if ( this.reactAgent ) {
        return;
    }

    this.reactAgent = new ReactAgent( modelLoader, toolRegistry );

    this.reactAgent.setCallbacks( {
        onToolStart: ( toolId ) => {
            this.callbacks.onToolStart( toolId );
        },
        onToolEnd: ( toolId, result, success ) => {
            this.callbacks.onToolEnd( toolId, result, success );
            // Add tool result to session
            this.session.addToolResult( toolId, result, success );
        },
        onThinkingStart: () => {
            this.callbacks.onThinkingStart?.();
        },
        onThinkingChunk: ( delta, fullThinkText ) => {
            this.callbacks.onThinkingChunk?.( delta, fullThinkText );
        },
        onThinkingEnd: ( thinkContent ) => {
            if ( thinkContent ) {
                this.session.addThinkingMessage( thinkContent );
            }
            this.callbacks.onThinkingEnd?.( thinkContent );
        },
        onContextFiltered: ( tools ) => {
            this.session.addContextMessage( tools );
            this.callbacks.onContextFiltered?.( tools );
        },
        onConfirmationRequired: async ( tool ) => {
            return await this.requestConfirmation( tool );
        },
    } );
}
```

- [ ] **Step 2: Run all unit tests**

```bash
npm test 2>&1 | tail -20
```

Expected: all existing tests still pass (this is a pure refactor).

- [ ] **Step 3: Lint**

```bash
npx wp-scripts lint-js src/extensions/services/chat-orchestrator.js
```

- [ ] **Step 4: Commit**

```bash
git add src/extensions/services/chat-orchestrator.js
git commit -m "refactor: extract ensureReactAgent helper from processWithReact"
```

---

## Task 3: Add `processDirectAbility` to `ChatOrchestrator`

**Files:**
- Modify: `src/extensions/services/chat-orchestrator.js`
- Create: `src/extensions/services/__tests__/chat-orchestrator.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/extensions/services/__tests__/chat-orchestrator.test.js`:

```js
/**
 * ChatOrchestrator tests — processDirectAbility
 */

import { ChatOrchestrator } from '../chat-orchestrator';

jest.mock( '../../utils/logger', () => ( {
	createLogger: () => ( {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	} ),
} ) );

jest.mock( '../model-loader', () => ( {
	__esModule: true,
	default: { isModelReady: jest.fn( () => true ), getLastUsageStats: jest.fn( () => null ) },
} ) );

jest.mock( '../tool-registry', () => ( {
	__esModule: true,
	default: { get: jest.fn(), getAll: jest.fn( () => [] ) },
} ) );

jest.mock( '../../abilities/search-abilities', () => ( {
	filterToolsForPrompt: jest.fn( () => [] ),
} ) );

// Import mocked singletons after mocking
import modelLoader from '../model-loader';
import toolRegistry from '../tool-registry';

function makeSession() {
	return {
		addUserMessage: jest.fn(),
		addAssistantMessage: jest.fn(),
		addErrorMessage: jest.fn(),
		addLoadingMessage: jest.fn( () => ( { remove: jest.fn() } ) ),
		addToolResult: jest.fn(),
		getConversationHistory: jest.fn( () => [] ),
	};
}

function makeOrchestrator( session ) {
	const orc = new ChatOrchestrator();
	orc.initialize( session );
	orc.setCallbacks( {
		onStreamStart: jest.fn(),
		onStreamEnd: jest.fn(),
		onStateChange: jest.fn(),
		onToolStart: jest.fn(),
		onToolEnd: jest.fn(),
		onError: jest.fn(),
	} );
	return orc;
}

describe( 'ChatOrchestrator.processDirectAbility', () => {
	let session;
	let orc;
	let mockEngine;

	beforeEach( () => {
		session = makeSession();
		orc = makeOrchestrator( session );

		mockEngine = {
			chat: { completions: { create: jest.fn() } },
		};

		// Wire engine into modelLoader mock
		modelLoader.getEngine = jest.fn( () => mockEngine );

		jest.clearAllMocks();
		// Re-apply after clearAllMocks
		session = makeSession();
		orc = makeOrchestrator( session );
		modelLoader.getEngine = jest.fn( () => mockEngine );
		modelLoader.isModelReady = jest.fn( () => true );
		modelLoader.getLastUsageStats = jest.fn( () => null );
	} );

	afterEach( () => {
		jest.clearAllMocks();
	} );

	it( 'adds user bubble, executes tool, posts assistant reply', async () => {
		toolRegistry.get = jest.fn( () => ( {
			id: 'wp-agentic-admin/cache-flush',
			label: 'Flush Cache',
			execute: jest.fn().mockResolvedValue( { success: true, message: 'Cache flushed' } ),
		} ) );
		toolRegistry.getAll = jest.fn( () => [] );

		mockEngine.chat.completions.create.mockResolvedValue( {
			choices: [ { message: { content: '{"action":"final_answer","content":"Cache was flushed.","suggestions":[]}' } } ],
		} );

		await orc.processDirectAbility( 'wp-agentic-admin/cache-flush', 'Flush cache' );

		expect( session.addUserMessage ).toHaveBeenCalledWith( 'Flush cache' );
		expect( session.addAssistantMessage ).toHaveBeenCalledWith(
			expect.objectContaining( { content: 'Cache was flushed.' } )
		);
	} );

	it( 'delegates to processMessage when toolId is not in registry', async () => {
		toolRegistry.get = jest.fn( () => null );
		orc.processMessage = jest.fn().mockResolvedValue( { success: true } );

		await orc.processDirectAbility( 'wp-agentic-admin/unknown', 'some label' );

		expect( orc.processMessage ).toHaveBeenCalledWith( 'some label' );
		expect( session.addUserMessage ).not.toHaveBeenCalled();
	} );

	it( 'does not call LLM when tool is cancelled', async () => {
		toolRegistry.get = jest.fn( () => ( {
			id: 'wp-agentic-admin/cache-flush',
			label: 'Flush Cache',
			requiresConfirmation: true,
			execute: jest.fn(),
		} ) );

		// Simulate cancelled confirmation
		orc.reactAgent = {
			executeTool: jest.fn().mockResolvedValue( { success: false, cancelled: true } ),
			config: { maxToolResultLength: 2000 },
		};

		await orc.processDirectAbility( 'wp-agentic-admin/cache-flush', 'Flush cache' );

		expect( mockEngine.chat.completions.create ).not.toHaveBeenCalled();
		expect( session.addAssistantMessage ).toHaveBeenCalledWith(
			expect.objectContaining( { content: 'Action cancelled.' } )
		);
	} );

	it( 'returns early if already processing', async () => {
		orc.isProcessing = true;

		const result = await orc.processDirectAbility( 'wp-agentic-admin/cache-flush', 'Flush cache' );

		expect( result ).toEqual( { success: false, error: 'Already processing a message' } );
		expect( session.addUserMessage ).not.toHaveBeenCalled();
	} );

	it( 'calls onStateChange with isProcessing true then false', async () => {
		toolRegistry.get = jest.fn( () => ( {
			id: 'wp-agentic-admin/cache-flush',
			label: 'Flush Cache',
			execute: jest.fn().mockResolvedValue( { success: true } ),
		} ) );
		toolRegistry.getAll = jest.fn( () => [] );

		mockEngine.chat.completions.create.mockResolvedValue( {
			choices: [ { message: { content: '{"action":"final_answer","content":"Done.","suggestions":[]}' } } ],
		} );

		const onStateChange = jest.fn();
		orc.setCallbacks( { onStateChange } );

		await orc.processDirectAbility( 'wp-agentic-admin/cache-flush', 'Flush cache' );

		expect( onStateChange ).toHaveBeenCalledWith( { isProcessing: true } );
		expect( onStateChange ).toHaveBeenCalledWith( { isProcessing: false } );
	} );
} );
```

- [ ] **Step 2: Export `ChatOrchestrator` class (if not already named export)**

Check `chat-orchestrator.js` bottom for how it exports. If it only has `export default chatOrchestrator` (singleton), add a named export for the class so tests can instantiate it:

```js
export { ChatOrchestrator };
export default chatOrchestrator;
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern="chat-orchestrator" 2>&1 | tail -30
```

Expected: fail with `orc.processDirectAbility is not a function`.

- [ ] **Step 4: Implement `processDirectAbility`**

Add this method to `ChatOrchestrator` in `chat-orchestrator.js`, after `processWithReact`:

```js
/**
 * Process a suggestion pill click by executing the ability directly.
 *
 * Skips routing and tool-selection LLM call. Runs the ability immediately,
 * then calls the LLM once to summarize the result.
 *
 * @param {string} toolId - Ability ID to execute (e.g. 'wp-agentic-admin/cache-flush')
 * @param {string} label  - Human-readable pill label, used as the user message
 * @return {Promise<Object>} Result with success status
 */
async processDirectAbility( toolId, label ) {
    if ( ! this.session ) {
        throw new Error(
            'ChatOrchestrator not initialized. Call initialize() first.'
        );
    }

    if ( this.isProcessing ) {
        return { success: false, error: 'Already processing a message' };
    }

    // Delegate to full ReAct loop if tool is not registered
    const tool = this.toolRegistry.get( toolId );
    if ( ! tool ) {
        log.warn( `processDirectAbility: unknown toolId ${ toolId }, delegating to processMessage` );
        return this.processMessage( label );
    }

    this.isProcessing = true;
    this.currentAbortController = new AbortController();
    this.callbacks.onStateChange( { isProcessing: true } );

    const loadingMessage = this.session.addLoadingMessage?.( 'Running...' );

    try {
        // Guard: model must be ready
        if ( ! this.isLLMReady() ) {
            this.session.addAssistantMessage( {
                content: 'The AI model is not loaded yet. Please load the model first.',
            } );
            return { success: false, error: 'Model not loaded' };
        }

        // Add user turn
        this.session.addUserMessage( label );

        // Ensure agent is created and callbacks wired
        this.ensureReactAgent();

        // Execute the tool directly
        const toolExecutionResult = await this.reactAgent.executeTool(
            toolId,
            {},
            label
        );

        // Handle cancellation and hard failure before calling LLM
        if ( toolExecutionResult.cancelled === true ) {
            this.session.addAssistantMessage( { content: 'Action cancelled.' } );
            return { success: true, cancelled: true };
        }
        if ( toolExecutionResult.success === false ) {
            this.session.addAssistantMessage( {
                content: `The tool failed: ${ toolExecutionResult.error || 'Unknown error' }`,
            } );
            return { success: false, error: toolExecutionResult.error };
        }

        // Truncate result to avoid context window overflow
        const resultStr = JSON.stringify( toolExecutionResult );
        const truncatedResult =
            resultStr.length > this.reactAgent.config.maxToolResultLength
                ? resultStr.substring( 0, this.reactAgent.config.maxToolResultLength ) +
                  '...[truncated]'
                : resultStr;

        // Build system prompt — filter tools by pill label
        const filteredTools = filterToolsForPrompt(
            label,
            this.toolRegistry.getAll(),
            { max: 10, exclude: 'wp-agentic-admin/search-abilities' }
        );
        const systemPrompt =
            this.reactAgent.buildSystemPromptPromptBased( filteredTools ) ||
            'You are a WordPress assistant. Summarize the following tool result for the user.';

        // Single-shot LLM summary (no streaming)
        const engine = modelLoader.getEngine();
        const messages = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: this.reactAgent.buildToolResultMessage(
                    toolExecutionResult,
                    truncatedResult
                ),
            },
        ];

        this.callbacks.onStreamStart();

        const response = await engine.chat.completions.create( {
            messages,
            stream: false,
            temperature: this.reactAgent.config.temperature,
            max_tokens: this.reactAgent.config.maxTokens,
        } );

        const responseContent =
            response.choices[ 0 ]?.message?.content?.trim() || '';
        const action =
            this.reactAgent.parseActionFromResponse( responseContent );

        let rawAnswer = "Tool ran but I couldn't summarize the result.";
        let suggestions = [];

        if ( action && action.action === 'final_answer' ) {
            rawAnswer = action.content || rawAnswer;
            suggestions = Array.isArray( action.suggestions )
                ? action.suggestions
                : [];
        }

        // Suggestion fallback: populate from semantic search if LLM omitted them
        if ( suggestions.length === 0 ) {
            const { extractContent } = await import( '../utils/content-extractor' ).catch( () => ( {
                extractContent: ( t ) => t,
            } ) );
            const cleanedAnswer = extractContent( rawAnswer );
            const matched = filterToolsForPrompt(
                cleanedAnswer,
                this.toolRegistry.getAll(),
                { max: 3, exclude: 'wp-agentic-admin/search-abilities' }
            );
            suggestions = matched.map( ( t ) => ( {
                label: t.label,
                tool: t.id,
            } ) );
        }

        // NOTE: extractContent is defined inside react-agent.js.
        // For the final answer content, use the same inline approach:
        // strip JSON envelope if present (rawAnswer may be plain text already).
        const finalContent = rawAnswer.trim().startsWith( '{' )
            ? ( () => {
                    try {
                        return JSON.parse( rawAnswer ).content || rawAnswer;
                    } catch {
                        return rawAnswer;
                    }
              } )()
            : rawAnswer;

        this.session.addAssistantMessage( {
            content: finalContent,
            suggestions,
            ...this.getUsageStatsMeta(),
        } );

        this.callbacks.onStreamEnd( finalContent );

        return { success: true };
    } catch ( error ) {
        log.error( 'processDirectAbility error:', error );
        this.session.addErrorMessage(
            'An error occurred while processing your message.'
        );
        this.callbacks.onError( error );
        return { success: false, error: error.message };
    } finally {
        loadingMessage?.remove?.();
        this.isProcessing = false;
        this.currentAbortController = null;
        this.callbacks.onStateChange( { isProcessing: false } );
    }
}
```

**Important:** `extractContent` is a module-level function inside `react-agent.js`, not exported. Rather than a dynamic import (which adds complexity), expose it by exporting it from `react-agent.js`:

```js
// In react-agent.js, change the function declaration to be exported:
export function extractContent( text ) { ... }
```

Then import it in `chat-orchestrator.js`:
```js
import ReactAgent, { extractContent } from './react-agent';
```

And replace the dynamic import block in `processDirectAbility` with:
```js
const cleanedAnswer = extractContent( rawAnswer );
```

- [ ] **Step 5: Add `filterToolsForPrompt` import to `chat-orchestrator.js`**

It's already imported at the top (line 22):
```js
import { filterToolsForPrompt } from '../abilities/search-abilities';
```
No change needed.

- [ ] **Step 6: Run tests**

```bash
npm test -- --testPathPattern="chat-orchestrator" 2>&1 | tail -30
```

Expected: all 5 tests pass.

- [ ] **Step 7: Run all tests**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 8: Lint**

```bash
npx wp-scripts lint-js src/extensions/services/chat-orchestrator.js src/extensions/services/__tests__/chat-orchestrator.test.js src/extensions/services/react-agent.js
```

- [ ] **Step 9: Commit**

```bash
git add src/extensions/services/chat-orchestrator.js src/extensions/services/react-agent.js src/extensions/services/__tests__/chat-orchestrator.test.js
git commit -m "feat: add processDirectAbility to ChatOrchestrator"
```

---

## Task 4: Update UI — `MessageItem.jsx` and `ChatContainer.jsx`

**Files:**
- Modify: `src/extensions/components/MessageItem.jsx`
- Modify: `src/extensions/components/ChatContainer.jsx`

- [ ] **Step 1: Update `MessageItem.jsx`**

Find the pill `onClick` handler (around line 503):

```js
onClick={ () =>
    onSuggestionClick(
        suggestion.label
    )
}
```

Change to:

```js
onClick={ () =>
    onSuggestionClick( {
        label: suggestion.label,
        toolId: suggestion.tool,
    } )
}
```

Also update the JSDoc for `onSuggestionClick` prop (line ~134):
```js
 * @param {Function} props.onSuggestionClick - Called with { label, toolId } when a pill is clicked
```

- [ ] **Step 2: Update `ChatContainer.jsx`**

Find `handleSuggestionClick` (around line 365):

```js
const handleSuggestionClick = useCallback(
    ( label ) => {
        handleSendMessage( label );
    },
    [ handleSendMessage ]
);
```

Replace with:

```js
const handleSuggestionClick = useCallback(
    ( { label, toolId } ) => {
        if ( toolId ) {
            chatOrchestrator.processDirectAbility( toolId, label ).catch(
                ( error ) => log.error( 'processDirectAbility error:', error )
            );
        } else {
            handleSendMessage( label );
        }
    },
    [ handleSendMessage ]
);
```

- [ ] **Step 3: Lint both files**

```bash
npx wp-scripts lint-js src/extensions/components/MessageItem.jsx src/extensions/components/ChatContainer.jsx
```

Expected: no errors.

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | tail -20
```

Expected: clean build, no errors.

- [ ] **Step 5: Run all tests**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/extensions/components/MessageItem.jsx src/extensions/components/ChatContainer.jsx
git commit -m "feat: route suggestion pill clicks through processDirectAbility"
```

---

## Done

All four tasks complete. Verify end-to-end by loading the plugin, asking a question that produces suggestion pills (e.g. "list my plugins"), then clicking a pill and confirming:
- A user bubble appears with the pill label
- Tool request and result bubbles appear in the timeline
- An assistant summary appears (no "thinking" phase)
- New suggestion pills appear below the summary
- The whole interaction is noticeably faster than typing the same request
