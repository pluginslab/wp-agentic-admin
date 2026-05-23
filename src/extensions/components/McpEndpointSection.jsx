/**
 * MCP Endpoint Section
 *
 * Renders the MCP server settings inside the Settings tab. Talks to the
 * /wp-agentic-admin/v1/mcp-settings REST route for state + save.
 *
 * Mounted from SettingsTab.jsx.
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import {
	Button,
	Card,
	CardBody,
	CardHeader,
	CheckboxControl,
	Notice,
	ToggleControl,
} from '@wordpress/components';

const REST_PATH = '/wp-json/wp-agentic-admin/v1/mcp-settings';

function getNonce() {
	return ( window.wpAgenticAdmin && window.wpAgenticAdmin.nonce ) || '';
}

async function fetchSettings() {
	const res = await fetch( REST_PATH, {
		credentials: 'same-origin',
		headers: { 'X-WP-Nonce': getNonce() },
	} );
	if ( ! res.ok ) {
		throw new Error( `Failed to load MCP settings (HTTP ${ res.status })` );
	}
	return res.json();
}

async function saveSettings( payload ) {
	const res = await fetch( REST_PATH, {
		method: 'POST',
		credentials: 'same-origin',
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': getNonce(),
		},
		body: JSON.stringify( payload ),
	} );
	if ( ! res.ok ) {
		throw new Error( `Failed to save MCP settings (HTTP ${ res.status })` );
	}
	return res.json();
}

function groupBySource( thirdParty ) {
	const groups = {};
	for ( const ability of thirdParty ) {
		const key = ability.sourcePlugin || 'Unknown';
		if ( ! groups[ key ] ) {
			groups[ key ] = [];
		}
		groups[ key ].push( ability );
	}
	return groups;
}

const McpEndpointSection = () => {
	const [ loading, setLoading ] = useState( true );
	const [ saving, setSaving ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ saved, setSaved ] = useState( false );
	const [ copied, setCopied ] = useState( false );

	const [ enabled, setEnabled ] = useState( false );
	const [ exposeOwn, setExposeOwn ] = useState( true );
	const [ exposeThird, setExposeThird ] = useState( false );
	const [ allowlist, setAllowlist ] = useState( [] );
	const [ thirdParty, setThirdParty ] = useState( [] );
	const [ endpointUrl, setEndpointUrl ] = useState( '' );

	const load = useCallback( async () => {
		setLoading( true );
		setError( null );
		try {
			const data = await fetchSettings();
			setEnabled( !! data.enabled );
			setExposeOwn( !! data.exposeOwn );
			setExposeThird( !! data.exposeThird );
			setAllowlist(
				Array.isArray( data.allowlist ) ? data.allowlist : []
			);
			setThirdParty(
				Array.isArray( data.thirdParty ) ? data.thirdParty : []
			);
			setEndpointUrl( data.endpointUrl || '' );
		} catch ( e ) {
			setError( e.message || 'Failed to load settings.' );
		} finally {
			setLoading( false );
		}
	}, [] );

	useEffect( () => {
		load();
	}, [ load ] );

	const handleSave = async () => {
		setSaving( true );
		setError( null );
		setSaved( false );
		try {
			const data = await saveSettings( {
				enabled,
				exposeOwn,
				exposeThird,
				allowlist,
			} );
			setEnabled( !! data.enabled );
			setExposeOwn( !! data.exposeOwn );
			setExposeThird( !! data.exposeThird );
			setAllowlist(
				Array.isArray( data.allowlist ) ? data.allowlist : []
			);
			setEndpointUrl( data.endpointUrl || '' );
			setSaved( true );
			setTimeout( () => setSaved( false ), 3000 );
		} catch ( e ) {
			setError( e.message || 'Failed to save settings.' );
		} finally {
			setSaving( false );
		}
	};

	const toggleAllowlistEntry = ( abilityName, on ) => {
		setAllowlist( ( prev ) => {
			const next = new Set( prev );
			if ( on ) {
				next.add( abilityName );
			} else {
				next.delete( abilityName );
			}
			return Array.from( next );
		} );
	};

	const handleCopy = async () => {
		if ( ! endpointUrl ) {
			return;
		}
		try {
			await navigator.clipboard.writeText( endpointUrl );
			setCopied( true );
			setTimeout( () => setCopied( false ), 2000 );
		} catch {
			// Clipboard unavailable; ignore.
		}
	};

	const groups = groupBySource( thirdParty );

	return (
		<Card>
			<CardHeader>
				<h3 style={ { margin: 0 } }>MCP Endpoint</h3>
			</CardHeader>
			<CardBody>
				<p
					className="wp-agentic-admin-settings-tab__description"
					style={ { marginTop: 0 } }
				>
					Expose registered abilities to external AI clients via a
					read-only MCP server. Authentication uses WordPress
					application passwords. Disabled by default.
				</p>

				{ error && (
					<Notice
						status="error"
						isDismissible
						onRemove={ () => setError( null ) }
					>
						{ error }
					</Notice>
				) }

				{ saved && (
					<Notice
						status="success"
						isDismissible
						onRemove={ () => setSaved( false ) }
					>
						Settings saved.
					</Notice>
				) }

				{ loading && <p>Loading…</p> }

				{ ! loading && (
					<>
						<ToggleControl
							label="Enable MCP endpoint"
							help="When enabled, external clients can call exposed abilities via the URL below using an application password."
							checked={ enabled }
							onChange={ setEnabled }
						/>

						{ enabled && (
							<>
								<div
									style={ {
										marginTop: '12px',
										marginBottom: '16px',
										padding: '8px 12px',
										background: '#f0f0f1',
										borderRadius: '4px',
										fontFamily: 'monospace',
										display: 'flex',
										alignItems: 'center',
										gap: '8px',
									} }
								>
									<span
										style={ {
											flex: 1,
											wordBreak: 'break-all',
										} }
									>
										{ endpointUrl }
									</span>
									<Button
										variant="secondary"
										onClick={ handleCopy }
										disabled={ ! endpointUrl }
									>
										{ copied ? 'Copied!' : 'Copy' }
									</Button>
								</div>

								<ToggleControl
									label="Expose Agentic Admin's own abilities"
									help="Include abilities registered by this plugin in the MCP tool list."
									checked={ exposeOwn }
									onChange={ setExposeOwn }
								/>

								<ToggleControl
									label="Expose abilities from other plugins"
									help="Allow third-party Abilities API entries to be exposed. Pick which ones below."
									checked={ exposeThird }
									onChange={ setExposeThird }
								/>

								{ exposeThird && (
									<div style={ { marginTop: '12px' } }>
										<strong>
											Allowed third-party abilities
										</strong>
										<p
											className="wp-agentic-admin-settings-tab__description"
											style={ { marginTop: '4px' } }
										>
											Read-only abilities only in this
											version. Non-readonly abilities are
											listed but cannot be selected.
										</p>

										{ thirdParty.length === 0 && (
											<p
												style={ {
													fontStyle: 'italic',
												} }
											>
												No third-party abilities are
												registered.
											</p>
										) }

										{ Object.entries( groups ).map(
											( [ source, abilities ] ) => (
												<div
													key={ source }
													style={ {
														marginBottom: '12px',
													} }
												>
													<div
														style={ {
															fontWeight: 600,
															marginBottom: '4px',
														} }
													>
														{ source }
													</div>
													{ abilities.map(
														( ability ) => (
															<CheckboxControl
																key={
																	ability.name
																}
																label={ `${ ability.label } (${ ability.name })` }
																help={
																	ability.readonly
																		? ability.description
																		: 'Non-readonly — not selectable in v1.'
																}
																checked={ allowlist.includes(
																	ability.name
																) }
																disabled={
																	! ability.readonly
																}
																onChange={ (
																	on
																) =>
																	toggleAllowlistEntry(
																		ability.name,
																		on
																	)
																}
															/>
														)
													) }
												</div>
											)
										) }
									</div>
								) }
							</>
						) }

						<div style={ { marginTop: '16px' } }>
							<Button
								variant="primary"
								onClick={ handleSave }
								isBusy={ saving }
								disabled={ saving }
							>
								{ saving ? 'Saving…' : 'Save MCP settings' }
							</Button>
						</div>
					</>
				) }
			</CardBody>
		</Card>
	);
};

export default McpEndpointSection;
