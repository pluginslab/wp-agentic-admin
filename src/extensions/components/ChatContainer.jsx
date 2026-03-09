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
import {
	chatOrchestrator,
	ChatSession,
	registerWPTools,
	MessageType,
	modelLoader,
} from '../services';

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

	// Workflow state (v1.1)
	const [ workflowProgress, setWorkflowProgress ] = useState( null );
	const [ isRunningWorkflow, setIsRunningWorkflow ] = useState( false );

	// Copy feedback state
	const [ showCopiedSnackbar, setShowCopiedSnackbar ] = useState( false );

	// Session ref to persist across renders
	const sessionRef = useRef( null );
	const initializedRef = useRef( false );

	/**
	 * Initialize the chat framework on mount
	 */
	useEffect( () => {
		if ( initializedRef.current ) {
			return;
		}
		initializedRef.current = true;

		console.log( '[ChatContainer] Initializing chat framework...' );

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
				console.error( '[ChatContainer] Orchestrator error:', error );
			},
			onStateChange: ( { isProcessing } ) => {
				setIsLoading?.( isProcessing );
				// Update context usage after each message
				const usage = modelLoader.getContextUsage();
				setContextUsage( usage );
			},
			// Workflow callbacks (v1.1)
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
			// Intent confirmation callback (v1.3.0 - for fuzzy/LLM matches)
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

		// Set up confirmation handler for destructive actions (supports workflows v1.1)
		chatOrchestrator.setConfirmationHandler( ( tool ) => {
			return new Promise( ( resolve ) => {
				const isWorkflow = tool.isWorkflow || false;
				const workflowDetails = tool.workflowDetails || null;

				setPendingConfirmation( {
					toolId: tool.id,
					label: tool.label || tool.id,
					message:
						tool.confirmationMessage || `Execute ${ tool.id }?`,
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
	 * Convert session messages to display format for MessageList
	 *
	 * @param {Array} sessionMessages - Messages from ChatSession
	 * @return {Array} Display-formatted messages
	 */
	const convertMessagesToDisplay = ( sessionMessages ) => {
		return sessionMessages.map( ( msg ) => {
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
	};

	/**
	 * Handle sending a user message
	 *
	 * @param {string} text - User's message text
	 */
	const handleSendMessage = useCallback(
		async ( text ) => {
			if ( ! text.trim() ) {
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

			// Process message through orchestrator
			try {
				await chatOrchestrator.processMessage( text );
			} catch ( error ) {
				console.error(
					'[ChatContainer] Error processing message:',
					error
				);
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
			console.log( '[ChatContainer] Conversation copied to clipboard' );
		} catch ( error ) {
			console.error(
				'[ChatContainer] Failed to copy conversation:',
				error
			);
		}
	}, [ messages ] );

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
		const msgs = [ ...messages ];

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

			<MessageList messages={ displayMessages } />

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

			{ /* Workflow progress indicator (v1.1) */ }
			{ isRunningWorkflow && workflowProgress && (
				<div className="agentic-message agentic-message--workflow">
					<div className="agentic-timeline">
						<div className="agentic-timeline__line" />
						<div className="agentic-timeline__dot agentic-timeline__dot--workflow" />
					</div>
					<div className="agentic-workflow-progress">
						<div className="agentic-workflow-progress__header">
							<span className="agentic-workflow-progress__step">
								Step { workflowProgress.step } of{ ' ' }
								{ workflowProgress.total }
							</span>
							<span className="agentic-workflow-progress__label">
								{ workflowProgress.label }
							</span>
						</div>
						<div className="agentic-workflow-progress__bar">
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

			{ /* Confirmation Modal for destructive actions and intent confirmation (v1.1, v1.3) */ }
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
						/* Intent Confirmation UI (NEW in v1.3.0 - fuzzy/LLM matches) */
						<p className="wp-agentic-admin-intent-question">
							Did you mean:{ ' ' }
							<strong>{ pendingConfirmation.label }</strong>?
						</p>
					) : pendingConfirmation.isWorkflow &&
					  pendingConfirmation.workflowDetails ? (
						/* Workflow Confirmation UI (v1.1) */
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
						/* Standard Tool Confirmation UI (v1.0) */
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
								! pendingConfirmation.isIntentConfirmation
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
