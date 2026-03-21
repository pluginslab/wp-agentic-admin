/**
 * Settings Tab — Context Window Recommendations
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import {
	Button,
	Card,
	CardBody,
	CardHeader,
	SelectControl,
	Notice,
	ToggleControl,
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

const STORAGE_KEY = 'wp_agentic_admin_context_size';

const TIER_COLORS = {
	minimal: '#d63638',
	conservative: '#dba617',
	balanced: '#00a32a',
	generous: '#2271b1',
	maximum: '#8c1aff',
	unknown: '#757575',
};

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

const THINKING_STORAGE_KEY = 'wp_agentic_admin_thinking';

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

		// Initialize selected sizes from saved or defaults
		const initial = {};
		const saved = getSavedContextSizes();
		for ( const model of models ) {
			initial[ model.id ] = String(
				saved[ model.id ] ||
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

	const handleApplyRecommendation = ( modelId ) => {
		const rec = recommendations[ modelId ];
		if ( ! rec ) {
			return;
		}
		setSelectedSizes( ( prev ) => ( {
			...prev,
			[ modelId ]: String( rec.recommended ),
		} ) );
	};

	const estimatedVRAM = modelLoader.getEstimatedVRAM();

	return (
		<div className="wp-agentic-admin-settings-tab">
			<Card>
				<CardHeader>
					<h3 style={ { margin: 0 } }>GPU Information</h3>
				</CardHeader>
				<CardBody>
					{ detecting ? (
						<p>Detecting GPU capabilities...</p>
					) : gpuInfo ? (
						<table className="wp-agentic-admin-settings-tab__gpu-table">
							<tbody>
								<tr>
									<td>
										<strong>Device</strong>
									</td>
									<td>{ gpuInfo.device }</td>
								</tr>
								<tr>
									<td>
										<strong>Vendor</strong>
									</td>
									<td>{ gpuInfo.vendor }</td>
								</tr>
								{ gpuInfo.architecture !== 'Unknown' && (
									<tr>
										<td>
											<strong>Architecture</strong>
										</td>
										<td>{ gpuInfo.architecture }</td>
									</tr>
								) }
								<tr>
									<td>
										<strong>Max Buffer Size</strong>
									</td>
									<td>
										{ gpuInfo.maxBufferSize
											? `${ (
													gpuInfo.maxBufferSize /
													1024 ** 3
											  ).toFixed( 2 ) } GB`
											: 'Unknown' }
									</td>
								</tr>
								<tr>
									<td>
										<strong>Estimated VRAM</strong>
									</td>
									<td>
										{ estimatedVRAM > 0
											? `~${ estimatedVRAM } GB`
											: 'Unknown' }
									</td>
								</tr>
							</tbody>
						</table>
					) : (
						<Notice status="warning" isDismissible={ false }>
							Could not detect GPU. WebGPU may not be supported in
							this browser.
						</Notice>
					) }
				</CardBody>
			</Card>

			<h3>Context Window per Model</h3>
			<p className="wp-agentic-admin-settings-tab__description">
				The context window determines how much conversation history and
				tool data the model can process. Larger windows use more GPU
				memory for the KV cache. Choose based on your available VRAM.
			</p>

			{ models.map( ( model ) => {
				const rec = recommendations[ model.id ];
				const currentDefault =
					MODEL_CONTEXT_SIZES[ model.id ] ||
					MODEL_CONTEXT_SIZES.default;
				const selectedValue =
					selectedSizes[ model.id ] || String( currentDefault );
				const isChanged =
					parseInt( selectedValue, 10 ) !==
					( savedSizes[ model.id ] || currentDefault );

				return (
					<Card
						key={ model.id }
						className="wp-agentic-admin-settings-tab__model-card"
					>
						<CardHeader>
							<h4 style={ { margin: 0 } }>
								{ model.name }
								<span className="wp-agentic-admin-settings-tab__model-size">
									{ model.size } download / { model.vram }{ ' ' }
									VRAM
								</span>
							</h4>
						</CardHeader>
						<CardBody>
							{ rec && rec.tier !== 'unknown' && (
								<div className="wp-agentic-admin-settings-tab__recommendation">
									<span
										className="wp-agentic-admin-settings-tab__tier-badge"
										style={ {
											background:
												TIER_COLORS[ rec.tier ] ||
												TIER_COLORS.unknown,
										} }
									>
										{ rec.tier }
									</span>
									<span className="wp-agentic-admin-settings-tab__rec-text">
										Recommended:{ ' ' }
										<strong>
											{ rec.recommended.toLocaleString() }{ ' ' }
											tokens
										</strong>
									</span>
									<Button
										variant="link"
										onClick={ () =>
											handleApplyRecommendation(
												model.id
											)
										}
									>
										Apply
									</Button>
								</div>
							) }
							{ rec && (
								<p className="wp-agentic-admin-settings-tab__reasoning">
									{ rec.reasoning }
								</p>
							) }

							<div className="wp-agentic-admin-settings-tab__controls">
								<SelectControl
									label="Context window size"
									value={ selectedValue }
									options={ CONTEXT_OPTIONS }
									onChange={ ( val ) =>
										setSelectedSizes( ( prev ) => ( {
											...prev,
											[ model.id ]: val,
										} ) )
									}
								/>
								<div className="wp-agentic-admin-settings-tab__actions">
									<Button
										variant="primary"
										onClick={ () => handleSave( model.id ) }
										disabled={ ! isChanged }
									>
										Save
									</Button>
								</div>
							</div>

							{ savedNotice === model.id && (
								<Notice
									status="success"
									isDismissible={ false }
									style={ { marginTop: '12px' } }
								>
									Context window updated. Changes take effect
									on next model load.
								</Notice>
							) }
						</CardBody>
					</Card>
				);
			} ) }

			<h3>Thinking Mode</h3>
			<p className="wp-agentic-admin-settings-tab__description">
				Qwen 3 models use a thinking step ({ '<think>...</think>' })
				before responding. Disabling thinking makes responses faster but
				may reduce reasoning quality.
			</p>

			<Card>
				<CardBody>
					<ToggleControl
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
				</CardBody>
			</Card>
		</div>
	);
};

export default SettingsTab;
