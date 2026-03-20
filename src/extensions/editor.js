/**
 * WP Agentic Admin - Block Editor Plugin Entry Point
 *
 * Registers a PluginSidebar in the Gutenberg block editor,
 * providing AI chat functionality while editing content.
 * Shares the WebLLM instance via the existing Service Worker.
 *
 * @version 0.9.5
 */

import { registerPlugin } from '@wordpress/plugins';
import { PluginSidebar } from '@wordpress/editor';
import EditorSidebar from './components/EditorSidebar';
import './styles/editor-sidebar.scss';

registerPlugin( 'wp-agentic-admin', {
	icon: 'superhero-alt',
	render: () => (
		<PluginSidebar
			name="wp-agentic-admin-chat"
			title="AI Assistant"
			icon="superhero-alt"
		>
			<EditorSidebar />
		</PluginSidebar>
	),
} );
