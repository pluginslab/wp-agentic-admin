/**
 * Whisper Web Worker
 *
 * Runs speech-to-text transcription inside a Web Worker using
 * the @huggingface/transformers library and Xenova/whisper-tiny model (~40 MB ONNX).
 *
 * The model is downloaded from HuggingFace Hub on first use and cached in
 * the browser's Cache Storage — subsequent uses are instant.
 *
 * Message protocol:
 *   In:  { type: 'transcribe', audioData: Float32Array, sampleRate: number, id: number, language: string }
 *        { type: 'warmup' }
 *   Out: { type: 'result',  text: string, id: number }
 *        { type: 'ready' }
 *        { type: 'error',  message: string, id: number }
 *
 * @since 0.10.0
 */

import { pipeline } from '@huggingface/transformers';

/** @type {Function|null} Cached pipeline instance. */
let transcriber = null;

/**
 * Map ISO 639-1 codes to the full language names Whisper expects.
 * Falls back to 'english' for any unmapped code.
 *
 * @type {Object.<string,string>}
 */
const ISO_TO_WHISPER = {
	en: 'english',
	de: 'german',
	fr: 'french',
	es: 'spanish',
	it: 'italian',
	pt: 'portuguese',
	nl: 'dutch',
	pl: 'polish',
	ru: 'russian',
	ja: 'japanese',
	ko: 'korean',
	zh: 'chinese',
	ar: 'arabic',
	tr: 'turkish',
	sv: 'swedish',
	da: 'danish',
	fi: 'finnish',
	nb: 'norwegian',
	nn: 'norwegian',
	cs: 'czech',
	sk: 'slovak',
	hu: 'hungarian',
	ro: 'romanian',
	uk: 'ukrainian',
};

/**
 * Resolve a language value (ISO code or full name) to the full name
 * that Whisper's forced-decoder token expects.
 *
 * @param {string} lang - ISO 639-1 code or full Whisper language name.
 * @return {string} Full Whisper language name, e.g. 'english'.
 */
function resolveLanguage( lang ) {
	if ( ! lang ) {
		return 'english';
	}
	// Already a full name (e.g. passed explicitly as 'english').
	if ( lang.length > 3 ) {
		return lang.toLowerCase();
	}
	return ISO_TO_WHISPER[ lang.toLowerCase() ] ?? 'english';
}

/**
 * Lazily initialise the Whisper pipeline.
 *
 * Uses WASM (not WebGPU) to avoid q8 precision issues observed on some
 * GPU drivers. WASM is reliable and fast enough for short voice clips.
 *
 * @return {Promise<Function>} Ready-to-call ASR pipeline.
 */
async function getTranscriber() {
	if ( transcriber ) {
		return transcriber;
	}

	transcriber = await pipeline(
		'automatic-speech-recognition',
		'Xenova/whisper-tiny',
		{ device: 'wasm', dtype: 'q8' }
	);

	return transcriber;
}

self.addEventListener( 'message', async ( event ) => {
	const { type, audioData, sampleRate, id, language } = event.data;

	// eslint-disable-next-line no-console
	console.log( '[whisper-worker] message received:', type );

	// Pre-warm: load the model without processing any audio.
	if ( type === 'warmup' ) {
		try {
			await getTranscriber();
			self.postMessage( { type: 'ready' } );
			// eslint-disable-next-line no-console
			console.log( '[whisper-worker] warmup complete' );
		} catch ( err ) {
			// eslint-disable-next-line no-console
			console.error( '[whisper-worker] warmup error:', err );
		}
		return;
	}

	if ( type !== 'transcribe' && type !== 'transcribe-partial' ) {
		return;
	}

	try {
		const model = await getTranscriber();
		const resolvedLang = resolveLanguage( language );

		// eslint-disable-next-line no-console
		console.log( '[whisper-worker] transcribing', {
			lang: resolvedLang,
			durationSec: ( audioData.length / ( sampleRate ?? 16000 ) ).toFixed(
				1
			),
			maxAmplitude: Math.max(
				...Array.from( audioData.slice( 0, 4000 ) ).map( Math.abs )
			).toFixed( 4 ),
		} );

		const result = await model( audioData, {
			sampling_rate: sampleRate ?? 16000,
			// Force transcription (not translation) in the target language.
			task: 'transcribe',
			language: resolvedLang,
		} );

		// eslint-disable-next-line no-console
		console.log( '[whisper-worker] raw result:', JSON.stringify( result ) );

		const outType =
			type === 'transcribe-partial' ? 'partial-result' : 'result';

		self.postMessage( {
			type: outType,
			text: result.text?.trim() ?? '',
			id,
		} );
	} catch ( err ) {
		self.postMessage( {
			type: 'error',
			message: err.message,
			id,
		} );
	}
} );
