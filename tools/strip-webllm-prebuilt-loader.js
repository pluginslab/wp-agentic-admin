/**
 * Webpack loader: strip WebLLM's built-in model download addresses.
 *
 * WebLLM ships a default app config listing ~140 models, each with a
 * Hugging Face weights URL and a GitHub model-library URL. Agentic Admin
 * never uses it: the site owner configures the model source in Settings,
 * and the plugin builds its own app config from that (see
 * src/extensions/services/model-source.js). This loader empties the default
 * list and the model-library URL prefix so the built plugin contains no
 * hard-coded model download addresses.
 *
 * The build fails if the expected code is not found, so a WebLLM upgrade
 * cannot silently bring the addresses back.
 */

const PREFIX_PATTERN = /const modelLibURLPrefix = "https:\/\/[^"]*";/;
const LIST_START = 'const prebuiltAppConfig = {';

module.exports = function stripWebllmPrebuilt( source ) {
	if ( ! PREFIX_PATTERN.test( source ) ) {
		throw new Error(
			'strip-webllm-prebuilt-loader: modelLibURLPrefix not found. Check the WebLLM version.'
		);
	}
	let out = source.replace( PREFIX_PATTERN, 'const modelLibURLPrefix = "";' );

	const start = out.indexOf( LIST_START );
	const listOpen = out.indexOf( 'model_list: [', start );
	if ( start === -1 || listOpen === -1 ) {
		throw new Error(
			'strip-webllm-prebuilt-loader: prebuiltAppConfig.model_list not found. Check the WebLLM version.'
		);
	}

	// Find the matching closing bracket of model_list.
	const bodyStart = listOpen + 'model_list: ['.length;
	let depth = 1;
	let i = bodyStart;
	let inString = null;
	for ( ; i < out.length && depth > 0; i++ ) {
		const ch = out[ i ];
		if ( inString ) {
			if ( ch === '\\' ) {
				i++;
			} else if ( ch === inString ) {
				inString = null;
			}
			continue;
		}
		if ( ch === '"' || ch === "'" || ch === '`' ) {
			inString = ch;
		} else if ( ch === '/' && out[ i + 1 ] === '/' ) {
			i = out.indexOf( '\n', i );
		} else if ( ch === '[' ) {
			depth++;
		} else if ( ch === ']' ) {
			depth--;
		}
	}
	if ( depth !== 0 ) {
		throw new Error(
			'strip-webllm-prebuilt-loader: could not find the end of model_list.'
		);
	}

	out = out.slice( 0, bodyStart ) + out.slice( i - 1 );

	// Only string literals matter; URLs in comments are removed by the minifier.
	if (
		/["'`]https:\/\/(huggingface\.co|raw\.githubusercontent\.com)/.test(
			out
		)
	) {
		throw new Error(
			'strip-webllm-prebuilt-loader: model download addresses remain after stripping.'
		);
	}

	return out;
};
