/**
 * FileView component
 *
 * Renders file contents from abilities like read-file as a structured block
 * (header pill with path, line range, redacted badge, copy-raw button) +
 * a monospace code body. Bypasses the chat's paragraph-only markdown renderer.
 */

import { useState } from '@wordpress/element';
import {
	Button,
	Card,
	CardHeader,
	CardBody,
	__experimentalHStack as HStack,
} from '@wordpress/components';
import { copySmall, check } from '@wordpress/icons';
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
		<Card size="small">
			<CardHeader>
				<HStack alignment="left" spacing={ 2 }>
					<code>{ filePath }</code>
					{ showRange && (
						<span>
							{ linesReturned } / { totalLines } lines
						</span>
					) }
					{ wasRedacted && (
						<span title="Sensitive values (credentials, keys, salts) were replaced server-side.">
							redacted
						</span>
					) }
					<Button
						size="small"
						variant="secondary"
						icon={ copied ? check : copySmall }
						label={ copied ? 'Copied!' : 'Copy file content' }
						showTooltip
						onClick={ handleCopy }
					/>
				</HStack>
			</CardHeader>
			<CardBody>
				<pre className="wp-agentic-admin-file-view-body">
					<code
						className={ language ? `language-${ language }` : '' }
					>
						{ content }
					</code>
				</pre>
			</CardBody>
		</Card>
	);
};

export default FileView;
