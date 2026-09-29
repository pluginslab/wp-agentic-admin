/**
 * Model Source Card
 *
 * Lets the site owner set where the local engine downloads model files
 * from. Saved to the agentic_admin_model_source option through the core
 * /wp/v2/settings endpoint (requires manage_options).
 */

import { useState, useEffect } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import {
	Button,
	Card,
	CardBody,
	CardHeader,
	Notice,
	TextControl,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import {
	getModelSource,
	setModelSource,
	isModelSourceConfigured,
	subscribe,
} from '../services/model-source';

const ModelSourceCard = () => {
	const canManage = Boolean(
		window.agenticAdmin?.settings?.canManageOptions
	);
	const saved = getModelSource();
	const [ weightsUrl, setWeightsUrl ] = useState( saved.weights_url );
	const [ libraryUrl, setLibraryUrl ] = useState( saved.library_url );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ notice, setNotice ] = useState( null );
	const [ sourceReady, setSourceReady ] = useState( isModelSourceConfigured );

	useEffect(
		() => subscribe( () => setSourceReady( isModelSourceConfigured() ) ),
		[]
	);

	// Scroll into view when opened from a #model-source link.
	useEffect( () => {
		if ( window.location.hash === '#model-source' ) {
			document
				.getElementById( 'agentic-admin-model-source' )
				?.scrollIntoView( { behavior: 'smooth', block: 'start' } );
		}
	}, [] );

	const handleSave = async () => {
		setIsSaving( true );
		setNotice( null );
		try {
			const response = await apiFetch( {
				path: '/wp/v2/settings',
				method: 'POST',
				data: {
					agentic_admin_model_source: {
						weights_url: weightsUrl,
						library_url: libraryUrl,
					},
				},
			} );
			const stored = response.agentic_admin_model_source || {};
			setModelSource( stored );
			setWeightsUrl( stored.weights_url || '' );
			setLibraryUrl( stored.library_url || '' );
			setNotice( { status: 'success', text: 'Model source saved.' } );
		} catch ( err ) {
			setNotice( {
				status: 'error',
				text: err?.message || 'Could not save the model source.',
			} );
		} finally {
			setIsSaving( false );
		}
	};

	return (
		<Card id="agentic-admin-model-source">
			<CardHeader>
				<h3 style={ { margin: 0 } }>Model source</h3>
			</CardHeader>
			<CardBody>
				<VStack spacing={ 3 }>
					<p style={ { margin: 0 } }>
						The local engine downloads the AI model from the
						addresses below, and from nowhere else. The plugin has
						no default: you choose the source. The addresses of the
						models published by the MLC-AI project are listed in the
						plugin&apos;s readme, under External services. You can
						also host the same files yourself.
					</p>
					{ ! sourceReady && (
						<Notice status="warning" isDismissible={ false }>
							No model source is set, so the local engine is off.
							The Remote and Connector engines still work.
						</Notice>
					) }
					<TextControl
						__nextHasNoMarginBottom
						label="Model weights URL"
						help="One folder per model, laid out as <model-id>/resolve/main/ (the Hugging Face layout)."
						type="url"
						value={ weightsUrl }
						onChange={ setWeightsUrl }
						disabled={ ! canManage || isSaving }
					/>
					<TextControl
						__nextHasNoMarginBottom
						label="Model library URL"
						help="One folder per WebLLM version (for example v0_2_80) holding the compiled model libraries (.wasm). The plugin adds the version it needs."
						type="url"
						value={ libraryUrl }
						onChange={ setLibraryUrl }
						disabled={ ! canManage || isSaving }
					/>
					{ canManage ? (
						<div>
							<Button
								variant="primary"
								onClick={ handleSave }
								isBusy={ isSaving }
								disabled={ isSaving }
							>
								Save model source
							</Button>
						</div>
					) : (
						<p style={ { margin: 0 } }>
							Only administrators can change the model source.
						</p>
					) }
					{ notice && (
						<Notice
							status={ notice.status }
							onDismiss={ () => setNotice( null ) }
						>
							{ notice.text }
						</Notice>
					) }
				</VStack>
			</CardBody>
		</Card>
	);
};

export default ModelSourceCard;
