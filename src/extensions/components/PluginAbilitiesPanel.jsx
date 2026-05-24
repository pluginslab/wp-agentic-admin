/**
 * PluginAbilitiesPanel Component
 *
 * Manages plugin abilities with token budget tracking.
 * Shows a budget bar and toggle list for enabling/disabling
 * plugin abilities for the LLM agent.
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import {
	Button,
	Card,
	CardBody,
	Notice,
	Spinner,
	ToggleControl,
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import abilitiesApi from '../services/abilities-api';
import pluginAbilitiesManager from '../services/plugin-abilities-manager';

/**
 * TokenBudgetBar — animated bar showing context window usage.
 *
 * @param {Object} props               - Component props.
 * @param {number} props.percentage    - External abilities usage percentage (0-100).
 * @param {number} props.used          - Tokens used by external abilities.
 * @param {number} props.maxContext    - Max context window size.
 * @param {number} props.totalUsed     - Total tokens used across everything.
 * @param {number} props.builtInTokens - Tokens used by built-in tools.
 * @return {JSX.Element} Rendered budget bar.
 */
const TokenBudgetBar = ( {
	percentage,
	used,
	maxContext,
	totalUsed,
	builtInTokens,
} ) => {
	const getBarColor = ( pct ) => {
		if ( pct >= 90 ) {
			return '#d63638';
		}
		if ( pct >= 70 ) {
			return '#dba617';
		}
		if ( pct >= 50 ) {
			return '#e68a00';
		}
		return '#00a32a';
	};

	const getStatusLabel = ( pct ) => {
		if ( pct >= 90 ) {
			return 'Almost full';
		}
		if ( pct >= 70 ) {
			return 'Getting full';
		}
		if ( pct >= 50 ) {
			return 'Half used';
		}
		return 'Plenty of room';
	};

	const reserveTokens = totalUsed - builtInTokens - used;
	const overallPct = Math.min(
		Math.round( ( totalUsed / maxContext ) * 100 ),
		100
	);
	const freePct = Math.max( 100 - overallPct, 0 );

	const color = getBarColor( percentage );
	const status = getStatusLabel( percentage );

	return (
		<div className="wp-agentic-admin-token-budget">
			<div className="wp-agentic-admin-token-budget__header">
				<span className="wp-agentic-admin-token-budget__label">
					AI Memory Budget
				</span>
				<span
					className="wp-agentic-admin-token-budget__status"
					style={ { color } }
				>
					{ status } — { freePct }% free
				</span>
			</div>
			<div className="wp-agentic-admin-token-budget__bar-container">
				<div
					className="wp-agentic-admin-token-budget__bar wp-agentic-admin-token-budget__bar--reserve"
					style={ {
						width: `${ Math.round(
							( reserveTokens / maxContext ) * 100
						) }%`,
					} }
					title={ `Conversation reserve: ~${ reserveTokens }` }
				/>
				<div
					className="wp-agentic-admin-token-budget__bar wp-agentic-admin-token-budget__bar--base"
					style={ {
						width: `${ Math.round(
							( builtInTokens / maxContext ) * 100
						) }%`,
					} }
					title={ `Built-in tools: ~${ builtInTokens }` }
				/>
				{ used > 0 && (
					<div
						className="wp-agentic-admin-token-budget__bar wp-agentic-admin-token-budget__bar--external"
						style={ {
							width: `${ Math.round(
								( used / maxContext ) * 100
							) }%`,
							backgroundColor: color,
						} }
						title={ `Plugin abilities: ~${ used }` }
					/>
				) }
			</div>
			<div className="wp-agentic-admin-token-budget__breakdown">
				<span>
					{ totalUsed.toLocaleString() } /{ ' ' }
					{ maxContext.toLocaleString() } tokens used
				</span>
				<span style={ { color } }>
					Plugins: ~{ used.toLocaleString() }
				</span>
			</div>
		</div>
	);
};

/**
 * PluginAbilitiesPanel component
 *
 * @return {JSX.Element} Rendered panel.
 */
