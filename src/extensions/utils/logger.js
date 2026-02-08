/**
 * Centralized logging utility with verbosity control
 *
 * Log Levels:
 * - ERROR (0): Critical errors only
 * - WARN (1): Warnings and errors
 * - INFO (2): Important info, warnings, errors
 * - DEBUG (3): Everything (verbose)
 */

const LOG_LEVELS = {
	ERROR: 0,
	WARN: 1,
	INFO: 2,
	DEBUG: 3,
};

// Set default log level (can be changed via console: window.wpAgenticLogLevel = 2)
let currentLogLevel = LOG_LEVELS.INFO;

// Allow setting log level from browser console
if ( typeof window !== 'undefined' ) {
	window.wpAgenticLogLevel = currentLogLevel;
	Object.defineProperty( window, 'wpAgenticLogLevel', {
		get: () => currentLogLevel,
		set: ( level ) => {
			if ( typeof level === 'number' && level >= 0 && level <= 3 ) {
				currentLogLevel = level;
				console.log(
					`[WP Agentic] Log level set to: ${ Object.keys(
						LOG_LEVELS
					).find( ( key ) => LOG_LEVELS[ key ] === level ) }`
				);
			}
		},
	} );
}

/**
 * Logger class
 */
class Logger {
	constructor( namespace ) {
		this.namespace = namespace;
	}

	/**
	 * Log error (always shown)
	 *
	 * @param {...any} args - Error messages and data to log.
	 */
	error( ...args ) {
		if ( currentLogLevel >= LOG_LEVELS.ERROR ) {
			console.error( `[${ this.namespace }]`, ...args );
		}
	}

	/**
	 * Log warning
	 *
	 * @param {...any} args - Warning messages and data to log.
	 */
	warn( ...args ) {
		if ( currentLogLevel >= LOG_LEVELS.WARN ) {
			console.warn( `[${ this.namespace }]`, ...args );
		}
	}

	/**
	 * Log info (important events)
	 *
	 * @param {...any} args - Info messages and data to log.
	 */
	info( ...args ) {
		if ( currentLogLevel >= LOG_LEVELS.INFO ) {
			console.log( `[${ this.namespace }]`, ...args );
		}
	}

	/**
	 * Log debug (verbose)
	 *
	 * @param {...any} args - Debug messages and data to log.
	 */
	debug( ...args ) {
		if ( currentLogLevel >= LOG_LEVELS.DEBUG ) {
			console.log( `[${ this.namespace }]`, ...args );
		}
	}
}

/**
 * Create a logger for a specific namespace
 *
 * @param {string} namespace - Logger namespace
 * @return {Logger} Logger instance configured for the given namespace.
 */
export const createLogger = ( namespace ) => new Logger( namespace );

export { LOG_LEVELS };
