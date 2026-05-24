/**
 * Inline model-status pill rendered into the composer toolbar.
 *
 * Shows a coloured dot + the model name (or status message), plus a
 * 3-dot DropdownMenu with the "Unload model" action while ready. While
 * loading or checking it shows a Spinner + status text inline.
 *
 * Lives in the chat composer (to the left of the send button) instead
 * of the old big status Card under the page chrome.
 */

import {
	DropdownMenu,
	MenuGroup,
	MenuItem,
	Spinner,
	__experimentalHStack as HStack,
} from '@wordpress/components';
import { moreVertical } from '@wordpress/icons';
import modelLoader from '../services/model-loader';
import useModelStatus from '../services/use-model-status';

const STATUS_LABEL = {
	ready: 'Ready',
	error: 'Error',
	loading: 'Loading',
	checking: 'Loading',
	'not-loaded': 'Not loaded',
};

const ModelStatusPill = () => {
	const { status, message, progress, loadedModelInfo } = useModelStatus();

	const isLoading = status === 'loading' || status === 'checking';

	const handleUnload = async () => {
		await modelLoader.unload();
	};

	// WP-native loading style: just a Spinner + percent.
	if ( isLoading ) {
		return (
			<HStack
				alignment="center"
				spacing={ 2 }
				justify="flex-start"
				className="wp-agentic-admin-status-pill"
			>
				<Spinner />
				<span className="screen-reader-text">
					{ STATUS_LABEL[ status ] || status }
				</span>
				<span>{ Math.round( progress ) }%</span>
			</HStack>
		);
	}

	const labelText =
		status === 'ready' && loadedModelInfo
			? `${ loadedModelInfo.name } ready`
			: message;

	return (
		<HStack
			alignment="center"
			spacing={ 2 }
			justify="flex-start"
			className="wp-agentic-admin-status-pill"
		>
			<span
				className={ `wp-agentic-admin-status-dot wp-agentic-admin-status-dot--${ status }` }
				aria-hidden="true"
			/>
			<span className="screen-reader-text">
				{ STATUS_LABEL[ status ] || status }
			</span>
			<span>{ labelText }</span>
			{ status === 'ready' && (
				<DropdownMenu
					icon={ moreVertical }
					label="Model options"
				>
					{ ( { onClose } ) => (
						<MenuGroup>
							<MenuItem
								onClick={ () => {
									handleUnload();
									onClose();
								} }
							>
								Unload model
							</MenuItem>
						</MenuGroup>
					) }
				</DropdownMenu>
			) }
		</HStack>
	);
};

export default ModelStatusPill;
