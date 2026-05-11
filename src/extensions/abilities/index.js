/**
 * Abilities Index
 *
 * Registers all enabled abilities by iterating the manifest. The list of
 * enabled slugs comes from PHP (window.wpAgenticAdmin.enabledAbilities)
 * once PR 4 wires that up; for now we iterate every entry in REGISTRARS
 * so behavior matches the pre-manifest state.
 *
 * See: src/extensions/abilities/manifest.js, includes/abilities-manifest.php
 */

import { createLogger } from '../utils/logger';
import webmcpBridge from '../services/webmcp-bridge';
import { REGISTRARS } from './manifest';

const log = createLogger( 'Abilities' );

/**
 * Register all enabled abilities.
 */
export function registerAllAbilities() {
	const enabled =
		window.wpAgenticAdmin?.enabledAbilities ?? Object.keys( REGISTRARS );

	let registered = 0;
	for ( const slug of enabled ) {
		const fn = REGISTRARS[ slug ];
		if ( fn ) {
			fn();
			registered++;
		} else {
			log.warn( `No JS registrar for enabled ability: ${ slug }` );
		}
	}

	log.info( `Registered ${ registered } abilities.` );

	// Bridge registered abilities to WebMCP for external AI agents.
	if ( webmcpBridge.isSupported() ) {
		webmcpBridge.initialize();
	}
}

export default registerAllAbilities;
