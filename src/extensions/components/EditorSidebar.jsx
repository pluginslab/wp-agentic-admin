/**
 * Editor Sidebar Component
 *
 * Simplified version of App.jsx for the block editor PluginSidebar.
 * No TabPanel, no AbilityBrowser, no permalink check, no beforeunload warning.
 * Renders ModelStatus (compact) + ChatContainer within the sidebar.
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import ChatContainer from './ChatContainer';
import ModelStatus from './ModelStatus';
import WebGPUFallback from './WebGPUFallback';
import modelLoader from '../services/model-loader';
import { getBundleById } from '../data/ability-bundles';
import { createLogger } from '../utils/logger';

const log = createLogger( 'EditorSidebar' );

const EditorSidebar = () => {
	// Auto-select "Create Content" bundle on blank pages (no title, no blocks)
	const isBlankPage = useSelect( ( select ) => {
		const title =
			select( 'core/editor' ).getEditedPostAttribute( 'title' ) || '';
		const blocks = select( 'core/block-editor' ).getBlocks();
		// Blank = no title and either no blocks or a single empty paragraph
		const hasNoContent =
			blocks.length === 0 ||
			( blocks.length === 1 &&
				blocks[ 0 ].name === 'core/paragraph' &&
				! blocks[ 0 ].attributes?.content );
		return ! title.trim() && hasNoContent;
	}, [] );
	const defaultBundle = isBlankPage
		? getBundleById( 'content-create' )
		: null;

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
		<div className="wp-agentic-admin-sidebar">
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
					defaultBundle={ defaultBundle }
				/>
			) }
		</div>
	);
};

export default EditorSidebar;
