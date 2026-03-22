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
import {
	buildIndex,
	clearIndex,
	getKBStatus,
} from '../services/knowledge-base';

const CONTEXT_OPTIONS = [
	{ label: '2,048 tokens (minimal)', value: '2048' },
	{ label: '4,096 tokens (conservative)', value: '4096' },
	{ label: '8,192 tokens (balanced)', value: '8192' },
	{ label: '16,384 tokens (generous)', value: '16384' },
	{ label: '32,768 tokens (maximum)', value: '32768' },
];

const REMOTE_CONTEXT_OPTIONS = [
	{ label: '8,192 tokens', value: '8192' },
	{ label: '16,384 tokens', value: '16384' },
	{ label: '32,768 tokens (default)', value: '32768' },
	{ label: '65,536 tokens', value: '65536' },
	{ label: '131,072 tokens (128K)', value: '131072' },
];

const STORAGE_KEY = 'wp_agentic_admin_context_size';
const REMOTE_CONTEXT_KEY = 'wp_agentic_admin_remote_context_size';

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

/**
 * Format a timestamp as a relative time string.
 *
 * @param {number} timestamp Unix timestamp in milliseconds.
 * @return {string} Relative time (e.g. "2 hours ago").
 */
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
	const [ remoteContextSize, setRemoteContextSize ] = useState( () => {
		try {
			return localStorage.getItem( REMOTE_CONTEXT_KEY ) || '32768';
		} catch {
			return '32768';
		}
	} );
	const [ remoteContextSaved, setRemoteContextSaved ] = useState( false );

	// Knowledge Base state
	const [ kbStatus, setKbStatus ] = useState( getKBStatus );
	const [ kbBuilding, setKbBuilding ] = useState( false );
	const [ kbProgress, setKbProgress ] = useState( null );
	const [ kbError, setKbError ] = useState( null );

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
		setKbBuilding( true );
		setKbError( null );
		setKbProgress( {
			phase: 'starting',
			message: 'Starting...',
			percent: 0,
		} );

		try {
			const status = await buildIndex( ( progress ) => {
				setKbProgress( progress );
			} );
			setKbStatus( status );
		} catch ( err ) {
			setKbError( err.message );
		} finally {
			setKbBuilding( false );
		}
	};

	const handleClearIndex = async () => {
		try {
			await clearIndex();
			setKbStatus( null );
			setKbProgress( null );
		} catch ( err ) {
			setKbError( err.message );
		}
	};

	const estimatedVRAM = modelLoader.getEstimatedVRAM();

	return (
		<div className="wp-agentic-admin-settings-tab">
			<Card>
				<CardHeader>
					<h3 style={ { margin: 0 } }>Knowledge Base</h3>
				</CardHeader>
				<CardBody>
					<p
						className="wp-agentic-admin-settings-tab__description"
						style={ { marginTop: 0 } }
					>
						Build a local search index from your site&apos;s code,
						database schema, WordPress API signatures, and reference
						documentation. The AI assistant automatically consults
						this knowledge base when answering questions.
					</p>

					{ kbStatus && ! kbBuilding && (
						<table
							className="wp-agentic-admin-settings-tab__gpu-table"
							style={ { marginBottom: '16px' } }
						>
							<tbody>
								<tr>
									<td>
										<strong>Last built</strong>
									</td>
									<td>{ timeAgo( kbStatus.lastIndexed ) }</td>
								</tr>
								<tr>
									<td>
										<strong>Total chunks</strong>
									</td>
									<td>
										{ kbStatus.totalChunks.toLocaleString() }
									</td>
								</tr>
								<tr>
									<td>
										<strong>Code files</strong>
									</td>
									<td>{ kbStatus.codeFiles }</td>
								</tr>
								<tr>
									<td>
										<strong>DB tables</strong>
									</td>
									<td>{ kbStatus.schemaTables }</td>
								</tr>
								<tr>
									<td>
										<strong>API signatures</strong>
									</td>
									<td>{ kbStatus.apiChunks } chunks</td>
								</tr>
								<tr>
									<td>
										<strong>Reference docs</strong>
									</td>
									<td>{ kbStatus.docsChunks } chunks</td>
								</tr>
							</tbody>
						</table>
					) }

					{ kbBuilding && kbProgress && (
						<div style={ { marginBottom: '16px' } }>
							<p style={ { margin: '0 0 8px' } }>
								{ kbProgress.message }
							</p>
							<div
								style={ {
									background: '#e0e0e0',
									borderRadius: '4px',
									height: '8px',
									overflow: 'hidden',
								} }
							>
								<div
									style={ {
										background: '#007cba',
										height: '100%',
										width: `${ kbProgress.percent }%`,
										transition: 'width 0.3s ease',
									} }
								/>
							</div>
						</div>
					) }

					{ kbError && (
						<Notice
							status="error"
							isDismissible={ true }
							onDismiss={ () => setKbError( null ) }
							style={ { marginBottom: '12px' } }
						>
							{ kbError }
						</Notice>
					) }

					<div
						className="wp-agentic-admin-settings-tab__actions"
						style={ { display: 'flex', gap: '8px' } }
					>
						<Button
							variant="primary"
							onClick={ handleBuildIndex }
							disabled={ kbBuilding }
							isBusy={ kbBuilding }
						>
							{ kbStatus ? 'Rebuild Index' : 'Build Index' }
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
					</div>
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
							{ rec && (
								<p className="wp-agentic-admin-settings-tab__reasoning">
									{ rec.reasoning }
								</p>
							) }

							<div className="wp-agentic-admin-settings-tab__controls">
								<SelectControl
									label="Context window size"
									value={ selectedValue }
									options={ CONTEXT_OPTIONS.map(
										( opt ) => ( {
											...opt,
											label:
												rec &&
												String( rec.recommended ) ===
													opt.value
													? opt.label +
													  ' - Recommended'
													: opt.label,
										} )
									) }
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

			<h3>Remote Provider Context Window</h3>
			<p className="wp-agentic-admin-settings-tab__description">
				When using a remote LLM provider (Ollama, LM Studio, OpenAI,
				etc.), this sets the context window size for token tracking.
				Remote models typically support much larger contexts than local
				WebLLM models.
			</p>

			<Card>
				<CardBody>
					<div className="wp-agentic-admin-settings-tab__controls">
						<SelectControl
							label="Remote context window size"
							value={ remoteContextSize }
							options={ REMOTE_CONTEXT_OPTIONS }
							onChange={ ( val ) => {
								setRemoteContextSize( val );
								setRemoteContextSaved( false );
							} }
						/>
						<div className="wp-agentic-admin-settings-tab__actions">
							<Button
								variant="primary"
								onClick={ () => {
									localStorage.setItem(
										REMOTE_CONTEXT_KEY,
										remoteContextSize
									);
									setRemoteContextSaved( true );
									setTimeout(
										() => setRemoteContextSaved( false ),
										3000
									);
								} }
							>
								Save
							</Button>
						</div>
					</div>
					{ remoteContextSaved && (
						<Notice
							status="success"
							isDismissible={ false }
							style={ { marginTop: '12px' } }
						>
							Remote context window updated.
						</Notice>
					) }
				</CardBody>
			</Card>

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
