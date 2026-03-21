/**
 * ChatContainer Component
 *
 * Main container for the chat interface using the ChatOrchestrator framework.
 * This component:
 * - Initializes the chat framework (tools, session, orchestrator) on mount
 * - Manages React state for messages and streaming UI
 * - Handles user input and routes to ChatOrchestrator
 * - Displays messages via MessageList component
 * - Shows confirmation modals for destructive actions
 *
 * ARCHITECTURE:
 * - ChatSession: Manages message history (persisted to localStorage)
 * - ChatOrchestrator: Coordinates LLM + tools + streaming
 * - registerWPTools(): Registers all WordPress tools with the ToolRegistry
 *
 * The orchestrator uses callbacks to update React state:
 * - onStreamStart/Chunk/End: For typewriter streaming effect
 * - onToolStart/End: For loading spinner during tool execution
 * - onMessageAdd: To update displayed messages
 * - onStateChange: To sync isProcessing state
 *
 */

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { Button, Modal, Notice, Snackbar } from '@wordpress/components';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import FeedbackOptInBanner from './FeedbackOptInBanner';
import {
	chatOrchestrator,
	ChatSession,
	registerWPTools,
	MessageType,
	modelLoader,
	getAbilities,
	getWorkflows,
	toolRegistry,
} from '../services';
import {
	getFeedbackOptIn,
	setFeedbackOptIn,
	saveFeedback,
	FEEDBACK_UPLOAD_ENABLED,
} from '../services/feedback';
import { executeAbility } from '../services/agentic-abilities-api';
import pluginAbilitiesManager from '../services/plugin-abilities-manager';
import { createLogger } from '../utils/logger';

const log = createLogger( 'ChatContainer' );

/**
 * ChatContainer component
 *
 * @param {Object}   props              - Component props
 * @param {boolean}  props.modelReady   - Whether AI model is loaded and ready
 * @param {boolean}  props.isLoading    - Whether a request is in progress
 * @param {Function} props.setIsLoading - Callback to set loading state
 * @return {JSX.Element} Rendered chat container
 */
