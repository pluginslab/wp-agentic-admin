/**
 * AbilityBrowser Component
 *
 * Manual ability testing interface - browse and execute abilities directly.
 *
 */

import { useState, useEffect } from '@wordpress/element';
import { Spinner } from '@wordpress/components';
import abilitiesApi from '../services/abilities-api';

/**
 * AbilityCard component - displays a single ability
 *
 * @param {Object}   props             - Component props
 * @param {Object}   props.ability     - Ability object
 * @param {Function} props.onExecute   - Callback when execute is clicked
 * @param {boolean}  props.isExecuting - Whether this ability is currently executing
 * @return {JSX.Element} Rendered ability card
 */
const AbilityCard = ( { ability, onExecute, isExecuting } ) => {
	const [ inputJson, setInputJson ] = useState( '{}' );
	const [ showInput, setShowInput ] = useState( false );
	const [ inputError, setInputError ] = useState( null );

	const isDestructive = ability.meta?.annotations?.destructive;
	const hasInputSchema =
		ability.input_schema?.properties &&
		Object.keys( ability.input_schema.properties ).length > 0;

	/**
	 * Handle execute button click
	 */
	const handleExecute = () => {
		setInputError( null );

		let parsedInput = {};
		if ( showInput && inputJson.trim() ) {
			try {
				parsedInput = JSON.parse( inputJson );
			} catch ( e ) {
				setInputError( 'Invalid JSON: ' + e.message );
				return;
			}
		}

		// For destructive abilities, confirm first
		if ( isDestructive ) {
			// eslint-disable-next-line no-alert -- intentional confirmation for destructive abilities
			const confirmed = window.confirm(
				`This ability is marked as DESTRUCTIVE.\n\nAbility: ${ ability.label }\n\nAre you sure you want to execute it?`
			);
			if ( ! confirmed ) {
				return;
			}
		}

		onExecute( ability, parsedInput );
	};

	/**
	 * Render input schema as helpful hints
	 */
	const renderSchemaHints = () => {
		if ( ! ability.input_schema?.properties ) {
			return null;
		}

		const props = ability.input_schema.properties;
		return (
			<div className="wp-agentic-admin-ability-card__schema">
				<small>Parameters:</small>
				<ul>
					{ Object.entries( props ).map( ( [ key, schema ] ) => (
						<li key={ key }>
							<code>{ key }</code>
							{ schema.type && <span> ({ schema.type })</span> }
							{ schema.default !== undefined && (
								<span>
									{ ' ' }
									= { JSON.stringify( schema.default ) }
								</span>
							) }
							{ schema.description && (
								<span> - { schema.description }</span>
							) }
						</li>
					) ) }
				</ul>
			</div>
		);
	};

	return (
		<div
			className={ `wp-agentic-admin-ability-card ${
				isDestructive
					? 'wp-agentic-admin-ability-card--destructive'
					: ''
			}` }
		>
			<div className="wp-agentic-admin-ability-card__header">
				<h4>{ ability.label }</h4>
				{ isDestructive && (
					<span className="wp-agentic-admin-badge wp-agentic-admin-badge--warning">
						Destructive
					</span>
				) }
			</div>

			<p className="wp-agentic-admin-ability-card__description">
				{ ability.description }
			</p>

			<div className="wp-agentic-admin-ability-card__id">
				<code>{ ability.name }</code>
			</div>

			{ hasInputSchema && (
				<>
					<button
						type="button"
						className="button button-link wp-agentic-admin-ability-card__toggle"
						onClick={ () => setShowInput( ! showInput ) }
					>
						{ showInput ? 'Hide parameters' : 'Show parameters' }
					</button>

					{ showInput && (
						<div className="wp-agentic-admin-ability-card__input">
							{ renderSchemaHints() }
							<textarea
								value={ inputJson }
								onChange={ ( e ) =>
									setInputJson( e.target.value )
								}
								placeholder='{"param": "value"}'
								rows="3"
							/>
							{ inputError && (
								<div className="wp-agentic-admin-ability-card__error">
									{ inputError }
								</div>
							) }
						</div>
					) }
				</>
			) }

			<div className="wp-agentic-admin-ability-card__actions">
				<button
					type="button"
					className={ `button ${
						isDestructive ? 'button-link-delete' : 'button-primary'
					}` }
					onClick={ handleExecute }
					disabled={ isExecuting }
				>
					{ isExecuting ? (
						<>
							<Spinner /> Executing...
						</>
					) : (
						'Execute'
					) }
				</button>
			</div>
		</div>
	);
};

/**
 * ResultPanel component - displays execution results
 *
 * @param {Object}   props         - Component props
 * @param {Object}   props.result  - Execution result
 * @param {Function} props.onClear - Callback to clear results
 * @return {JSX.Element} Rendered result panel
 */
