/**
 * FileView component
 *
 * Renders file contents from abilities like read-file as a structured block
 * (header pill with path, line range, redacted badge, copy-raw button) +
 * a monospace code body. Bypasses the chat's paragraph-only markdown renderer.
 */

import { useState } from '@wordpress/element';
import { createLogger } from '../utils/logger';

const log = createLogger( 'FileView' );

const FileView = ( { file } ) => {
	const [ copied, setCopied ] = useState( false );

	if ( ! file || typeof file.content !== 'string' ) {
		return null;
	}

	const {
		filePath = '',
		content = '',
		language = '',
		totalLines = 0,
		linesReturned = 0,
		wasRedacted = false,
	} = file;

	const showRange =
		totalLines > 0 && linesReturned > 0 && totalLines !== linesReturned;

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText( content );
			setCopied( true );
			setTimeout( () => setCopied( false ), 1500 );
		} catch ( err ) {
			log.error( 'Failed to copy file content:', err );
		}
	};

	return (
		<div className="agentic-file-view">
			<div className="agentic-file-view__header">
				<code className="agentic-file-view__path">{ filePath }</code>
				{ showRange && (
					<span className="agentic-file-view__meta">
						{ linesReturned } / { totalLines } lines
					</span>
				) }
				{ wasRedacted && (
					<span
						className="agentic-file-view__badge"
						title="Sensitive values (credentials, keys, salts) were replaced server-side."
					>
						redacted
					</span>
				) }
				<button
					type="button"
					className={ `agentic-file-view__copy${
						copied ? ' agentic-file-view__copy--copied' : ''
					}` }
					onClick={ handleCopy }
					title={ copied ? 'Copied!' : 'Copy file content' }
				>
					{ copied ? 'Copied' : 'Copy' }
				</button>
			</div>
			<pre className="agentic-file-view__body">
				<code className={ language ? `language-${ language }` : '' }>
					{ content }
				</code>
			</pre>
		</div>
	);
};

export default FileView;
