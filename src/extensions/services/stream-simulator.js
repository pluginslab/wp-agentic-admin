/**
 * Stream Simulator
 *
 * Provides typewriter-style text streaming for pre-generated content.
 * Creates a natural UX when displaying generated summaries.
 *
 */

/**
 * StreamSimulator class
 * Simulates streaming output with configurable speed
 */
class StreamSimulator {
	constructor() {
		this.isStreaming = false;
		this.abortController = null;
	}

	/**
	 * Stream text character by character with typewriter effect
	 *
	 * @param {string}   text                   - Text to stream
	 * @param {Object}   options                - Streaming options
	 * @param {number}   [options.charDelay=15] - Milliseconds between characters
	 * @param {number}   [options.wordDelay=0]  - Extra delay after spaces
	 * @param {Function} [options.onChunk]      - Callback for each chunk (char)
	 * @param {Function} [options.onComplete]   - Callback when streaming completes
	 * @return {Promise<string>} Resolves with full text when complete
	 */
	async stream( text, options = {} ) {
		const {
			charDelay = 15,
			wordDelay = 0,
			onChunk = () => {},
			onComplete = () => {},
		} = options;

		if ( this.isStreaming ) {
			this.abort();
		}

		this.isStreaming = true;
		this.abortController = new AbortController();
		const { signal } = this.abortController;

		let accumulated = '';

		try {
			for ( let i = 0; i < text.length; i++ ) {
				if ( signal.aborted ) {
					break;
				}

				const char = text[ i ];
				accumulated += char;
				onChunk( char, accumulated );

				// Calculate delay
				let delay = charDelay;
				if ( char === ' ' && wordDelay > 0 ) {
					delay += wordDelay;
				}

				await this.delay( delay, signal );
			}

			onComplete( accumulated );
			return accumulated;
		} finally {
			this.isStreaming = false;
			this.abortController = null;
		}
	}

	/**
	 * Stream text word by word (faster for longer content)
	 *
	 * @param {string}   text                   - Text to stream
	 * @param {Object}   options                - Streaming options
	 * @param {number}   [options.wordDelay=50] - Milliseconds between words
	 * @param {Function} [options.onChunk]      - Callback for each word
	 * @param {Function} [options.onComplete]   - Callback when streaming completes
	 * @return {Promise<string>} Resolves with full text when complete
	 */
	async streamWords( text, options = {} ) {
		const {
			wordDelay = 50,
			onChunk = () => {},
			onComplete = () => {},
		} = options;

		if ( this.isStreaming ) {
			this.abort();
		}

		this.isStreaming = true;
		this.abortController = new AbortController();
		const { signal } = this.abortController;

		const words = text.split( /(\s+)/ ); // Keep whitespace
		let accumulated = '';

		try {
			for ( const word of words ) {
				if ( signal.aborted ) {
					break;
				}

				accumulated += word;
				onChunk( word, accumulated );

				// Only delay for actual words, not whitespace
				if ( word.trim() ) {
					await this.delay( wordDelay, signal );
				}
			}

			onComplete( accumulated );
			return accumulated;
		} finally {
			this.isStreaming = false;
			this.abortController = null;
		}
	}

	/**
	 * Abort current streaming
	 */
	abort() {
		if ( this.abortController ) {
			this.abortController.abort();
		}
		this.isStreaming = false;
	}

	/**
	 * Check if currently streaming
	 *
	 * @return {boolean} True if text is currently being streamed.
	 */
	isCurrentlyStreaming() {
		return this.isStreaming;
	}

	/**
	 * Promise-based delay with abort support
	 *
	 * @param {number}      ms       - Milliseconds to wait
	 * @param {AbortSignal} [signal] - Abort signal
	 * @return {Promise<void>}
	 */
	delay( ms, signal ) {
		return new Promise( ( resolve ) => {
			const timeout = setTimeout( resolve, ms );

			if ( signal ) {
				signal.addEventListener(
					'abort',
					() => {
						clearTimeout( timeout );
						resolve(); // Resolve instead of reject for cleaner abort
					},
					{ once: true }
				);
			}
		} );
	}
}

// Create singleton instance
const streamSimulator = new StreamSimulator();

export { StreamSimulator, streamSimulator };
export default streamSimulator;
