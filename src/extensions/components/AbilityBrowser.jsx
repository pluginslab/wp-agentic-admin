/**
 * AbilityBrowser Component
 *
 * Manual ability testing interface - browse and execute abilities directly.
 */

import { useState, useEffect } from '@wordpress/element';
import {
	Button,
	Card,
	CardHeader,
	CardBody,
	CardFooter,
	Notice,
	Spinner,
	TextareaControl,
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import abilitiesApi from '../services/abilities-api';

const AbilityCard = ( { ability, onExecute, isExecuting } ) => {
	const [ inputJson, setInputJson ] = useState( '{}' );
	const [ showInput, setShowInput ] = useState( false );
	const [ inputError, setInputError ] = useState( null );

	const isDestructive = ability.meta?.annotations?.destructive;
	const hasInputSchema =
		ability.input_schema?.properties &&
		Object.keys( ability.input_schema.properties ).length > 0;

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

	const renderSchemaHints = () => {
		if ( ! ability.input_schema?.properties ) {
			return null;
		}

		const props = ability.input_schema.properties;
		return (
			<VStack spacing={ 1 } as="dl">
				<dt>Parameters</dt>
				{ Object.entries( props ).map( ( [ key, schema ] ) => (
					<dd key={ key }>
						<code>{ key }</code>
						{ schema.type && ` (${ schema.type })` }
						{ schema.default !== undefined &&
							` = ${ JSON.stringify( schema.default ) }` }
						{ schema.description && ` — ${ schema.description }` }
					</dd>
				) ) }
			</VStack>
		);
	};

	return (
		<Card isBorderless={ false } size="medium">
			<CardHeader>
				<HStack
					alignment="center"
					justify="space-between"
					spacing={ 2 }
				>
					<strong>{ ability.label }</strong>
					{ isDestructive && (
						<Notice
							status="warning"
							isDismissible={ false }
							politeness="off"
						>
							Destructive
						</Notice>
					) }
				</HStack>
			</CardHeader>
			<CardBody>
				<VStack spacing={ 3 }>
					<p>{ ability.description }</p>
					<code>{ ability.name }</code>

					{ hasInputSchema && (
						<>
							<Button
								variant="link"
								onClick={ () => setShowInput( ! showInput ) }
								aria-expanded={ showInput }
							>
								{ showInput
									? 'Hide parameters'
									: 'Show parameters' }
							</Button>

							{ showInput && (
								<VStack spacing={ 2 }>
									{ renderSchemaHints() }
									<TextareaControl
										__nextHasNoMarginBottom
										value={ inputJson }
										onChange={ setInputJson }
										placeholder='{"param": "value"}'
										aria-label={ `JSON parameters for ${ ability.label }` }
										rows={ 3 }
									/>
									{ inputError && (
										<Notice
											status="error"
											isDismissible={ false }
										>
											{ inputError }
										</Notice>
									) }
								</VStack>
							) }
						</>
					) }
				</VStack>
			</CardBody>
			<CardFooter>
				<Button
					variant="primary"
					isDestructive={ isDestructive }
					onClick={ handleExecute }
					disabled={ isExecuting }
					isBusy={ isExecuting }
				>
					{ isExecuting ? 'Executing…' : 'Execute' }
				</Button>
			</CardFooter>
		</Card>
	);
};

const ResultPanel = ( { result, onClear } ) => {
	if ( ! result ) {
		return null;
	}

	const isError = result.error;

	return (
		<Notice
			status={ isError ? 'error' : 'success' }
			onRemove={ onClear }
			politeness="polite"
		>
			<VStack spacing={ 2 }>
				<strong>
					{ isError ? 'Execution failed' : 'Execution successful' }
				</strong>
				<pre>{ JSON.stringify( result.data || result, null, 2 ) }</pre>
			</VStack>
		</Notice>
	);
};

const AbilityBrowser = () => {
	const [ abilities, setAbilities ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ executingAbility, setExecutingAbility ] = useState( null );
	const [ lastResult, setLastResult ] = useState( null );

	useEffect( () => {
		loadAbilities();
	}, [] );

	const loadAbilities = async () => {
		setIsLoading( true );
		setError( null );

		try {
			const data = await abilitiesApi.listAbilities();
			const all = Array.isArray( data ) ? data : [];

			const filtered = all.filter(
				( a ) =>
					a.name?.startsWith( 'agentic-admin/' ) ||
					a.name?.startsWith( 'core/' )
			);

			setAbilities( filtered.length > 0 ? filtered : all );
		} catch ( err ) {
			setError( err.message || 'Failed to load abilities' );
		} finally {
			setIsLoading( false );
		}
	};

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

	if ( isLoading ) {
		return (
			<VStack alignment="center" spacing={ 2 }>
				<Spinner />
				<p>Loading abilities…</p>
			</VStack>
		);
	}

	if ( error ) {
		return (
			<VStack spacing={ 3 }>
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
				<Button variant="secondary" onClick={ loadAbilities }>
					Retry
				</Button>
			</VStack>
		);
	}

	if ( abilities.length === 0 ) {
		return (
			<VStack spacing={ 3 }>
				<Notice status="warning" isDismissible={ false }>
					No abilities found. Make sure the Abilities API plugin is
					active and abilities are registered.
				</Notice>
				<Button variant="secondary" onClick={ loadAbilities }>
					Refresh
				</Button>
			</VStack>
		);
	}

	return (
		<VStack spacing={ 4 } className="agentic-admin-tab-padded">
			<HStack alignment="center" justify="space-between" spacing={ 4 }>
				<VStack spacing={ 1 } style={ { flex: 1 } }>
					<h3>Available Abilities</h3>
					<p>
						Test abilities manually by clicking Execute. Includes
						WordPress core and Agentic Admin abilities.
					</p>
				</VStack>
				<Button variant="secondary" onClick={ loadAbilities }>
					Refresh
				</Button>
			</HStack>

			<ResultPanel
				result={ lastResult }
				onClear={ () => setLastResult( null ) }
			/>

			<div className="agentic-admin-ability-grid">
				{ abilities.map( ( ability ) => (
					<AbilityCard
						key={ ability.name }
						ability={ ability }
						onExecute={ handleExecute }
						isExecuting={ executingAbility === ability.name }
					/>
				) ) }
			</div>
		</VStack>
	);
};

export default AbilityBrowser;