const ChatContainer = ( {
	modelReady = false,
	isLoading = false,
	setIsLoading,
} ) => {
	// Messages state - managed by ChatSession but we need React state for re-renders
	const [ messages, setMessages ] = useState( [] );
	const [ streamingText, setStreamingText ] = useState( '' );
	const [ isStreaming, setIsStreaming ] = useState( false );
	const [ isExecutingTool, setIsExecutingTool ] = useState( false );
	const [ pendingConfirmation, setPendingConfirmation ] = useState( null );
	const [ contextUsage, setContextUsage ] = useState( null );

	// Thinking state — streams <think> blocks live while being generated
	const [ isThinking, setIsThinking ] = useState( false );
	const [ thinkingText, setThinkingText ] = useState( '' );

	// Workflow state
	const [ workflowProgress, setWorkflowProgress ] = useState( null );
	const [ isRunningWorkflow, setIsRunningWorkflow ] = useState( false );

	// Copy feedback state
	const [ showCopiedSnackbar, setShowCopiedSnackbar ] = useState( false );

	// Feedback opt-in state: null = not decided, true = opted in, false = declined
	const [ feedbackOptIn, setFeedbackOptInState ] = useState( () =>
		getFeedbackOptIn()
	);

	// Session ref to persist across renders
	const sessionRef = useRef( null );
	const initializedRef = useRef( false );
	const prevModelReadyRef = useRef( modelReady );

	/**
	 * Initialize the chat framework on mount
	 */
	useEffect( () => {
		if ( initializedRef.current ) {
			return;
		}
		initializedRef.current = true;

		log.info( 'Initializing chat framework...' );

		// Register WordPress tools
		registerWPTools();

		// Create and initialize session
		const session = new ChatSession( {
			storageKey: 'wp-agentic-admin-chat-session',
			onChange: ( msgs ) => {
				// Convert session messages to display format
				setMessages( convertMessagesToDisplay( msgs ) );
				// Auto-save session on change
				if ( sessionRef.current ) {
					sessionRef.current.save();
				}
			},
		} );
		sessionRef.current = session;

		// Load previous session if exists
		session.load();

		// Initialize orchestrator with session
		chatOrchestrator.initialize( session );

		// Set up orchestrator callbacks for UI updates
		chatOrchestrator.setCallbacks( {
			onStreamStart: () => {
				setIsStreaming( true );
				setStreamingText( '' );
			},
			onStreamChunk: ( chunk, fullText ) => {
				setStreamingText( fullText );
			},
			onStreamEnd: () => {
				setIsStreaming( false );
				setStreamingText( '' );
			},
			onThinkingStart: () => {
				setIsThinking( true );
				setThinkingText( '' );
			},
			onThinkingChunk: ( chunk, fullThinkText ) => {
				setThinkingText( fullThinkText );
			},
			onThinkingEnd: () => {
				setIsThinking( false );
				setThinkingText( '' );
			},
			onToolStart: () => {
				setIsExecutingTool( true );
			},
			onToolEnd: () => {
				setIsExecutingTool( false );
			},
			onMessageAdd: ( msgs ) => {
				setMessages( convertMessagesToDisplay( msgs ) );
			},
			onError: ( error ) => {
				log.error( 'Orchestrator error:', error );
			},
			onStateChange: ( { isProcessing } ) => {
				setIsLoading?.( isProcessing );
				// Update context usage after each message
				const usage = modelLoader.getContextUsage();
				setContextUsage( usage );
			},
			// Workflow callbacks
			onWorkflowStart: ( workflow ) => {
				setIsRunningWorkflow( true );
				setWorkflowProgress( {
					step: 0,
					total: workflow.steps?.length || 0,
					label: workflow.label,
					percentage: 0,
				} );
			},
			onWorkflowProgress: ( progress ) => {
				setWorkflowProgress( {
					step: progress.step,
					total: progress.total,
					label: progress.label,
					percentage: progress.percentage,
				} );
			},
			onWorkflowStepComplete: () => {
				// Progress is updated via onWorkflowProgress
			},
			onWorkflowComplete: () => {
				setIsRunningWorkflow( false );
				setWorkflowProgress( null );
			},
			onWorkflowFailed: () => {
				setIsRunningWorkflow( false );
				setWorkflowProgress( null );
			},
			// Intent confirmation callback
			onIntentConfirmationRequired: async ( tool, intent ) => {
				return new Promise( ( resolve ) => {
					setPendingConfirmation( {
						toolId: tool.id,
						label: tool.label || tool.id,
						message:
							tool.confirmationMessage || `Execute ${ tool.id }?`,
						isIntentConfirmation: true, // NEW flag for intent confirmation
						intent, // Include intent details (confidence, fuzzyMatches, etc.)
						resolve,
					} );
				} );
			},
		} );

		// Set up confirmation handler for destructive actions
		chatOrchestrator.setConfirmationHandler( ( tool ) => {
			return new Promise( ( resolve ) => {
				const isWorkflow = tool.isWorkflow || false;
				const workflowDetails = tool.workflowDetails || null;

				setPendingConfirmation( {
					toolId: tool.id,
					label: tool.label || tool.id,
					message:
						tool.confirmationMessage || `Execute ${ tool.id }?`,
					isDestructive:
						tool.isDestructive !== undefined
							? tool.isDestructive
							: true,
					isWorkflow,
					workflowDetails,
					resolve,
				} );
			} );
		} );

		// Add welcome message if session is empty
		if ( session.getMessageCount() === 0 ) {
			session.addAssistantMessage(
				"Hey there! I'm your WordPress assistant. Need help with site health, error logs, plugins, caching, or database optimization? Just ask!"
			);
		}

		// Test observability hook (for E2E browser tests)
		window.__wpAgenticTestHook = {
			getMessages: () => sessionRef.current?.getMessages() || [],
			getLastReactResult: () =>
				chatOrchestrator.reactAgent?.lastResult || null,
			getToolsUsed: () =>
				chatOrchestrator.reactAgent?.lastResult?.toolsUsed || [],
			getObservations: () =>
				chatOrchestrator.reactAgent?.lastResult?.observations || [],
			isProcessing: () => chatOrchestrator.getIsProcessing(),
			sendMessage: ( msg ) => chatOrchestrator.processMessage( msg ),
			clearChat: () => {
				sessionRef.current?.clear();
				setMessages( [] );
			},
		};

		return () => {
			// Save session on unmount
			session.save();
		};
	}, [ setIsLoading ] );

	/**
	 * Clear chat when model is unloaded (modelReady transitions true → false)
	 */
	useEffect( () => {
		if ( prevModelReadyRef.current && ! modelReady ) {
			if ( sessionRef.current ) {
				sessionRef.current.clear();
				setMessages( [] );
			}
		}
		prevModelReadyRef.current = modelReady;
	}, [ modelReady ] );

	/**
	 * Convert session messages to display format for MessageList
	 *
	 * @param {Array} sessionMessages - Messages from ChatSession
	 * @return {Array} Display-formatted messages
	 */
	const convertMessagesToDisplay = ( sessionMessages ) => {
		const display = sessionMessages.map( ( msg ) => {
			// Map session message types to display format
			switch ( msg.type ) {
				case MessageType.USER:
					return {
						id: msg.id,
						type: 'user',
						content: msg.content,
						timestamp: msg.timestamp,
					};
				case MessageType.ASSISTANT:
					return {
						id: msg.id,
						type: 'assistant',
						content: msg.content,
						timestamp: msg.timestamp,
						prefillTps: msg.meta?.prefillTps,
						decodeTps: msg.meta?.decodeTps,
					};
				case MessageType.TOOL_REQUEST:
					return {
						id: msg.id,
						type: 'ability_request',
						abilityName: msg.meta?.toolId,
						abilityLabel: msg.meta?.toolId?.split( '/' ).pop(),
						input: msg.meta?.params || {},
						timestamp: msg.timestamp,
					};
				case MessageType.TOOL_RESULT:
					return {
						id: msg.id,
						type: 'ability_result',
						abilityName: msg.meta?.toolId,
						result: msg.meta?.result,
						success: msg.meta?.success,
						timestamp: msg.timestamp,
					};
				case MessageType.THINKING:
					return {
						id: msg.id,
						type: 'thinking',
						content: msg.content,
						isStreaming: false,
						timestamp: msg.timestamp,
					};
				case MessageType.ERROR:
					return {
						id: msg.id,
						type: 'error',
						content: msg.content,
						error: msg.meta?.error,
						timestamp: msg.timestamp,
					};
				case MessageType.SYSTEM:
				default:
					return {
						id: msg.id,
						type: 'assistant',
						content: msg.content,
						timestamp: msg.timestamp,
					};
			}
		} );

		// Attach actions from tool results to the next assistant message
		for ( let i = 0; i < display.length - 1; i++ ) {
			const curr = display[ i ];
			const next = display[ i + 1 ];
			if (
				curr.type === 'ability_result' &&
				next.type === 'assistant' &&
				curr.result?.actions?.length
			) {
				next.actions = curr.result.actions;
			}
		}

		return display;
	};

	/**
	 * Handle sending a user message
	 *
	 * @param {string} text                  - User's message text
	 * @param {Object} options               - Send options
	 * @param {Array}  options.bundleToolIds - Tool IDs to constrain the LLM to
	 */
	const handleSendMessage = useCallback(
		async ( text, options = {} ) => {
			if ( ! text.trim() ) {
				return;
			}

			// Intercept /tools or /abilities slash command
			const trimmed = text.trim().toLowerCase();
			if ( trimmed === '/tools' || trimmed === '/abilities' ) {
				const abilities = getAbilities();
				const workflows = getWorkflows();

				setMessages( ( prev ) => [
					...prev,
					{
						id: `ability-picker-${ Date.now() }`,
						type: 'ability_picker',
						abilities,
						workflows,
						onExecute: ( id, args ) => {
							const tool =
								abilities.find( ( a ) => a.id === id ) ||
								workflows.find( ( w ) => w.id === id );
							if ( tool ) {
								const label = tool.label || tool.id;
								handleSendMessage(
									args ? `${ label } ${ args }` : label
								);
							}
						},
						isProcessing: isLoading,
						timestamp: new Date().toISOString(),
					},
				] );
				return;
			}

			// If model not ready, show placeholder response
			if ( ! modelReady ) {
				sessionRef.current?.addUserMessage( text );
				sessionRef.current?.addAssistantMessage(
					'The AI model is not loaded yet. Please click "Load Model" at the bottom of the page, or use the "Abilities" tab to manually test the available tools.'
				);
				return;
			}

			// Scope plugin abilities when a plugin bundle is active
			if ( options.pluginNamespace ) {
				pluginAbilitiesManager.scopeToPlugin( options.pluginNamespace );
			}

			// Process message through orchestrator
			try {
				await chatOrchestrator.processMessage( text, options );
			} catch ( error ) {
				log.error( 'Error processing message:', error );
			} finally {
				if ( options.pluginNamespace ) {
					pluginAbilitiesManager.clearPluginScope();
				}
			}
		},
		[ modelReady ]
	);

	/**
	 * Handle confirmation of destructive actions
	 */
	const handleConfirm = useCallback( () => {
		if ( pendingConfirmation ) {
			// If this is an intent confirmation, update the user message to the tool label
			if (
				pendingConfirmation.isIntentConfirmation &&
				pendingConfirmation.label
			) {
				const session = sessionRef.current;
				if ( session ) {
					// Replace the user's message with the tool label (e.g., "List installed plugins")
					session.updateLastUserMessage( pendingConfirmation.label );
				}
			}

			pendingConfirmation.resolve( true );
			setPendingConfirmation( null );
		}
	}, [ pendingConfirmation ] );

	/**
	 * Handle cancellation of destructive actions
	 */
	const handleCancel = useCallback( () => {
		if ( pendingConfirmation ) {
			pendingConfirmation.resolve( false );
			setPendingConfirmation( null );
		}
	}, [ pendingConfirmation ] );

	/**
	 * Clear chat history
	 */
	const clearHistory = useCallback( () => {
		chatOrchestrator.clearSession();
		sessionRef.current?.deleteSaved();

		// Reset context usage tracking
		modelLoader.resetContextUsage();
		setContextUsage( null );

		// Add welcome message back
		sessionRef.current?.addAssistantMessage(
			"Hey there! I'm your WordPress assistant. Need help with site health, error logs, plugins, caching, or database optimization? Just ask!"
		);
	}, [] );

	/**
	 * Handle feedback opt-in acceptance
	 */
	const handleFeedbackAccept = useCallback( () => {
		setFeedbackOptInState( true );
		setFeedbackOptIn( true );
	}, [] );

	/**
	 * Handle feedback opt-in decline
	 */
	const handleFeedbackDecline = useCallback( () => {
		setFeedbackOptInState( false );
		setFeedbackOptIn( false );
	}, [] );

	/**
	 * Handle thumbs feedback from a message
	 *
	 * @param {string}      messageId - ID of the rated message
	 * @param {string|null} rating    - 'up', 'down', or null (removed)
	 */
	const handleFeedback = useCallback(
		( messageId, rating ) => {
			if ( ! rating ) {
				return;
			}
			// Collect ability IDs from the messages preceding this assistant response
			const abilityIds = messages
				.filter( ( m ) => m.type === 'ability_result' )
				.map( ( m ) => m.abilityName )
				.filter( Boolean );

			// Full conversation up to and including the rated message
			const msgIdx = messages.findIndex( ( m ) => m.id === messageId );
			const conversation =
				msgIdx !== -1
					? messages
							.slice( 0, msgIdx + 1 )
							.filter(
								( m ) =>
									m.type === 'user' || m.type === 'assistant'
							)
							.map( ( m ) => ( {
								role: m.type,
								content: m.content,
							} ) )
					: [];

			const model =
				modelLoader.getModelId() ||
				window.wpAgenticAdmin?.settings?.modelId ||
				'';

			const systemPrompt = chatOrchestrator.getSystemPrompt?.() || '';
			const { temperature, maxTokens } =
				chatOrchestrator.llmOptions || {};

			saveFeedback( {
				messageId,
				sessionId: sessionRef.current?.id || '',
				abilityIds,
				rating,
				systemPrompt,
				conversation,
				model,
				generationConfig: {
					temperature: temperature ?? null,
					maxTokens: maxTokens ?? null,
				},
			} );
		},
		[ messages ]
	);

	/**
	 * Copy all conversation to clipboard
	 */
	const copyAllConversation = useCallback( async () => {
		if ( ! messages || messages.length === 0 ) {
			return;
		}

		const conversationText = messages
			.map( ( msg ) => {
				let prefix = '';
				let content = '';

				switch ( msg.type ) {
					case 'user':
						prefix = 'User:';
						content = msg.content;
						break;
					case 'assistant':
						prefix = 'Assistant:';
						content = msg.content;
						break;
					case 'ability_request':
						prefix = 'Tool Request:';
						content = `${
							msg.abilityLabel || msg.abilityName
						}\nInput: ${ JSON.stringify( msg.input, null, 2 ) }`;
						break;
					case 'ability_result':
						prefix = 'Tool Result:';
						content = `${ msg.abilityName }\nSuccess: ${
							msg.success
						}\nResult: ${
							typeof msg.result === 'object'
								? JSON.stringify( msg.result, null, 2 )
								: msg.result
						}`;
						break;
					case 'error':
						prefix = 'Error:';
						content = msg.content || msg.error;
						break;
					case 'system':
						prefix = 'System:';
						content = msg.content;
						break;
					default:
						prefix = 'Message:';
						content = msg.content || JSON.stringify( msg );
				}

				return `${ prefix }\n${ content }\n`;
			} )
			.join( '\n---\n\n' );

		try {
			await navigator.clipboard.writeText( conversationText );
			setShowCopiedSnackbar( true );
			log.info( 'Conversation copied to clipboard' );
		} catch ( error ) {
			log.error( 'Failed to copy conversation:', error );
		}
	}, [ messages ] );

	/**
	 * Handle action button clicks from interactive ability results
	 */
	const handleAction = useCallback( async ( abilityId, params ) => {
		const tool = toolRegistry.get( abilityId );
		const needsConfirmation =
			typeof tool?.requiresConfirmation === 'function'
				? tool.requiresConfirmation( params )
				: tool?.requiresConfirmation;

		if ( needsConfirmation ) {
			const confirmed = await new Promise( ( resolve ) => {
				setPendingConfirmation( {
					toolId: abilityId,
					label: tool?.label || abilityId,
					message:
						tool?.confirmationMessage || `Execute ${ abilityId }?`,
					resolve,
				} );
			} );
			if ( ! confirmed ) {
				return;
			}
		}

		try {
			const result = await executeAbility( abilityId, params );
			const msg =
				result?.message ||
				( result?.success
					? 'Action completed successfully.'
					: 'Action failed.' );
			sessionRef.current?.addAssistantMessage( msg );
		} catch ( error ) {
			log.error( 'Action execution error:', error );
			sessionRef.current?.addAssistantMessage(
				`Action failed: ${ error.message || 'Unknown error' }`
			);
		}
	}, [] );

	/**
	 * Stop current AI generation
	 */
	const handleStopGeneration = useCallback( () => {
		chatOrchestrator.abort();
		setIsStreaming( false );
		setStreamingText( '' );
	}, [] );

	// Combine messages with loading/streaming indicators for display
	const displayMessages = useMemo( () => {
		const msgs = messages.map( ( msg ) => {
			// Update ability_picker isProcessing dynamically
			if ( msg.type === 'ability_picker' ) {
				return { ...msg, isProcessing: isLoading };
			}
			return msg;
		} );

		// Show loading indicator inline in the message flow
		const showLoadingDot =
			isLoading &&
			! isExecutingTool &&
			! isStreaming &&
			! isRunningWorkflow &&
			! isThinking;
		const showRunningTool = isExecutingTool && ! isRunningWorkflow;

		if ( showLoadingDot || showRunningTool ) {
			msgs.push( {
				id: 'loading-indicator',
				type: 'loading',
				content: showRunningTool ? 'Running tool...' : 'Thinking...',
				timestamp: new Date().toISOString(),
			} );
		}

		// Show live thinking stream (while <think> block is being generated)
		if ( isThinking && thinkingText ) {
			msgs.push( {
				id: 'thinking-stream',
				type: 'thinking',
				content: thinkingText,
				isStreaming: true,
				timestamp: new Date().toISOString(),
			} );
		}

		// Show streaming text as it arrives
		if ( isStreaming && streamingText ) {
			msgs.push( {
				id: 'streaming',
				type: 'assistant',
				content: streamingText + '▊',
				timestamp: new Date().toISOString(),
			} );
		}

		return msgs;
	}, [
		messages,
		isLoading,
		isExecutingTool,
		isStreaming,
		isRunningWorkflow,
		isThinking,
		thinkingText,
		streamingText,
	] );

	return (
		<div className="wp-agentic-admin-chat-container">
			<div className="wp-agentic-admin-chat-header">
				<div className="wp-agentic-admin-chat-header__actions">
					<Button
						variant="secondary"
						onClick={ copyAllConversation }
						disabled={
							messages.length === 0 ||
							isLoading ||
							isStreaming ||
							isExecutingTool
						}
					>
						Copy All
					</Button>
					<Button
						variant="tertiary"
						isDestructive
						onClick={ clearHistory }
						disabled={
							messages.length <= 1 ||
							isLoading ||
							isStreaming ||
							isExecutingTool
						}
					>
						Clear Chat
					</Button>
				</div>
			</div>

			<MessageList
				messages={ displayMessages }
				onAction={ handleAction }
				feedbackOptIn={
					FEEDBACK_UPLOAD_ENABLED && feedbackOptIn === true
				}
				onFeedback={ handleFeedback }
			/>

			{ /* Feedback opt-in banner — shown once, only after the first real exchange */ }
			{ FEEDBACK_UPLOAD_ENABLED &&
				feedbackOptIn === null &&
				messages.length > 1 && (
					<FeedbackOptInBanner
						onAccept={ handleFeedbackAccept }
						onDecline={ handleFeedbackDecline }
					/>
				) }

			{ /* Context usage warning */ }
			{ contextUsage?.isHigh && (
				<div className="wp-agentic-admin-context-warning">
					<Notice
						status={ contextUsage.isCritical ? 'error' : 'warning' }
						isDismissible={ false }
					>
						<span>
							{ contextUsage.isCritical
								? `Context is almost full (${ contextUsage.percentage }%). The AI may lose track of earlier messages.`
								: `Context is ${ contextUsage.percentage }% full. Consider clearing the chat soon.` }
						</span>
						<Button
							variant="link"
							onClick={ clearHistory }
							className="wp-agentic-admin-context-warning__clear"
						>
							Clear Chat
						</Button>
					</Notice>
				</div>
			) }

			{ /* Workflow progress indicator */ }
			{ isRunningWorkflow && workflowProgress && (
				<div className="agentic-message agentic-message--workflow">
					<div className="agentic-timeline">
						<div className="agentic-timeline__line" />
						<div className="agentic-timeline__dot agentic-timeline__dot--workflow" />
					</div>
					<div
						className="agentic-workflow-progress"
						role="status"
						aria-live="polite"
					>
						<div className="agentic-workflow-progress__header">
							<span className="agentic-workflow-progress__step">
								Step { workflowProgress.step } of{ ' ' }
								{ workflowProgress.total }
							</span>
							<span className="agentic-workflow-progress__label">
								{ workflowProgress.label }
							</span>
						</div>
						<div
							className="agentic-workflow-progress__bar"
							role="progressbar"
							aria-valuenow={ workflowProgress.percentage }
							aria-valuemin={ 0 }
							aria-valuemax={ 100 }
							aria-label={ `Workflow progress: ${ workflowProgress.percentage }%` }
						>
							<div
								className="agentic-workflow-progress__fill"
								style={ {
									width: `${ workflowProgress.percentage }%`,
								} }
							/>
						</div>
					</div>
				</div>
			) }

			<ChatInput
				onSend={ handleSendMessage }
				disabled={ ! modelReady || isStreaming }
				isLoading={ isLoading || isStreaming }
				placeholder={
					modelReady
						? 'Describe your issue or what you want to do...'
						: 'Load the AI model to start chatting...'
				}
			/>

			{ isStreaming && (
				<div className="wp-agentic-admin-chat-actions">
					<Button
						variant="secondary"
						onClick={ handleStopGeneration }
					>
						Stop Generation
					</Button>
				</div>
			) }

			{ /* Confirmation Modal for destructive actions and intent confirmation */ }
			{ pendingConfirmation && (
				<Modal
					title={
						/* eslint-disable-next-line no-nested-ternary -- clear modal title selection based on confirmation type */
						pendingConfirmation.isIntentConfirmation
							? 'Did you mean?'
							: pendingConfirmation.isWorkflow
							? 'Confirm Workflow'
							: 'Confirm Action'
					}
					onRequestClose={ handleCancel }
					className="wp-agentic-admin-confirm-modal"
				>
					{ /* eslint-disable-next-line no-nested-ternary -- clear conditional rendering based on confirmation type */ }
					{ pendingConfirmation.isIntentConfirmation ? (
						/* Intent Confirmation UI */
						<p className="wp-agentic-admin-intent-question">
							Did you mean:{ ' ' }
							<strong>{ pendingConfirmation.label }</strong>?
						</p>
					) : pendingConfirmation.isWorkflow &&
					  pendingConfirmation.workflowDetails ? (
						/* Workflow Confirmation UI */
						<>
							<p>
								<strong>
									{
										pendingConfirmation.workflowDetails
											.label
									}
								</strong>
							</p>
							<p className="wp-agentic-admin-confirm-description">
								{
									pendingConfirmation.workflowDetails
										.description
								}
							</p>
							<p>
								This workflow will perform{ ' ' }
								{
									pendingConfirmation.workflowDetails
										.totalSteps
								}{ ' ' }
								steps:
							</p>
							<ol className="wp-agentic-admin-confirm-steps">
								{ pendingConfirmation.workflowDetails.steps?.map(
									( step, i ) => (
										<li
											key={ i }
											className={ `step-${
												step.operationType ||
												( step.isWrite
													? 'write'
													: 'read' )
											}` }
										>
											<span className="step-label">
												{ step.label }
											</span>
											<span
												className={ `step-badge step-badge--${
													/* eslint-disable-next-line no-nested-ternary -- clear operation type selection */
													step.operationType ||
													( step.isWrite
														? 'write'
														: 'read' )
												}` }
											>
												{ /* eslint-disable-next-line no-nested-ternary -- clear operation label selection */ }
												{ step.operationType ===
												'delete'
													? 'delete'
													: step.isWrite
													? 'write'
													: 'read' }
											</span>
										</li>
									)
								) }
							</ol>
							{ pendingConfirmation.workflowDetails
								.destructiveOperations > 0 && (
								<Notice status="error" isDismissible={ false }>
									This includes{ ' ' }
									{
										pendingConfirmation.workflowDetails
											.destructiveOperations
									}{ ' ' }
									destructive operation(s) that may cause data
									loss.
								</Notice>
							) }
							{ pendingConfirmation.workflowDetails
								.writeOperations > 0 &&
								pendingConfirmation.workflowDetails
									.destructiveOperations === 0 && (
									<Notice
										status="warning"
										isDismissible={ false }
									>
										This includes{ ' ' }
										{
											pendingConfirmation.workflowDetails
												.writeOperations
										}{ ' ' }
										write operation(s) that will modify your
										site.
									</Notice>
								) }
						</>
					) : (
						/* Standard Tool Confirmation UI */
						<>
							<p>
								The AI wants to execute:{ ' ' }
								<strong>{ pendingConfirmation.label }</strong>
							</p>
							<p>{ pendingConfirmation.message }</p>
						</>
					) }
					<div className="wp-agentic-admin-confirm-actions">
						<Button variant="tertiary" onClick={ handleCancel }>
							{ pendingConfirmation.isIntentConfirmation
								? 'No'
								: 'Cancel' }
						</Button>
						<Button
							variant="primary"
							isDestructive={
								! pendingConfirmation.isIntentConfirmation &&
								pendingConfirmation.isDestructive !== false
							}
							onClick={ handleConfirm }
						>
							{ /* eslint-disable-next-line no-nested-ternary -- clear button label selection based on confirmation type */ }
							{ pendingConfirmation.isIntentConfirmation
								? 'Yes'
								: pendingConfirmation.isWorkflow
								? 'Run Workflow'
								: 'Confirm' }
						</Button>
					</div>
				</Modal>
			) }

			{ /* Success snackbar for copy action */ }
			{ showCopiedSnackbar && (
				<Snackbar
					onRemove={ () => setShowCopiedSnackbar( false ) }
					actions={ [] }
				>
					Conversation copied to clipboard!
				</Snackbar>
			) }
		</div>
	);
};

export { ChatContainer };
export default ChatContainer;
