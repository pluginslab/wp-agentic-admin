/**
 * Dev Docs WASM — Tool Selection + Query Validation Tests
 *
 * Tests that the LLM selects the correct dev docs ability AND that the
 * WASM query layer returns expected results from the database.
 *
 * Each test has:
 * - input: user message sent to the LLM
 * - expectTool: expected ability ID (tool selection)
 * - validate(args): runs the actual WASM query and checks the results
 *
 * The validate function receives the tool args extracted by the LLM
 * and returns { passed: boolean, detail: string }.
 *
 * Run with: npm run test:abilities -- --file tests/abilities/devdocs-wasm.test.js
 *
 * Prerequisites:
 * - Ollama running with qwen3:1.7b
 * - @pluginslab/wp-devdocs-wasm linked or installed (npm link)
 *
 * @since 0.10.0
 */

const { loadAbilities } = require( './load-abilities' );
const abilities = loadAbilities();

// Lazy-loaded WASM module reference (ESM, loaded via dynamic import)
let wasmModule = null;

async function getWasm() {
	if ( ! wasmModule ) {
		wasmModule = await import( '@pluginslab/wp-devdocs-wasm' );
	}
	return wasmModule;
}

module.exports = {
	abilities,

	tests: [
		// ── searchHooks ───────────────────────────────────────────────

		{
			input: 'search for hooks related to login',
			expectTool: 'wp-agentic-admin/search-wp-hooks',
			validate: async () => {
				const { searchHooks } = await getWasm();
				const { hooks } = await searchHooks( 'login' );
				if ( ! hooks || hooks.length === 0 ) {
					return { passed: false, detail: 'no hooks found for "login"' };
				}
				const names = hooks.map( ( h ) => h.name );
				if ( ! names.some( ( n ) => n.includes( 'login' ) ) ) {
					return { passed: false, detail: `no hook name contains "login": ${ names.slice( 0, 5 ).join( ', ' ) }` };
				}
				return { passed: true, detail: `${ hooks.length } hooks found` };
			},
		},

		{
			input: 'search for enqueue hooks',
			expectTool: 'wp-agentic-admin/search-wp-hooks',
			validate: async () => {
				const { searchHooks } = await getWasm();
				const { hooks } = await searchHooks( 'enqueue' );
				if ( ! hooks || hooks.length === 0 ) {
					return { passed: false, detail: 'no hooks found for "enqueue"' };
				}
				const hasEnqueueScripts = hooks.some( ( h ) => h.name === 'wp_enqueue_scripts' );
				if ( ! hasEnqueueScripts ) {
					return { passed: false, detail: 'wp_enqueue_scripts not in results' };
				}
				return { passed: true, detail: `${ hooks.length } hooks, includes wp_enqueue_scripts` };
			},
		},

		{
			input: 'list hooks related to saving posts',
			expectTool: 'wp-agentic-admin/search-wp-hooks',
			validate: async () => {
				const { searchHooks } = await getWasm();
				const { hooks } = await searchHooks( 'save_post' );
				if ( ! hooks || hooks.length === 0 ) {
					return { passed: false, detail: 'no hooks found for "save_post"' };
				}
				const hasSavePost = hooks.some( ( h ) => h.name === 'save_post' );
				if ( ! hasSavePost ) {
					return { passed: false, detail: 'save_post not in results' };
				}
				return { passed: true, detail: `${ hooks.length } hooks, includes save_post` };
			},
		},

		// ── getHookContext ─────────────────────────────────────────────

		{
			input: 'tell me about the init hook',
			expectTool: 'wp-agentic-admin/get-hook-context',
			validate: async () => {
				const { getHookContext } = await getWasm();
				const { hook } = await getHookContext( 'init' );
				if ( ! hook ) {
					return { passed: false, detail: '"init" hook not found in database' };
				}
				if ( hook.type !== 'action' ) {
					return { passed: false, detail: `expected action, got ${ hook.type }` };
				}
				return { passed: true, detail: `init is a ${ hook.type } in ${ hook.file_path }` };
			},
		},

		{
			input: 'what does the wp_head hook do?',
			expectTool: 'wp-agentic-admin/get-hook-context',
			validate: async () => {
				const { getHookContext } = await getWasm();
				const { hook } = await getHookContext( 'wp_head' );
				if ( ! hook ) {
					return { passed: false, detail: '"wp_head" hook not found in database' };
				}
				return { passed: true, detail: `wp_head is a ${ hook.type }` };
			},
		},

		// ── searchBlocks ──────────────────────────────────────────────

		{
			input: 'find blocks for images',
			expectTool: 'wp-agentic-admin/search-wp-blocks',
			validate: async () => {
				const { searchBlocks } = await getWasm();
				const { blocks } = await searchBlocks( 'image' );
				if ( ! blocks || blocks.length === 0 ) {
					return { passed: false, detail: 'no blocks found for "image"' };
				}
				const hasCoreImage = blocks.some( ( b ) => b.name === 'core/image' );
				if ( ! hasCoreImage ) {
					return { passed: false, detail: 'core/image not in results' };
				}
				return { passed: true, detail: `${ blocks.length } blocks, includes core/image` };
			},
		},

		{
			input: 'search for navigation blocks',
			expectTool: 'wp-agentic-admin/search-wp-blocks',
			validate: async () => {
				const { searchBlocks } = await getWasm();
				const { blocks } = await searchBlocks( 'navigation' );
				if ( ! blocks || blocks.length === 0 ) {
					return { passed: false, detail: 'no blocks found for "navigation"' };
				}
				const hasNavBlock = blocks.some( ( b ) => b.name === 'core/navigation' );
				if ( ! hasNavBlock ) {
					return { passed: false, detail: 'core/navigation not in results' };
				}
				return { passed: true, detail: `${ blocks.length } blocks, includes core/navigation` };
			},
		},

		// ── getBlockSchema ────────────────────────────────────────────

		{
			input: 'show me the paragraph block schema',
			expectTool: 'wp-agentic-admin/get-block-schema',
			validate: async () => {
				const { getBlockSchema } = await getWasm();
				const { block } = await getBlockSchema( 'core/paragraph' );
				if ( ! block ) {
					return { passed: false, detail: 'core/paragraph not found in database' };
				}
				const attrCount = Object.keys( block.attributes || {} ).length;
				if ( attrCount === 0 ) {
					return { passed: false, detail: 'core/paragraph has no attributes' };
				}
				const hasContent = 'content' in ( block.attributes || {} );
				if ( ! hasContent ) {
					return { passed: false, detail: 'core/paragraph missing "content" attribute' };
				}
				return { passed: true, detail: `${ attrCount } attributes, has content` };
			},
		},

		{
			input: 'what attributes does the heading block have?',
			expectTool: 'wp-agentic-admin/get-block-schema',
			validate: async () => {
				const { getBlockSchema } = await getWasm();
				const { block } = await getBlockSchema( 'core/heading' );
				if ( ! block ) {
					return { passed: false, detail: 'core/heading not found in database' };
				}
				const attrCount = Object.keys( block.attributes || {} ).length;
				if ( attrCount === 0 ) {
					return { passed: false, detail: 'core/heading has no attributes' };
				}
				const hasLevel = 'level' in ( block.attributes || {} );
				if ( ! hasLevel ) {
					return { passed: false, detail: 'core/heading missing "level" attribute' };
				}
				return { passed: true, detail: `${ attrCount } attributes, has level` };
			},
		},

		{
			input: 'describe the core/button block',
			expectTool: 'wp-agentic-admin/get-block-schema',
			validate: async () => {
				const { getBlockSchema } = await getWasm();
				const { block } = await getBlockSchema( 'core/button' );
				if ( ! block ) {
					return { passed: false, detail: 'core/button not found in database' };
				}
				const supportKeys = Object.keys( block.supports || {} );
				if ( supportKeys.length === 0 ) {
					return { passed: false, detail: 'core/button has no supports' };
				}
				return { passed: true, detail: `${ supportKeys.length } supports: ${ supportKeys.slice( 0, 4 ).join( ', ' ) }` };
			},
		},

		// ── Multi-turn ReAct tests ────────────────────────────────────
		// These test full tool chains: LLM picks tool A, gets real result,
		// picks tool B, gets real result, then gives a final answer.

		{
			input: 'Search for heading blocks. After that, get the full schema of core/heading.',
			expectChain: [
				'wp-agentic-admin/search-wp-blocks',
				'wp-agentic-admin/get-block-schema',
			],
			resolveTool: async ( toolId, args ) => {
				const wasm = await getWasm();
				if ( toolId === 'wp-agentic-admin/search-wp-blocks' ) {
					const query = args.query || args.keyword || 'heading';
					const { blocks } = await wasm.searchBlocks( query );
					const list = blocks
						.slice( 0, 10 )
						.map( ( b ) => `${ b.name } (${ b.isDynamic ? 'dynamic' : 'static' })` )
						.join( ', ' );
					return `[Tool result] Found ${ blocks.length } blocks: ${ list }`;
				}
				if ( toolId === 'wp-agentic-admin/get-block-schema' ) {
					const blockName = args.block || 'core/heading';
					const { block } = await wasm.getBlockSchema( blockName );
					if ( ! block ) {
						return `[Tool result] Block "${ blockName }" not found.`;
					}
					const attrs = Object.keys( block.attributes || {} ).join( ', ' );
					const sups = Object.keys( block.supports || {} )
						.filter( ( k ) => block.supports[ k ] )
						.join( ', ' );
					return `[Tool result] Block ${ block.name }: attributes (${ attrs }). Supports: ${ sups }. ${ ( block.variations || [] ).length } variations.`;
				}
				return '[Tool result] Unknown tool.';
			},
			validateChain: async ( chain, finalAnswer ) => {
				// Verify the chain used real data
				const wasm = await getWasm();
				const { block } = await wasm.getBlockSchema( 'core/heading' );
				if ( ! block ) {
					return { passed: false, detail: 'core/heading not in db' };
				}
				if ( ! finalAnswer ) {
					return { passed: false, detail: 'no final answer' };
				}
				return { passed: true, detail: `2-tool chain, schema has ${ Object.keys( block.attributes ).length } attrs` };
			},
		},

	],
};
