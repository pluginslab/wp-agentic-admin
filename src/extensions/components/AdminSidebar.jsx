/**
 * Admin Sidebar Component
 *
 * Simplified version of App.jsx for the admin-wide chat sidebar.
 * No TabPanel, no AbilityBrowser, no permalink check, no beforeunload warning.
 * Renders ModelStatus (compact) + ChatContainer within a fixed sidebar.
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import ChatContainer from './ChatContainer';
import ModelStatus from './ModelStatus';
import WebGPUFallback from './WebGPUFallback';
import modelLoader from '../services/model-loader';
import { createLogger } from '../utils/logger';

const log = createLogger( 'AdminSidebar' );

const AdminSidebar = () => {
	const [ modelReady, setModelReady ] = useState( false );
	const [ webGPUError, setWebGPUError ] = useState( null );
	const [ isExecuting, setIsExecuting ] = useState( false );
	const [ initPhase, setInitPhase ] = useState( 'checking' );
	const [ initMessage, setInitMessage ] = useState(
		'Checking WebGPU support...'
	);
	const [ initProgress, setInitProgress ] = useState( 5 );

	/**
	 * Background WebGPU check and auto-load cached model on mount
	 */
	useEffect( () => {
		const initializeApp = async () => {
			try {
				setInitMessage( 'Checking WebGPU support...' );
				setInitProgress( 10 );
				const result = await modelLoader.checkWebGPUSupport();
				if ( ! result.supported ) {
					setWebGPUError( result.reason );
					setInitPhase( null );
					return;
				}

				setInitMessage( 'Checking model status...' );
				setInitProgress( 20 );
				if ( modelLoader.isModelReady() ) {
					setModelReady( true );
					setInitPhase( null );
					return;
				}

				setInitMessage( 'Checking cache...' );
				setInitProgress( 30 );
				const isCached = await modelLoader.isModelCached();

				if ( isCached ) {
					log.info( 'Model is cached, auto-loading...' );
					setInitPhase( 'loading' );
					setInitMessage( 'Loading from cache...' );
					setInitProgress( 35 );
					try {
						await modelLoader.load();
						setModelReady( true );
					} catch ( loadErr ) {
						log.error( 'Auto-load failed:', loadErr );
					}
				}
				setInitPhase( null );
			} catch ( err ) {
				log.error( 'Initialization failed:', err );
				setInitPhase( null );
			}
		};

		initializeApp();
	}, [] );

	const handleModelReady = useCallback( () => {
		setModelReady( true );
		setWebGPUError( null );
	}, [] );

	const handleModelError = useCallback( ( errorMessage ) => {
		setModelReady( false );
		if (
			errorMessage.includes( 'WebGPU' ) ||
			errorMessage.includes( 'GPU' )
		) {
			setWebGPUError( errorMessage );
		}
	}, [] );

	return (
		<div className="wp-agentic-admin-sidebar__inner">
			<div className="wp-agentic-admin-sidebar__header">
				<span className="dashicons dashicons-superhero-alt" />
				<strong>AI Assistant</strong>
			</div>

			<ModelStatus
				onModelReady={ handleModelReady }
				onModelError={ handleModelError }
				initPhase={ initPhase }
				initMessage={ initMessage }
				initProgress={ initProgress }
			/>

			{ webGPUError && ! modelReady ? (
				<WebGPUFallback reason={ webGPUError } />
			) : (
				<ChatContainer
					modelReady={ modelReady }
					isLoading={ isExecuting }
					setIsLoading={ setIsExecuting }
				/>
			) }
		</div>
	);
};

export default AdminSidebar;
