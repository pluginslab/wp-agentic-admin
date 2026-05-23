/**
 * AbilityPicker Component
 *
 * Renders a numbered list of all registered abilities and workflows as
 * clickable buttons. Triggered by the /tools slash command in chat.
 * Abilities with parseIntent get an inline text input for arguments.
 */

import { useState } from '@wordpress/element';
import {
	Button,
	TextControl,
	__experimentalVStack as VStack,
	__experimentalHStack as HStack,
} from '@wordpress/components';

const AbilityPicker = ( { abilities, workflows, onExecute, isProcessing } ) => {
	const [ expandedId, setExpandedId ] = useState( null );
	const [ argsText, setArgsText ] = useState( '' );

	const acceptsArgs = ( tool ) => {
		if ( typeof tool.parseIntent === 'function' ) {
			return true;
		}
		const schema =
			window.wpAgenticAdmin?.abilities?.[ tool.id ]?.input_schema;
		return !! ( schema && Object.keys( schema ).length > 0 );
	};

	const handleClick = ( tool ) => {
		if ( acceptsArgs( tool ) ) {
			if ( expandedId === tool.id ) {
				setExpandedId( null );
				setArgsText( '' );
			} else {
				setExpandedId( tool.id );
				setArgsText( '' );
			}
		} else {
			onExecute( tool.id );
		}
	};

	const handleRun = ( id ) => {
		onExecute( id, argsText.trim() );
		setExpandedId( null );
		setArgsText( '' );
	};

	const renderItem = ( tool ) => (
		<li key={ tool.id }>
			<VStack spacing={ 2 }>
				<Button
					variant={
						expandedId === tool.id ? 'primary' : 'secondary'
					}
					onClick={ () => handleClick( tool ) }
					disabled={ isProcessing }
				>
					{ tool.label || tool.id }
				</Button>
				{ expandedId === tool.id && (
					<HStack spacing={ 2 }>
						<TextControl
							__nextHasNoMarginBottom
							placeholder="Add arguments (optional)…"
							value={ argsText }
							onChange={ setArgsText }
							onKeyDown={ ( e ) => {
								if ( e.key === 'Enter' ) {
									e.preventDefault();
									handleRun( tool.id );
								}
							} }
							disabled={ isProcessing }
						/>
						<Button
							variant="primary"
							onClick={ () => handleRun( tool.id ) }
							disabled={ isProcessing }
						>
							Run
						</Button>
					</HStack>
				) }
			</VStack>
		</li>
	);

	const renderSection = ( title, items ) =>
		items.length > 0 && (
			<VStack spacing={ 2 }>
				<strong>{ title }</strong>
				<ol className="wp-agentic-admin-ability-picker-list">
					{ items.map( renderItem ) }
				</ol>
			</VStack>
		);

	if ( abilities.length === 0 && workflows.length === 0 ) {
		return <p>No abilities or workflows registered.</p>;
	}

	return (
		<VStack spacing={ 4 }>
			{ renderSection( 'Abilities', abilities ) }
			{ renderSection( 'Workflows', workflows ) }
		</VStack>
	);
};

export default AbilityPicker;