const ResultPanel = ( { result, onClear } ) => {
	if ( ! result ) {
		return null;
	}

	const isError = result.error;

	return (
		<div
			className={ `wp-agentic-admin-result-panel ${
				isError
					? 'wp-agentic-admin-result-panel--error'
					: 'wp-agentic-admin-result-panel--success'
			}` }
		>
			<div className="wp-agentic-admin-result-panel__header">
				<h4>
					<span
						className={ `dashicons ${
							isError ? 'dashicons-warning' : 'dashicons-yes-alt'
						}` }
					/>
					{ isError ? 'Execution Failed' : 'Execution Successful' }
				</h4>
				<button
					type="button"
					className="button button-link"
					onClick={ onClear }
				>
					Clear
				</button>
			</div>
			<div className="wp-agentic-admin-result-panel__content">
				<pre>{ JSON.stringify( result.data || result, null, 2 ) }</pre>
			</div>
		</div>
	);
};

/**
 * AbilityBrowser component
 *
 * @return {JSX.Element} Rendered ability browser
 */
const AbilityBrowser = () => {
	const [ abilities, setAbilities ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ executingAbility, setExecutingAbility ] = useState( null );
	const [ lastResult, setLastResult ] = useState( null );

	/**
	 * Load abilities on mount
	 */
	useEffect( () => {
		loadAbilities();
	}, [] );

	/**
	 * Fetch abilities from the API
	 */
	const loadAbilities = async () => {
		setIsLoading( true );
		setError( null );

		try {
			const data = await abilitiesApi.listAbilities();
			const all = Array.isArray( data ) ? data : [];

			// Show only our own abilities (wp-agentic-admin/* and core/*)
			const filtered = all.filter(
				( a ) =>
					a.name?.startsWith( 'wp-agentic-admin/' ) ||
					a.name?.startsWith( 'core/' )
			);

			setAbilities( filtered.length > 0 ? filtered : all );
		} catch ( err ) {
			setError( err.message || 'Failed to load abilities' );
		} finally {
			setIsLoading( false );
		}
	};

	/**
	 * Execute an ability
	 *
	 * @param {Object} ability - Ability to execute
	 * @param {Object} input   - Input parameters
	 */
	const handleExecute = async ( ability, input ) => {
		setExecutingAbility( ability.name );
		setLastResult( null );

		try {
			const result = await abilitiesApi.executeAbilityById(
				ability.name,
				input
			);
			setLastResult( { data: result, ability: ability.name } );
		} catch ( err ) {
			setLastResult( {
				error: true,
				data: { error: err.message },
				ability: ability.name,
			} );
		} finally {
			setExecutingAbility( null );
		}
	};

	/**
	 * Clear the result panel
	 */
	const handleClearResult = () => {
		setLastResult( null );
	};

	// Loading state
	if ( isLoading ) {
		return (
			<div className="wp-agentic-admin-ability-browser wp-agentic-admin-ability-browser--loading">
				<Spinner />
				<p>Loading abilities...</p>
			</div>
		);
	}

	// Error state
	if ( error ) {
		return (
			<div className="wp-agentic-admin-ability-browser wp-agentic-admin-ability-browser--error">
				<div className="notice notice-error">
					<p>{ error }</p>
				</div>
				<button
					type="button"
					className="button"
					onClick={ loadAbilities }
				>
					Retry
				</button>
			</div>
		);
	}

	// Empty state
	if ( abilities.length === 0 ) {
		return (
			<div className="wp-agentic-admin-ability-browser wp-agentic-admin-ability-browser--empty">
				<div className="notice notice-warning">
					<p>
						No abilities found. Make sure the Abilities API plugin
						is active and abilities are registered.
					</p>
				</div>
				<button
					type="button"
					className="button"
					onClick={ loadAbilities }
				>
					Refresh
				</button>
			</div>
		);
	}

	return (
		<div className="wp-agentic-admin-ability-browser">
			<div className="wp-agentic-admin-ability-browser__header">
				<h3>Available Abilities</h3>
				<p className="description">
					Test abilities manually by clicking Execute. Includes
					WordPress core and Agentic Admin abilities.
				</p>
				<button
					type="button"
					className="button"
					onClick={ loadAbilities }
				>
					Refresh
				</button>
			</div>

			<ResultPanel result={ lastResult } onClear={ handleClearResult } />

			<div className="wp-agentic-admin-ability-browser__grid">
				{ abilities.map( ( ability ) => (
					<AbilityCard
						key={ ability.name }
						ability={ ability }
						onExecute={ handleExecute }
						isExecuting={ executingAbility === ability.name }
					/>
				) ) }
			</div>
		</div>
	);
};

export default AbilityBrowser;
