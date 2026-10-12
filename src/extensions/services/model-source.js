/**
 * Model Source
 *
 * The local engine downloads model files only from the addresses saved in
 * Settings (option agentic_admin_model_source). In v2 that option defaults
 * to the MLC-AI addresses (see Settings::default_model_source() in PHP), and
 * the site owner can change or clear them. WebLLM's built-in list is still
 * stripped at build time (tools/strip-webllm-prebuilt-loader.js), and the
 * WebLLM app config is built here from the option.
 *
 * - weights_url: base URL of the model weight folders. WebLLM reads each
 *   model from `${ weights_url }${ modelId }/resolve/main/`.
 * - library_url: base URL of the compiled model libraries (.wasm). Each
 *   library is read from `${ library_url }${ modelVersion }/${ lib }`, where
 *   modelVersion comes from the bundled WebLLM, so a WebLLM upgrade picks
 *   the matching libraries without the owner changing anything.
 */

/**
 * Models the plugin supports, matching WebLLM 0.2.86's own records.
 * `lib` is the file name of the compiled model library for that model.
 * `maxHistorySize` mirrors WebLLM's override for the Qwen 3.5 records.
 */
export const MODEL_RECORDS = [
	{
		id: 'Qwen3-1.7B-q4f16_1-MLC',
		lib: 'Qwen3-1.7B-q4f16_1_cs1k-webgpu.wasm',
		vramRequiredMB: 2036.66,
		lowResourceRequired: true,
	},
	{
		id: 'Qwen3-1.7B-q4f32_1-MLC',
		lib: 'Qwen3-1.7B-q4f32_1_cs1k-webgpu.wasm',
		vramRequiredMB: 2635.44,
		lowResourceRequired: true,
	},
	{
		id: 'Qwen3.5-2B-q4f16_1-MLC',
		lib: 'Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm',
		vramRequiredMB: 2245.44,
		lowResourceRequired: false,
		maxHistorySize: 1,
	},
	{
		id: 'Qwen3.5-2B-q4f32_1-MLC',
		lib: 'Qwen3.5-2B-q4f32_1_cs1k-webgpu.wasm',
		vramRequiredMB: 2591.55,
		lowResourceRequired: false,
		maxHistorySize: 1,
	},
	{
		id: 'Qwen3.5-4B-q4f16_1-MLC',
		lib: 'Qwen3.5-4B-q4f16_1_cs1k-webgpu.wasm',
		vramRequiredMB: 3867.82,
		lowResourceRequired: false,
		maxHistorySize: 1,
	},
	{
		id: 'Qwen3.5-4B-q4f32_1-MLC',
		lib: 'Qwen3.5-4B-q4f32_1_cs1k-webgpu.wasm',
		vramRequiredMB: 4680.36,
		lowResourceRequired: false,
		maxHistorySize: 1,
	},
	{
		id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
		lib: 'Qwen2-7B-Instruct-q4f16_1_cs1k-webgpu.wasm',
		vramRequiredMB: 5106.67,
		lowResourceRequired: false,
	},
	{
		id: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
		lib: 'Qwen2-7B-Instruct-q4f32_1_cs1k-webgpu.wasm',
		vramRequiredMB: 5900.09,
		lowResourceRequired: false,
	},
];

let current = null;
const listeners = new Set();

/**
 * Subscribe to model source changes.
 *
 * @param {Function} listener Called after the source is saved.
 * @return {Function} Unsubscribe function.
 */
export function subscribe( listener ) {
	listeners.add( listener );
	return () => listeners.delete( listener );
}

/**
 * Ensure a URL ends with a slash.
 *
 * @param {string} url URL.
 * @return {string} URL with trailing slash, or '' when empty.
 */
function withSlash( url ) {
	const trimmed = ( url || '' ).trim();
	if ( ! trimmed ) {
		return '';
	}
	return trimmed.endsWith( '/' ) ? trimmed : `${ trimmed }/`;
}

/**
 * Get the configured model source.
 *
 * @return {{weights_url: string, library_url: string}} Model source.
 */
export function getModelSource() {
	if ( ! current ) {
		const fromPage = window.agenticAdmin?.settings?.modelSource || {};
		current = {
			weights_url: withSlash( fromPage.weights_url ),
			library_url: withSlash( fromPage.library_url ),
		};
	}
	return current;
}

/**
 * Replace the in-memory model source after the owner saves Settings.
 *
 * @param {{weights_url: string, library_url: string}} source New source.
 */
export function setModelSource( source ) {
	current = {
		weights_url: withSlash( source?.weights_url ),
		library_url: withSlash( source?.library_url ),
	};
	listeners.forEach( ( listener ) => listener( current ) );
}

/**
 * Whether both model source addresses are set.
 *
 * @param {Object} [source] Source to check (defaults to the current one).
 * @return {boolean} True when the local engine can download models.
 */
export function isModelSourceConfigured( source = getModelSource() ) {
	return Boolean( source.weights_url && source.library_url );
}

/**
 * Build the WebLLM app config from the model source.
 *
 * @param {string} modelVersion WebLLM model library version (webllm.modelVersion).
 * @param {Object} [source]     Source to use (defaults to the current one).
 * @return {Object} WebLLM AppConfig.
 */
export function buildAppConfig( modelVersion, source = getModelSource() ) {
	return {
		useIndexedDBCache: false,
		model_list: MODEL_RECORDS.map( ( record ) => ( {
			model: `${ source.weights_url }${ record.id }`,
			model_id: record.id,
			model_lib: `${ source.library_url }${ modelVersion }/${ record.lib }`,
			vram_required_MB: record.vramRequiredMB,
			low_resource_required: record.lowResourceRequired,
			overrides: {
				context_window_size: 4096,
				...( record.maxHistorySize && {
					max_history_size: record.maxHistorySize,
				} ),
			},
		} ) ),
	};
}
