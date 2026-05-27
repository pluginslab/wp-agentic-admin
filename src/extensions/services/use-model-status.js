/**
 * Minimal model-status hook for the toolbar pill.
 * Subscribes to modelLoader status/progress and reports only the slice
 * the inline status pill needs.
 */

import { useEffect, useState } from '@wordpress/element';
import modelLoader from './model-loader';

const readSnapshot = () => {
	const ready = modelLoader.isModelReady();
	// Pull in-flight state so a hook mounting mid-load (e.g. after a
	// route change) shows the spinner and percent immediately instead
	// of "Not loaded / 0%" until the next status change fires.
	const loading = ! ready && Boolean( modelLoader.isLoading );
	let status;
	if ( ready ) {
		status = 'ready';
	} else if ( loading ) {
		status = 'loading';
	} else {
		status = 'not-loaded';
	}

	let message;
	if ( ready ) {
		message = 'AI model ready';
	} else if ( loading ) {
		message = 'Loading AI model...';
	} else {
		message = 'AI model not loaded';
	}

	let progress;
	if ( ready ) {
		progress = 100;
	} else if ( loading ) {
		progress = Number( modelLoader.loadProgress ) || 0;
	} else {
		progress = 0;
	}

	return {
		status,
		message,
		progress,
		loadedModelInfo: modelLoader.getLoadedModelInfo(),
		isServiceWorkerMode: modelLoader.isUsingServiceWorker(),
	};
};

const useModelStatus = () => {
	const [ snapshot, setSnapshot ] = useState( readSnapshot );

	useEffect( () => {
		const unsubStatus = modelLoader.onStatus( ( stat, msg ) => {
			setSnapshot( ( prev ) => ( {
				...prev,
				status: stat,
				message: msg,
				loadedModelInfo: modelLoader.getLoadedModelInfo(),
				isServiceWorkerMode: modelLoader.isUsingServiceWorker(),
			} ) );
		} );
		const unsubProgress = modelLoader.onProgress( ( prog ) => {
			setSnapshot( ( prev ) => ( { ...prev, progress: prog } ) );
		} );
		return () => {
			unsubStatus();
			unsubProgress();
		};
	}, [] );

	return snapshot;
};

export default useModelStatus;