const PluginAbilitiesPanel = () => {
	const [ abilities, setAbilities ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ budget, setBudget ] = useState(
		pluginAbilitiesManager.getTokenBudget()
	);

	/**
	 * Refresh budget from manager.
	 */
	const refreshBudget = useCallback( () => {
		setBudget( pluginAbilitiesManager.getTokenBudget() );
	}, [] );

	/**
	 * Load external abilities on mount.
	 */
	useEffect( () => {
		loadAbilities();
	}, [] );

	/**
	 * Subscribe to manager state changes.
	 */
	useEffect( () => {
		return pluginAbilitiesManager.subscribe( refreshBudget );
	}, [ refreshBudget ] );

	/**
	 * Fetch external abilities from the REST API.
	 */
	const loadAbilities = async () => {
		setIsLoading( true );
		setError( null );

		try {
			// Fetch from both sources in parallel:
			// 1. REST abilities list (full metadata)
			// 2. Our discover endpoint (includes plugin icons)
			const [ restData, discoverResult ] = await Promise.all( [
				abilitiesApi.listAbilities(),
				abilitiesApi
					.executeAbilityById(
						'wp-agentic-admin/discover-plugin-abilities',
						{}
					)
					.catch( () => null ),
			] );

			const all = Array.isArray( restData ) ? restData : [];
			const external = all.filter(
				( a ) =>
					a.name &&
					! a.name.startsWith( 'wp-agentic-admin/' ) &&
					! a.name.startsWith( 'core/' )
			);

			// Merge icon data from discover endpoint into abilities.
			if ( discoverResult?.abilities ) {
				const iconMap = {};
				discoverResult.abilities.forEach( ( a ) => {
					if ( a.icon ) {
						iconMap[ a.id ] = a.icon;
					}
				} );
				external.forEach( ( a ) => {
					if ( iconMap[ a.name ] ) {
						a.icon = iconMap[ a.name ];
					}
				} );
			}

			setAbilities( external );
			pluginAbilitiesManager.setDiscoveredAbilities( external );
			refreshBudget();
		} catch ( err ) {
			setError( err.message || 'Failed to load abilities' );
		} finally {
			setIsLoading( false );
		}
	};

	/**
	 * Handle toggle for a single ability.
	 *
	 * @param {string} abilityId - Ability to toggle.
	 */
	const handleToggle = ( abilityId ) => {
		pluginAbilitiesManager.toggle( abilityId );
	};

	/**
	 * Handle toggle all.
	 */
	const handleToggleAll = () => {
		const allEnabled = abilities.every( ( a ) =>
			pluginAbilitiesManager.isEnabled( a.name )
		);
		if ( allEnabled ) {
			pluginAbilitiesManager.disableAll();
		} else {
			pluginAbilitiesManager.enableAll();
		}
	};

	if ( isLoading ) {
		return (
			<VStack alignment="center" spacing={ 2 }>
				<Spinner />
				<p>Looking for plugin abilities…</p>
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
			<Notice status="info" isDismissible={ false }>
				No plugin abilities found yet. Plugins that support the
				WordPress Abilities API will appear here automatically.
			</Notice>
		);
	}

	const allEnabled = abilities.every( ( a ) =>
		pluginAbilitiesManager.isEnabled( a.name )
	);
	const enabledCount = abilities.filter( ( a ) =>
		pluginAbilitiesManager.isEnabled( a.name )
	).length;

	return (
		<VStack spacing={ 4 } className="wp-agentic-admin-tab-padded">
			<VStack spacing={ 1 }>
				<h3>Plugin Abilities</h3>
				<p>
					Other plugins on your site offer abilities the AI can use.
					Enable the ones you need — but keep an eye on the budget
					bar. The AI has limited memory, so you can&apos;t enable
					everything at once.
				</p>
			</VStack>

			<TokenBudgetBar
				percentage={ budget.percentage }
				used={ budget.used }
				total={ budget.total }
				maxContext={ budget.maxContext }
				totalUsed={ budget.totalUsed }
				builtInTokens={ budget.builtInTokens }
			/>

			{ budget.percentage >= 90 && (
				<Notice status="error" isDismissible={ false }>
					The AI is running low on memory. Turn off some abilities
					so it has room to think and respond.
				</Notice>
			) }

			<Card>
				<CardBody>
					<HStack justify="space-between">
						<ToggleControl
							__nextHasNoMarginBottom
							label={ `Enable all (${ enabledCount } of ${ abilities.length } active)` }
							checked={ allEnabled }
							onChange={ handleToggleAll }
						/>
						<Button variant="link" onClick={ loadAbilities }>
							Refresh
						</Button>
					</HStack>
				</CardBody>
			</Card>

			<div className="wp-agentic-admin-ability-grid">
				{ abilities.map( ( ability ) => {
					const id = ability.name;
					const enabled = pluginAbilitiesManager.isEnabled( id );
					const tokens =
						pluginAbilitiesManager.estimateAbilityTokenCost( id );

					const namespace = id.split( '/' )[ 0 ];

					return (
						<Card key={ id } size="small">
							<CardBody>
								<HStack alignment="top" spacing={ 3 }>
									<VStack spacing={ 2 }>
										<ToggleControl
											__nextHasNoMarginBottom
											label={
												ability.description
													? `${ ability.label || id } — ${
															ability.description
													  }`
													: ability.label || id
											}
											checked={ enabled }
											onChange={ () => handleToggle( id ) }
										/>
										<HStack
											justify="flex-start"
											spacing={ 3 }
										>
											<code>{ id }</code>
											<span>~{ tokens } tokens</span>
										</HStack>
									</VStack>
									{ ability.icon ? (
										<img
											src={ ability.icon }
											alt={ namespace }
											className="wp-agentic-admin-plugin-panel-icon"
										/>
									) : (
										<span className="wp-agentic-admin-plugin-panel-icon wp-agentic-admin-plugin-panel-icon--letter">
											{ namespace
												.charAt( 0 )
												.toUpperCase() }
										</span>
									) }
								</HStack>
							</CardBody>
						</Card>
					);
				} ) }
			</div>
		</VStack>
	);
};

export default PluginAbilitiesPanel;
