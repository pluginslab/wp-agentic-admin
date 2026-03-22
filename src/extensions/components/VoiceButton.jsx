/**
 * VoiceButton Component
 *
 * Microphone button for speech-to-text voice input.
 *
 * Flow:
 *   1. User clicks mic (or parent calls ref.start()) → MediaRecorder starts.
 *   2. User clicks stop / releases Space / 30 s elapses → recording stops,
 *      state moves to 'transcribing'.
 *   3. Full audio blob is decoded and sent to the Whisper Web Worker.
 *   4. Final transcript is passed to onTranscript callback.
 *
 * States:
 *   idle         — mic icon, visible only on empty input
 *   recording    — stop icon + countdown badge; click to stop
 *   transcribing — three pulsing dots while Whisper runs
 *
 * Imperative handle (via ref):
 *   ref.start() — start recording programmatically
 *   ref.stop()  — stop recording programmatically
 *
 * iOS Safari: audio/webm unsupported → falls back to audio/mp4.
 * WebGPU unavailable on iOS → worker uses WASM backend automatically.
 *
 * @since 0.10.0
 */

import {
	useState,
	useRef,
	useEffect,
	useImperativeHandle,
	forwardRef,
} from '@wordpress/element';

/** Maximum recording duration in seconds — matches Whisper's context window. */
const MAX_RECORDING_SECONDS = 30;

/**
 * Find the best supported MIME type for MediaRecorder.
 *
 * Safari/iOS does not support audio/webm — falls back to audio/mp4.
 *
 * @return {string} Supported MIME type, or empty string for browser default.
 */
function getSupportedMimeType() {
	const candidates = [
		'audio/webm;codecs=opus',
		'audio/webm',
		'audio/mp4',
		'audio/ogg;codecs=opus',
	];

	for ( const type of candidates ) {
		if (
			typeof MediaRecorder !== 'undefined' &&
			MediaRecorder.isTypeSupported( type )
		) {
			return type;
		}
	}

	return '';
}

/** Material Design "mic" path (24 × 24 viewBox). */
const MicIcon = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="currentColor"
		aria-hidden="true"
	>
		<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
	</svg>
);

/** Material Design "stop" square (24 × 24 viewBox). */
const StopIcon = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="currentColor"
		aria-hidden="true"
	>
		<rect x="6" y="6" width="12" height="12" rx="1" />
	</svg>
);

/** Three pulsing dots shown while Whisper is running the final pass. */
const ThinkingDots = () => (
	<span className="wp-agentic-admin-voice-dots" aria-hidden="true">
		<span />
		<span />
		<span />
	</span>
);

/**
 * VoiceButton component.
 *
 * Renders null if the browser does not support MediaRecorder or getUserMedia.
 *
 * @param {Object}   props                       - Component props.
 * @param {Function} props.onTranscript          - Called with the final transcribed string.
 * @param {Function} [props.onPartialTranscript] - Called with interim status text.
 * @param {Function} [props.onStateChange]       - Called on every state transition.
 * @param {boolean}  props.disabled              - Whether the button is disabled.
 * @param {Object}   ref                         - Imperative ref exposing start/stop.
 * @return {JSX.Element|null} The voice button, or null if unsupported.
 */
