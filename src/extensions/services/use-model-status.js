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
	loadedModelInfo: modelLoader.getLoadedModelInfo(),
	isServiceWorkerMode: modelLoader.isUsingServiceWorker(),
} );

const useModelStatus = () => {
	const [ snapshot, setSnapshot ] = useState( readSnapshot );

	useEffect( () => {
		const unsub = modelLoader.onStatus( ( stat, msg ) => {
			setSnapshot( ( prev ) => ( {
				...prev,
				status: stat,
				message: msg,
				loadedModelInfo: modelLoader.getLoadedModelInfo(),
				isServiceWorkerMode: modelLoader.isUsingServiceWorker(),
			} ) );
		} );
		return unsub;
	}, [] );

	return snapshot;
};

export default useModelStatus;
