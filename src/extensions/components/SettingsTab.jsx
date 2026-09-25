/**
 * Settings Tab — Context Window Recommendations
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import {
	Button,
	Card,
	CardBody,
	CardFooter,
	CardHeader,
	SelectControl,
	Notice,
	ToggleControl,
	__experimentalVStack as VStack,
	__experimentalHStack as HStack,
} from '@wordpress/components';
import modelLoader, {
	ModelLoader,
	MODEL_CONTEXT_SIZES,
} from '../services/model-loader';

const CONTEXT_OPTIONS = [
	{ label: '2,048 tokens (minimal)', value: '2048' },
	{ label: '4,096 tokens (conservative)', value: '4096' },
	{ label: '8,192 tokens (balanced)', value: '8192' },
	{ label: '16,384 tokens (generous)', value: '16384' },
	{ label: '32,768 tokens (maximum)', value: '32768' },
];

const STORAGE_KEY = 'agentic_admin_context_size';

function getSavedContextSizes() {
	try {
		const saved = localStorage.getItem( STORAGE_KEY );
		return saved ? JSON.parse( saved ) : {};
	} catch {
		return {};
	}
}

function saveContextSize( modelId, size ) {
	const saved = getSavedContextSizes();
	saved[ modelId ] = size;
	localStorage.setItem( STORAGE_KEY, JSON.stringify( saved ) );
}

const THINKING_STORAGE_KEY = 'agentic_admin_thinking';

function getSavedThinkingPrefs() {
	try {
		const saved = localStorage.getItem( THINKING_STORAGE_KEY );
		return saved
			? JSON.parse( saved )
			: {
					disableThinkingBeforeTool: false,
					disableThinkingAfterTool: false,
			  };
	} catch {
		return {
			disableThinkingBeforeTool: false,
			disableThinkingAfterTool: false,
		};
	}
}

function saveThinkingPrefs( prefs ) {
	localStorage.setItem( THINKING_STORAGE_KEY, JSON.stringify( prefs ) );
}

/**
 * Render a label/value pair as a HStack row. Used in place of the
 * old hand-rolled .agentic-admin-settings-tab__gpu-table.
 * @param root0
 * @param root0.label
 * @param root0.children
 */
const InfoRow = ( { label, children } ) => (
	<HStack justify="flex-start" spacing={ 4 }>
		<span style={ { color: '#646970', minWidth: '160px' } }>{ label }</span>
		<span>{ children }</span>
	</HStack>
);

