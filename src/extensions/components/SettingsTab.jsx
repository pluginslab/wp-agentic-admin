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
	FlexBlock,
	FlexItem,
	ProgressBar,
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
import {
	buildIndex,
	clearIndex,
	getKBStatus,
	subscribe as kbSubscribe,
	isBuilding as kbIsBuilding,
	getProgress as kbGetProgress,
	getError as kbGetError,
} from '../services/knowledge-base';

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
 * Format a timestamp as a relative time string.
 *
 * @param {number} timestamp Unix timestamp in milliseconds.
 * @return {string} Relative time (e.g. "2 hours ago").
 */
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

function timeAgo( timestamp ) {
	const seconds = Math.floor( ( Date.now() - timestamp ) / 1000 );
	if ( seconds < 60 ) {
		return 'just now';
	}
	const minutes = Math.floor( seconds / 60 );
	if ( minutes < 60 ) {
		return `${ minutes } minute${ minutes !== 1 ? 's' : '' } ago`;
	}
	const hours = Math.floor( minutes / 60 );
	if ( hours < 24 ) {
		return `${ hours } hour${ hours !== 1 ? 's' : '' } ago`;
	}
	const days = Math.floor( hours / 24 );
	return `${ days } day${ days !== 1 ? 's' : '' } ago`;
}

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
	// Knowledge Base — read from singleton so state survives tab switches.
	const [ kbStatus, setKbStatus ] = useState( getKBStatus );
	const [ kbBuilding, setKbBuilding ] = useState( kbIsBuilding );
	const [ kbProgress, setKbProgress ] = useState( kbGetProgress );
	const [ kbError, setKbError ] = useState( kbGetError );

	useEffect( () => {
		return kbSubscribe( () => {
			setKbBuilding( kbIsBuilding() );
			setKbProgress( kbGetProgress() );
			setKbError( kbGetError() );
			if ( ! kbIsBuilding() ) {
				setKbStatus( getKBStatus() );
			}
		} );
	}, [] );

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

	const handleBuildIndex = async () => {
		try {
			await buildIndex();
		} catch {
			// Error is already stored in the singleton and surfaced via subscribe.
		}
	};

	const handleClearIndex = async () => {
		try {
			await clearIndex();
		} catch {
			// Error surfaced via subscribe.
		}
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
					<h3 style={ { margin: 0 } }>Knowledge Base</h3>
				</CardHeader>
				<CardBody>
					<VStack spacing={ 3 }>
						<HStack
							alignment="center"
							justify="space-between"
							spacing={ 3 }
						>
							<FlexBlock>
								<p style={ { margin: 0 } }>
									Build a local search index from your
									site&apos;s code, database schema, WordPress
									API signatures, and reference documentation.
									The AI assistant automatically consults this
									knowledge base when answering questions.
								</p>
							</FlexBlock>
							<FlexItem>
								<HStack spacing={ 2 } justify="flex-end">
									<Button
										variant="primary"
										onClick={ handleBuildIndex }
										disabled={ kbBuilding }
										isBusy={ kbBuilding }
									>
										{ kbStatus
											? 'Rebuild Index'
											: 'Build Index' }
									</Button>
									{ kbStatus && ! kbBuilding && (
										<Button
											variant="tertiary"
											isDestructive
											onClick={ handleClearIndex }
										>
											Clear Index
										</Button>
									) }
								</HStack>
							</FlexItem>
						</HStack>

						{ kbStatus && ! kbBuilding && (
							<VStack spacing={ 2 }>
								<InfoRow label="Last built">
									{ timeAgo( kbStatus.lastIndexed ) }
								</InfoRow>
								<InfoRow label="Total chunks">
									{ kbStatus.totalChunks.toLocaleString() }
								</InfoRow>
								<InfoRow label="Code files">
									{ kbStatus.codeFiles }
								</InfoRow>
								<InfoRow label="DB tables">
									{ kbStatus.schemaTables }
								</InfoRow>
								<InfoRow label="API signatures">
									{ kbStatus.apiChunks } chunks
								</InfoRow>
								<InfoRow label="Reference docs">
									{ kbStatus.docsChunks } chunks
								</InfoRow>
							</VStack>
						) }

						{ kbBuilding && kbProgress && (
							<VStack spacing={ 2 }>
								<p style={ { margin: 0 } }>
									{ kbProgress.message }
								</p>
								<ProgressBar value={ kbProgress.percent } />
							</VStack>
						) }

						{ kbError && (
							<Notice
								status="error"
								isDismissible={ true }
								onDismiss={ () => setKbError( null ) }
							>
								{ kbError }
							</Notice>
						) }
					</VStack>
				</CardBody>
			</Card>

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