const VoiceButton = forwardRef(
	( { onTranscript, onPartialTranscript, onStateChange, disabled }, ref ) => {
		const [ state, setState ] = useState( 'idle' ); // 'idle' | 'recording' | 'transcribing'
		const [ recordingSeconds, setRecordingSeconds ] = useState( 0 );

		// Stable refs for callbacks — never go stale inside async handlers.
		const onTranscriptRef = useRef( onTranscript );
		const onPartialTranscriptRef = useRef( onPartialTranscript );
		const onStateChangeRef = useRef( onStateChange );

		useEffect( () => {
			onTranscriptRef.current = onTranscript;
			onPartialTranscriptRef.current = onPartialTranscript;
			onStateChangeRef.current = onStateChange;
		} );

		const mediaRecorderRef = useRef( null );
		const mimeTypeRef = useRef( '' );
		const workerRef = useRef( null );
		const decodeCtxRef = useRef( null );
		const requestIdRef = useRef( 0 );
		const autoStopTimeoutRef = useRef( null );
		const countdownIntervalRef = useRef( null );

		// Mutable refs so the imperative handle can delegate to the real functions
		// even though those are defined after the early-return check below.
		const startRecordingRef = useRef( null );
		const stopRecordingRef = useRef( null );

		// Expose start/stop to parent via ref (e.g. for Space-bar push-to-talk).
		useImperativeHandle(
			ref,
			() => ( {
				start: () => startRecordingRef.current?.(),
				stop: () => stopRecordingRef.current?.(),
			} ),
			[]
		); // eslint-disable-line react-hooks/exhaustive-deps

		/**
		 * Transition to a new state and notify the parent.
		 *
		 * @param {string} next - New state value.
		 */
		const transition = ( next ) => {
			setState( next );
			onStateChangeRef.current?.( next );
		};

		/**
		 * Lazily create (and cache) the Whisper Web Worker.
		 *
		 * @return {Worker|null} Worker instance, or null when pluginUrl is unavailable.
		 */
		const getWorker = () => {
			if ( workerRef.current ) {
				return workerRef.current;
			}

			const pluginUrl = window.wpAgenticAdmin?.pluginUrl;

			if ( ! pluginUrl ) {
				return null;
			}

			const worker = new Worker(
				pluginUrl + 'build-extensions/whisper-worker.js'
			);

			worker.addEventListener( 'message', ( e ) => {
				const { type: msgType, text } = e.data;

				if ( msgType === 'result' ) {
					onTranscriptRef.current?.( text );
					transition( 'idle' );
				} else if ( msgType === 'error' ) {
					transition( 'idle' );
				}
			} );

			workerRef.current = worker;
			return worker;
		};

		// Clean up everything on unmount.
		useEffect( () => {
			return () => {
				workerRef.current?.terminate();
				decodeCtxRef.current?.close();
				clearTimeout( autoStopTimeoutRef.current );
				clearInterval( countdownIntervalRef.current );
			};
		}, [] );

		// Pre-warm the Whisper model on mount so first voice use is instant.
		// getWorker() accesses only stable refs and window globals — safe with [].
		useEffect( () => {
			if (
				typeof MediaRecorder === 'undefined' ||
				! navigator?.mediaDevices?.getUserMedia
			) {
				return;
			}
			const worker = getWorker();
			if ( worker ) {
				worker.postMessage( { type: 'warmup' } );
			}
		}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

		// Return null if the browser lacks the required APIs.
		if (
			typeof MediaRecorder === 'undefined' ||
			! navigator?.mediaDevices?.getUserMedia
		) {
			return null;
		}

		/**
		 * Get (or create) the 16 kHz AudioContext used to decode recorded audio.
		 *
		 * @return {AudioContext} Decode context.
		 */
		const getDecodeCtx = () => {
			if (
				! decodeCtxRef.current ||
				decodeCtxRef.current.state === 'closed'
			) {
				decodeCtxRef.current = new AudioContext( {
					sampleRate: 16000,
				} );
			}

			return decodeCtxRef.current;
		};

		const startRecording = async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia( {
					audio: true,
				} );

				const mimeType = getSupportedMimeType();
				mimeTypeRef.current = mimeType;

				const options = mimeType ? { mimeType } : {};
				const recorder = new MediaRecorder( stream, options );
				const chunks = [];

				recorder.addEventListener( 'dataavailable', ( e ) => {
					if ( e.data.size > 0 ) {
						chunks.push( e.data );
					}
				} );

				recorder.addEventListener( 'stop', async () => {
					stream.getTracks().forEach( ( track ) => track.stop() );

					if ( ! chunks.length ) {
						transition( 'idle' );
						return;
					}

					try {
						const blob = new Blob( chunks, {
							type: mimeTypeRef.current || 'audio/webm',
						} );
						const arrayBuffer = await blob.arrayBuffer();
						const audioCtx = getDecodeCtx();
						const audioBuffer =
							await audioCtx.decodeAudioData( arrayBuffer );
						const pcmData = audioBuffer.getChannelData( 0 );
						const worker = getWorker();

						if ( ! worker ) {
							transition( 'idle' );
							return;
						}

						const id = ++requestIdRef.current;
						// Derive the site language from the <html lang="…"> attribute
						// that WordPress sets, e.g. "en-US" → "en", "de-DE" → "de".
						const lang =
							document.documentElement.lang
								?.split( '-' )[ 0 ]
								?.toLowerCase() || 'en';

						worker.postMessage(
							{
								type: 'transcribe',
								audioData: pcmData,
								sampleRate: 16000,
								id,
								language: lang,
							},
							[ pcmData.buffer ]
						);
					} catch {
						onPartialTranscriptRef.current?.( '' );
						transition( 'idle' );
					}
				} );

				mediaRecorderRef.current = recorder;
				recorder.start();
				transition( 'recording' );

				// Tick the countdown every second.
				countdownIntervalRef.current = setInterval( () => {
					setRecordingSeconds( ( s ) => s + 1 );
				}, 1000 );

				// Hard-stop at the Whisper context-window limit.
				autoStopTimeoutRef.current = setTimeout( () => {
					clearInterval( countdownIntervalRef.current );
					setRecordingSeconds( 0 );
					if ( mediaRecorderRef.current?.state === 'recording' ) {
						mediaRecorderRef.current.stop();
						transition( 'transcribing' );
						onPartialTranscriptRef.current?.(
							'Transcribing your voice...'
						);
					}
				}, MAX_RECORDING_SECONDS * 1000 );
			} catch {
				transition( 'idle' );
			}
		};

		const stopRecording = () => {
			clearTimeout( autoStopTimeoutRef.current );
			clearInterval( countdownIntervalRef.current );
			setRecordingSeconds( 0 );
			if ( mediaRecorderRef.current?.state === 'recording' ) {
				mediaRecorderRef.current.stop();
				transition( 'transcribing' );
				// Show in-progress text inside the textarea so the user knows
				// transcription is running. Replaced by the real result on success.
				onPartialTranscriptRef.current?.(
					'Transcribing your voice...'
				);
			}
		};

		// Populate the imperative-handle refs now that the real functions exist.
		startRecordingRef.current = startRecording;
		stopRecordingRef.current = stopRecording;

		const handleClick = () => {
			if ( state === 'idle' ) {
				startRecording();
			} else if ( state === 'recording' ) {
				stopRecording();
			}
		};

		const isProcessing = state === 'transcribing';
		const ariaLabel =
			state === 'recording' ? 'Stop recording' : 'Start voice input';
		const remaining = MAX_RECORDING_SECONDS - recordingSeconds;
		const isNearLimit = state === 'recording' && remaining <= 10;

		let content;
		if ( state === 'recording' ) {
			content = (
				<>
					<StopIcon />
					<span
						className="wp-agentic-admin-voice-timer"
						aria-hidden="true"
					>
						{ remaining }s
					</span>
				</>
			);
		} else if ( state === 'transcribing' ) {
			content = <ThinkingDots />;
		} else {
			content = <MicIcon />;
		}

		return (
			<button
				type="button"
				className={ `wp-agentic-admin-voice-button wp-agentic-admin-voice-button--${ state }${
					isNearLimit ? ' wp-agentic-admin-voice-button--warning' : ''
				}` }
				onClick={ handleClick }
				disabled={ disabled || isProcessing }
				aria-label={ ariaLabel }
			>
				{ content }
			</button>
		);
	}
);

VoiceButton.displayName = 'VoiceButton';

export default VoiceButton;
