/**
 * AbilityPicker Component
 *
 * Renders a numbered list of all registered abilities and workflows as clickable buttons.
 * Triggered by the /tools slash command in chat.
 * Abilities with parseIntent get an inline text input for arguments.
 */

import { useState } from '@wordpress/element';

const AbilityPicker = ( { abilities, workflows, onExecute, isProcessing } ) => {
	const [ expandedId, setExpandedId ] = useState( null );
	const [ argsText, setArgsText ] = useState( '' );

	/**
	 * Check if an ability accepts arguments (has parseIntent or input_schema).
	 *
	 * @param {Object} tool - The ability or workflow object.
	 * @return {boolean} True if the tool accepts arguments.
	 */
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

	const handleSubmit = ( e, id ) => {
		e.preventDefault();
		onExecute( id, argsText.trim() );
		setExpandedId( null );
		setArgsText( '' );
	};

	const handleKeyDown = ( e, id ) => {
		if ( e.key === 'Enter' ) {
			e.preventDefault();
			onExecute( id, argsText.trim() );
			setExpandedId( null );
			setArgsText( '' );
		}
	};

	const renderItem = ( tool ) => (
		<li key={ tool.id } className="agentic-ability-picker__item">
			<button
				className={ `agentic-ability-picker__button${
					expandedId === tool.id
						? ' agentic-ability-picker__button--expanded'
						: ''
				}` }
				onClick={ () => handleClick( tool ) }
				disabled={ isProcessing }
				type="button"
			>
				{ tool.label || tool.id }
			</button>
			{ expandedId === tool.id && (
				<form
					className="agentic-ability-picker__input-row"
					onSubmit={ ( e ) => handleSubmit( e, tool.id ) }
				>
					<input
						type="text"
						className="agentic-ability-picker__args-input"
						placeholder="Add arguments (optional)..."
						value={ argsText }
						onChange={ ( e ) => setArgsText( e.target.value ) }
						onKeyDown={ ( e ) => handleKeyDown( e, tool.id ) }
						disabled={ isProcessing }
					/>
					<button
						type="submit"
						className="agentic-ability-picker__run-button"
						disabled={ isProcessing }
					>
						Run
					</button>
				</form>
			) }
		</li>
	);

	return (
		<div className="agentic-ability-picker">
			{ abilities.length > 0 && (
				<>
					<div className="agentic-ability-picker__section-label">
						Abilities
					</div>
					<ol className="agentic-ability-picker__list">
						{ abilities.map( renderItem ) }
					</ol>
				</>
			) }
			{ workflows.length > 0 && (
				<>
					<div className="agentic-ability-picker__section-label">
						Workflows
					</div>
					<ol className="agentic-ability-picker__list">
						{ workflows.map( renderItem ) }
					</ol>
				</>
			) }
			{ abilities.length === 0 && workflows.length === 0 && (
				<p className="agentic-ability-picker__empty">
					No abilities or workflows registered.
				</p>
			) }
		</div>
	);
};

export default AbilityPicker;
