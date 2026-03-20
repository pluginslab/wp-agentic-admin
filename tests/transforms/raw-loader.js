/**
 * Jest transform for raw file imports (.md files).
 *
 * Mirrors webpack's asset/source behavior — exports the file content
 * as a default string. Used for instruction markdown files.
 */

module.exports = {
	process( sourceText ) {
		return {
			code: `module.exports = ${ JSON.stringify( sourceText ) };`,
		};
	},
};