const SettingsTab = () => {
	const [ gpuInfo, setGpuInfo ] = useState( null );
	const [ recommendations, setRecommendations ] = useState( {} );
	const [ savedSizes, setSavedSizes ] = useState( getSavedContextSizes() );
	const [ selectedSizes, setSelectedSizes ] = useState( {} );
	const [ savedNotice, setSavedNotice ] = useState( null );
	const [ detecting, setDetecting ] = useState( true );
	const [ thinkingPrefs, setThinkingPrefs ] = useState(
		getSavedThinkingPrefs
	);

	const models = ModelLoader.getAvailableModels();

	const detectGPU = useCallback( async () => {
		setDetecting( true );

		// If GPU info already detected (model loaded), use cached
		let info = modelLoader.getGPUInfo();
		if ( ! info ) {
			await modelLoader.checkWebGPUSupport();
			info = modelLoader.getGPUInfo();
		}
		setGpuInfo( info );

		// Build recommendations for each model
		const recs = {};
		for ( const model of models ) {
			recs[ model.id ] = modelLoader.getRecommendedContextSize(
				model.id
			);
		}
		setRecommendations( recs );

		// Initialize selected sizes from saved, recommendation, or defaults
		const initial = {};
		const saved = getSavedContextSizes();
		for ( const model of models ) {
			initial[ model.id ] = String(
				saved[ model.id ] ||
					recs[ model.id ]?.recommended ||
					MODEL_CONTEXT_SIZES[ model.id ] ||
					MODEL_CONTEXT_SIZES.default
			);
		}
		setSelectedSizes( initial );
		setDetecting( false );
	}, [ models ] );

	useEffect( () => {
		detectGPU();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
	}, [] );

	const handleSave = ( modelId ) => {
		const size = parseInt( selectedSizes[ modelId ], 10 );
		saveContextSize( modelId, size );
		setSavedSizes( getSavedContextSizes() );
		setSavedNotice( modelId );
		setTimeout( () => setSavedNotice( null ), 3000 );
	};

	const estimatedVRAM = modelLoader.getEstimatedVRAM();

	return (
		<div className="agentic-admin-settings-tab agentic-admin-tab-padded">
			<div className="agentic-admin-settings-tab__header">
				<h3 className="agentic-admin-settings-tab__title">Settings</h3>
				<p className="agentic-admin-settings-tab__intro">
					Configure GPU, context windows, and model behavior.
				</p>
			</div>
			<Card>
				<CardHeader>
					<h3 style={ { margin: 0 } }>GPU Information</h3>
				</CardHeader>
				<CardBody>
					{ detecting ? (
						<p>Detecting GPU capabilities...</p>
					) : gpuInfo ? (
						<VStack spacing={ 2 }>
							<InfoRow label="Device">{ gpuInfo.device }</InfoRow>
							<InfoRow label="Vendor">{ gpuInfo.vendor }</InfoRow>
							{ gpuInfo.architecture !== 'Unknown' && (
								<InfoRow label="Architecture">
									{ gpuInfo.architecture }
								</InfoRow>
							) }
							<InfoRow label="Max Buffer Size">
								{ gpuInfo.maxBufferSize
									? `${ (
											gpuInfo.maxBufferSize /
											1024 ** 3
									  ).toFixed( 2 ) } GB`
									: 'Unknown' }
							</InfoRow>
							<InfoRow label="Estimated VRAM">
								{ estimatedVRAM > 0
									? `~${ estimatedVRAM } GB`
									: 'Unknown' }
							</InfoRow>
						</VStack>
					) : (
						<Notice status="warning" isDismissible={ false }>
							Could not detect GPU. WebGPU may not be supported in
							this browser.
						</Notice>
					) }
				</CardBody>
			</Card>

			<Card>
				<CardHeader>
					<VStack spacing={ 1 }>
						<h3 style={ { margin: 0 } }>
							Context Window per Model
						</h3>
						<p>
							The context window determines how much conversation
							history and tool data the model can process. Larger
							windows use more GPU memory for the KV cache. Choose
							based on your available VRAM.
						</p>
					</VStack>
				</CardHeader>
				<CardBody>
					<div className="agentic-admin-ability-grid">
						{ models.map( ( model ) => {
							const rec = recommendations[ model.id ];
							const currentDefault =
								MODEL_CONTEXT_SIZES[ model.id ] ||
								MODEL_CONTEXT_SIZES.default;
							const selectedValue =
								selectedSizes[ model.id ] ||
								String( currentDefault );
							const isChanged =
								parseInt( selectedValue, 10 ) !==
								( savedSizes[ model.id ] || currentDefault );

							return (
								<Card
									key={ model.id }
									isBorderless={ false }
									size="medium"
								>
									<CardHeader>
										<VStack spacing={ 1 }>
											<strong>{ model.name }</strong>
											<span>
												{ model.size } download /{ ' ' }
												{ model.vram } VRAM
											</span>
										</VStack>
									</CardHeader>
									<CardBody>
										<VStack spacing={ 3 }>
											{ rec && <p>{ rec.reasoning }</p> }
											<SelectControl
												__nextHasNoMarginBottom
												label="Context window size"
												value={ selectedValue }
												options={ CONTEXT_OPTIONS.map(
													( opt ) => ( {
														...opt,
														label:
															rec &&
															String(
																rec.recommended
															) === opt.value
																? opt.label +
																  ' - Recommended'
																: opt.label,
													} )
												) }
												onChange={ ( val ) =>
													setSelectedSizes(
														( prev ) => ( {
															...prev,
															[ model.id ]: val,
														} )
													)
												}
											/>
											{ savedNotice === model.id && (
												<Notice
													status="success"
													isDismissible={ false }
												>
													Saved.
												</Notice>
											) }
										</VStack>
									</CardBody>
									<CardFooter>
										<Button
											variant="primary"
											onClick={ () =>
												handleSave( model.id )
											}
											disabled={ ! isChanged }
										>
											Save
										</Button>
									</CardFooter>
								</Card>
							);
						} ) }
					</div>
				</CardBody>
			</Card>

			<Card>
				<CardHeader>
					<VStack spacing={ 1 }>
						<h3 style={ { margin: 0 } }>Thinking Mode</h3>
						<p>
							Qwen 3 models use a thinking step (
							{ '<think>...</think>' }) before responding.
							Disabling thinking makes responses faster but may
							reduce reasoning quality.
						</p>
					</VStack>
				</CardHeader>
				<CardBody>
					<VStack spacing={ 3 }>
						<ToggleControl
							__nextHasNoMarginBottom
							label="Disable thinking before tool selection"
							help="Skip the reasoning step when the model decides which tool to call. Faster but may pick the wrong tool for complex requests."
							checked={ thinkingPrefs.disableThinkingBeforeTool }
							onChange={ ( val ) => {
								const updated = {
									...thinkingPrefs,
									disableThinkingBeforeTool: val,
								};
								setThinkingPrefs( updated );
								saveThinkingPrefs( updated );
							} }
						/>
						<ToggleControl
							__nextHasNoMarginBottom
							label="Disable thinking after tool results"
							help="Skip the reasoning step when the model summarizes tool output. Faster responses after tool execution."
							checked={ thinkingPrefs.disableThinkingAfterTool }
							onChange={ ( val ) => {
								const updated = {
									...thinkingPrefs,
									disableThinkingAfterTool: val,
								};
								setThinkingPrefs( updated );
								saveThinkingPrefs( updated );
							} }
						/>
					</VStack>
				</CardBody>
			</Card>
		</div>
	);
};

export default SettingsTab;
