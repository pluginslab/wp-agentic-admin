/**
 * Minimal model-status hook for the toolbar pill.
 * Subscribes to modelLoader status/progress and reports only the slice
 * the inline status pill needs.
 */

import { useEffect, useState } from '@wordpress/element';
import modelLoader from './model-loader';

const readSnapshot = () => ( {
	status: modelLoader.isModelReady() ? 'ready' : 'not-loaded',
	message: modelLoader.isModelReady()
		? 'AI model ready'
		: 'AI model not loaded',
	progress: modelLoader.isModelReady() ? 100 : 0,
	loadedModelInfo: modelLoader.getLoadedModelInfo(),
	isServiceWorkerMode: modelLoader.isUsingServiceWorker(),
} );

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
