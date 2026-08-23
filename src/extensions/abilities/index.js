/**
 * Abilities Index
 *
 * Registers all enabled abilities by iterating the manifest.
 *
 * The PHP side (includes/abilities-manifest.php) is authoritative for
 * which PHP-backed abilities are enabled. PHP exposes the resolved list
 * as window.agenticAdmin.enabledAbilities. JS-only abilities (defined
 * in manifest.js as JS_ONLY_ABILITIES) are merged in on top.
 *
 * Test/dev fallback (no localized data): register everything in REGISTRARS.
 *
 * See: src/extensions/abilities/manifest.js, includes/abilities-manifest.php
 */

import { createLogger } from '../utils/logger';
import { REGISTRARS, JS_ONLY_ABILITIES } from './manifest';

const log = createLogger( 'Abilities' );

/**
 * Compute the final set of slugs to register.
 *
 * Exported for unit tests; production code should call registerAllAbilities().
 *
 * @return {Set<string>} Slugs whose REGISTRARS entry should be invoked.
 */
export function resolveEnabledSlugs() {
	const settings = window.agenticAdmin ?? {};

	if ( Array.isArray( settings.enabledAbilities ) ) {
		// PHP authoritative: start with what PHP enabled, then add JS-only.
		const enabled = new Set( settings.enabledAbilities );
		for ( const slug of JS_ONLY_ABILITIES ) {
			enabled.add( slug );
		}
		return enabled;
	}

	// No PHP data (tests, dev): register everything in the manifest.
	return new Set( Object.keys( REGISTRARS ) );
}

/**
 * Register all enabled abilities.
 */
export function registerAllAbilities() {
	const enabled = resolveEnabledSlugs();

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
}

export default registerAllAbilities;
