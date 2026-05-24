/**
 * MessageItem Component
 *
 * Renders a single message in the chat interface using @wordpress/components
 * primitives. Each message type renders as a Card; tool/thinking/result
 * cards collapse via a Button toggle. The original Perplexity-style vertical
 * timeline has been retired in favor of a leading icon column inside each
 * Card, which matches WP-native admin conventions.
 */

import { useState } from '@wordpress/element';
import {
	Button,
	Card,
	CardBody,
	CardHeader,
	Icon,
	Notice,
	Spinner,
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import {
	cog,
	check,
	info,
	warning,
	cancelCircleFilled,
	chevronDown,
	chevronUp,
	copySmall,
} from '@wordpress/icons';
import AbilityPicker from './AbilityPicker';
import FileView from './FileView';
import { createLogger } from '../utils/logger';

const log = createLogger( 'MessageItem' );

const MessageType = {
	USER: 'user',
	ASSISTANT: 'assistant',
	SYSTEM: 'system',
	ABILITY_REQUEST: 'ability_request',
	ABILITY_RESULT: 'ability_result',
	ERROR: 'error',
	FILE_VIEW: 'file_view',
};

const INVERSE_ACTIONS = {
	'wp-agentic-admin/plugin-activate': {
		action: 'wp-agentic-admin/plugin-deactivate',
		button_label: 'Deactivate',
	},
	'wp-agentic-admin/plugin-deactivate': {
		action: 'wp-agentic-admin/plugin-activate',
		button_label: 'Activate',
	},
};

const ActionButton = ( { action, onAction } ) => {
	const [ override, setOverride ] = useState( null );
	const [ loading, setLoading ] = useState( false );
	const current = override ? { ...action, ...override } : action;

	const handleClick = async () => {
		setLoading( true );
		try {
			const result = await onAction( current.action, current.args );
			if ( result && result.success !== false && ! result.error ) {
				const inverse = INVERSE_ACTIONS[ current.action ];
				if ( inverse ) {
					setOverride( inverse );
				}
			}
		} finally {
			setLoading( false );
		}
	};

	return (
		<HStack justify="space-between" spacing={ 2 }>
			<span>{ current.label }</span>
			<Button
				variant="secondary"
				onClick={ handleClick }
				disabled={ loading }
				isBusy={ loading }
			>
				{ loading ? '…' : current.button_label }
			</Button>
		</HStack>
	);
};

const formatTime = ( timestamp ) => {
	const date = new Date( timestamp );
	return date.toLocaleTimeString( [], {
		hour: '2-digit',
		minute: '2-digit',
	} );
};

const parseMarkdown = ( text ) => {
	if ( ! text ) {
		return null;
	}

	const parts = [];
	let remaining = text;
	let keyIndex = 0;

	while ( remaining.length > 0 ) {
		const boldMatch = remaining.match( /^\*\*(.+?)\*\*/ );
		if ( boldMatch ) {
			parts.push(
				<strong key={ keyIndex++ }>
					{ parseMarkdown( boldMatch[ 1 ] ) }
				</strong>
			);
			remaining = remaining.slice( boldMatch[ 0 ].length );
			continue;
		}

		const codeMatch = remaining.match( /^`(.+?)`/ );
		if ( codeMatch ) {
			parts.push( <code key={ keyIndex++ }>{ codeMatch[ 1 ] }</code> );
			remaining = remaining.slice( codeMatch[ 0 ].length );
			continue;
		}

		const nextSpecial = remaining.search( /\*\*|`/ );
		if ( nextSpecial === -1 ) {
			parts.push( remaining );
			break;
		} else if ( nextSpecial === 0 ) {
			parts.push( remaining[ 0 ] );
			remaining = remaining.slice( 1 );
		} else {
			parts.push( remaining.slice( 0, nextSpecial ) );
			remaining = remaining.slice( nextSpecial );
		}
	}

	return parts;
};

const isTableSeparator = ( line ) => /^\|[\s\-:|]+\|$/.test( line.trim() );

const parseTable = ( lines, keyIndex ) => {
	const parseRow = ( line ) =>
		line
			.split( '|' )
			.slice( 1, -1 )
			.map( ( cell ) => cell.trim() );

	const headerCells = parseRow( lines[ 0 ] );
	const bodyLines = lines.filter(
		( line, i ) => i > 0 && ! isTableSeparator( line )
	);

	return (
		<table key={ `table-${ keyIndex }` } className="wp-agentic-admin-md-table">
			<thead>
				<tr>
					{ headerCells.map( ( cell, i ) => (
						<th key={ i }>{ parseMarkdown( cell ) }</th>
					) ) }
				</tr>
			</thead>
			<tbody>
				{ bodyLines.map( ( line, rowIdx ) => {
					const cells = parseRow( line );
					return (
						<tr key={ rowIdx }>
							{ cells.map( ( cell, i ) => (
								<td key={ i }>{ parseMarkdown( cell ) }</td>
							) ) }
						</tr>
					);
				} ) }
			</tbody>
		</table>
	);
};

const parseContentBlocks = ( content ) => {
	if ( ! content ) {
		return null;
	}

	const lines = content.split( '\n' );
	const elements = [];
	let tableBuffer = [];
	let keyIndex = 0;

	const flushTable = () => {
		if ( tableBuffer.length >= 2 ) {
			elements.push( parseTable( tableBuffer, keyIndex++ ) );
		} else {
			tableBuffer.forEach( ( line ) => {
				elements.push(
					<p key={ keyIndex++ }>{ parseMarkdown( line ) }</p>
				);
			} );
		}
		tableBuffer = [];
	};

	for ( const line of lines ) {
		const trimmed = line.trim();
		if ( trimmed.startsWith( '|' ) && trimmed.endsWith( '|' ) ) {
			tableBuffer.push( trimmed );
		} else {
			if ( tableBuffer.length > 0 ) {
				flushTable();
			}
			if ( trimmed === '' ) {
				continue;
			}
			elements.push(
				<p key={ keyIndex++ }>{ parseMarkdown( trimmed ) }</p>
			);
		}
	}

	if ( tableBuffer.length > 0 ) {
		flushTable();
	}

	return elements;
};

const formatAbilityResult = ( result ) => {
	if ( typeof result === 'string' ) {
		return result;
	}
	return JSON.stringify( result, null, 2 );
};

const getAbilityLabel = ( abilityId ) => {
	const labels = {
		'wp-agentic-admin/error-log-read': 'Reading error log',
		'wp-agentic-admin/site-health': 'Checking site health',
		'wp-agentic-admin/plugin-list': 'Listing plugins',
		'wp-agentic-admin/cache-flush': 'Flushing cache',
		'wp-agentic-admin/db-optimize': 'Optimizing database',
		'wp-agentic-admin/plugin-deactivate': 'Deactivating plugin',
	};
	return labels[ abilityId ] || abilityId;
};

/**
 * A collapsible Card with a Button header. Used for tool calls,
 * tool results, and thinking blocks.
 */
const CollapsibleCard = ( {
	icon,
	label,
	suffix,
	defaultExpanded = false,
	forceExpanded = false,
	children,
} ) => {
	const [ expanded, setExpanded ] = useState( defaultExpanded );
	const isOpen = forceExpanded || expanded;

	return (
		<Card size="small">
			<CardHeader>
				<Button
					onClick={ () => setExpanded( ! expanded ) }
					aria-expanded={ isOpen }
				>
					<HStack alignment="center" spacing={ 2 }>
						{ icon && <Icon icon={ icon } size={ 16 } /> }
						<strong>{ label }</strong>
						{ suffix && <span>{ suffix }</span> }
						<Icon
							icon={ isOpen ? chevronUp : chevronDown }
							size={ 16 }
						/>
					</HStack>
				</Button>
			</CardHeader>
			{ isOpen && <CardBody>{ children }</CardBody> }
		</Card>
	);
};

const MessageItem = ( { message, onAction } ) => {
	const { type, content, timestamp, prefillTps, decodeTps } = message;
	const [ copied, setCopied ] = useState( false );

	const handleCopy = async () => {
		try {
			const plainText = content
				.replace( /\*\*(.+?)\*\*/g, '$1' )
				.replace( /`(.+?)`/g, '$1' );
			await navigator.clipboard.writeText( plainText );
			setCopied( true );
			setTimeout( () => setCopied( false ), 2000 );
		} catch ( err ) {
			log.error( 'Failed to copy:', err );
		}
	};

	const meta = message.meta || {
		abilityId: message.abilityName,
		result: message.result,
		success: message.success,
		error: message.error,
		params: message.input,
	};

	// User message — right-aligned with a primary-tinted Card
	if ( type === MessageType.USER ) {
		return (
			<HStack justify="flex-end">
				<Card
					size="small"
					className="wp-agentic-admin-msg wp-agentic-admin-msg--user"
				>
					<CardBody>
						<p>{ content }</p>
						<small>{ formatTime( timestamp ) }</small>
					</CardBody>
				</Card>
			</HStack>
		);
	}

	// Thinking block — collapsible, expanded while streaming
	if ( type === 'thinking' ) {
		const thinkingIsStreaming = message.isStreaming;

		return (
			<CollapsibleCard
				icon={ cog }
				label={
					thinkingIsStreaming ? 'Thinking…' : 'Thought process'
				}
				forceExpanded={ thinkingIsStreaming }
			>
				<p>
					{ content }
					{ thinkingIsStreaming && '▊' }
				</p>
			</CollapsibleCard>
		);
	}

	// Loading indicator (inline)
	if ( type === 'loading' ) {
		return (
			<HStack alignment="center" spacing={ 2 } role="status">
				<Spinner />
				<span>{ content }</span>
			</HStack>
		);
	}

	// System / welcome message — renders parsed markdown structure
	if ( type === MessageType.SYSTEM ) {
		const lines = content.split( '\n' );
		const elements = [];
		let listItems = [];
		let keyIndex = 0;

		const flushListItems = () => {
			if ( listItems.length > 0 ) {
				elements.push(
					<ul key={ `ul-${ keyIndex++ }` }>
						{ listItems.map( ( item, i ) => (
							<li key={ i }>{ item }</li>
						) ) }
					</ul>
				);
				listItems = [];
			}
		};

		lines.forEach( ( line ) => {
			if ( line.startsWith( '**' ) && line.endsWith( '**' ) ) {
				flushListItems();
				elements.push(
					<h3 key={ keyIndex++ }>
						{ line.replace( /\*\*/g, '' ) }
					</h3>
				);
			} else if ( line.startsWith( '- ' ) ) {
				listItems.push( line.substring( 2 ) );
			} else if ( line.startsWith( '*' ) && line.endsWith( '*' ) ) {
				flushListItems();
				elements.push(
					<p key={ keyIndex++ }>
						<em>{ line.replace( /\*/g, '' ) }</em>
					</p>
				);
			} else if ( line.trim() !== '' ) {
				flushListItems();
				elements.push( <p key={ keyIndex++ }>{ line }</p> );
			}
		} );

		flushListItems();

		return (
			<Card size="small">
				<CardBody>{ elements }</CardBody>
			</Card>
		);
	}

	// Assistant message — Card with text + optional action buttons + footer
	if ( type === MessageType.ASSISTANT ) {
		const hasAbilityCall = content.includes( '<ability' );
		let displayContent = content;
		if ( hasAbilityCall ) {
			displayContent = content
				.replace( /<ability[^>]*>[\s\S]*?<\/ability>/g, '' )
				.trim();
		}

		const messageActions = message.actions;

		return (
			<Card size="small">
				<CardBody>
					<VStack spacing={ 3 }>
						{ displayContent && (
							<div>{ parseContentBlocks( displayContent ) }</div>
						) }
						{ messageActions?.length > 0 && onAction && (
							<VStack spacing={ 2 }>
								{ messageActions.map( ( action ) => (
									<ActionButton
										key={ `${ action.action }-${ JSON.stringify(
											action.args
										) }` }
										action={ action }
										onAction={ onAction }
									/>
								) ) }
							</VStack>
						) }
						<HStack justify="space-between" spacing={ 2 }>
							<small>
								{ formatTime( timestamp ) }
								{ decodeTps &&
									( prefillTps
										? ` · PS ${ prefillTps } t/s · GS ${ decodeTps } t/s`
										: ` · GS ${ decodeTps } t/s` ) }
							</small>
							<Button
								size="small"
								variant="tertiary"
								icon={ copied ? check : copySmall }
								label={
									copied ? 'Copied!' : 'Copy to clipboard'
								}
								showTooltip
								onClick={ handleCopy }
							/>
						</HStack>
					</VStack>
				</CardBody>
			</Card>
		);
	}

	// Ability request — compact card with spinner while running
	if ( type === MessageType.ABILITY_REQUEST ) {
		return (
			<Card size="small">
				<CardBody>
					<HStack alignment="center" spacing={ 2 }>
						<Icon icon={ cog } size={ 16 } />
						<strong>{ getAbilityLabel( meta?.abilityId ) }</strong>
						<Spinner />
						<small>{ meta?.abilityId }</small>
					</HStack>
				</CardBody>
			</Card>
		);
	}

	// Ability result — collapsible card with status icon + payload
	if ( type === MessageType.ABILITY_RESULT ) {
		const resultStatus =
			meta?.success === false ||
			( meta?.success === undefined &&
				( meta?.result?.success === false || meta?.result?.error ) )
				? 'info'
				: 'success';

		const statusLabel = {
			success: 'Task completed successfully',
			info: 'Finished processing but could not perform the task',
			error: 'Failed',
		};

		const statusIcon = {
			success: check,
			info,
			error: cancelCircleFilled,
		};

		return (
			<CollapsibleCard
				icon={ statusIcon[ resultStatus ] }
				label={ statusLabel[ resultStatus ] }
				suffix={ meta?.abilityId }
			>
				<pre>{ formatAbilityResult( meta?.result ) }</pre>
			</CollapsibleCard>
		);
	}

	// File view — pass-through to FileView (which already uses Card)
	if ( type === MessageType.FILE_VIEW ) {
		const file = message.meta?.file || message.file;
		return <FileView file={ file } />;
	}

	// Error message — Notice
	if ( type === MessageType.ERROR ) {
		return (
			<Notice status="error" isDismissible={ false }>
				<Icon icon={ warning } size={ 16 } />
				<span> { content }</span>
			</Notice>
		);
	}

	// Ability picker — pass-through to AbilityPicker (already uses primitives)
	if ( type === 'ability_picker' ) {
		return (
			<AbilityPicker
				abilities={ message.abilities || [] }
				workflows={ message.workflows || [] }
				onExecute={ message.onExecute }
				isProcessing={ message.isProcessing }
			/>
		);
	}

	// Default fallback
	return (
		<Card size="small">
			<CardBody>
				<p>{ content }</p>
			</CardBody>
		</Card>
	);
};

export default MessageItem;
