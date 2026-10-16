/**
 * Page Context
 *
 * Describes the wp-admin screen the chat was opened from, so the agent knows
 * where the user is (for example "the Plugins page"). The screen data comes
 * from PHP (agenticAdmin.pageContext, see Admin_Page::get_localized_data()).
 * Empty on the plugin's own page, where it adds nothing.
 */

/**
 * Human-readable names for common WordPress admin screen IDs.
 */
const SCREEN_LABELS = {
	dashboard: 'Dashboard',
	plugins: 'Plugins',
	'plugin-install': 'Add Plugins',
	themes: 'Themes',
	users: 'Users',
	profile: 'Profile',
	options: 'Settings',
	'options-general': 'General Settings',
	'options-writing': 'Writing Settings',
	'options-reading': 'Reading Settings',
	'options-discussion': 'Discussion Settings',
	'options-media': 'Media Settings',
	'options-permalink': 'Permalink Settings',
	upload: 'Media Library',
	'media-new': 'Add New Media',
	edit: 'Posts list',
	'edit-post': 'Posts list',
	'edit-page': 'Pages list',
	'edit-comments': 'Comments',
	'site-health': 'Site Health',
	tools: 'Tools',
	import: 'Import',
	export: 'Export',
	'update-core': 'Updates',
	'nav-menus': 'Menus',
	widgets: 'Widgets',
	customize: 'Customizer',
};

const PLUGIN_SCREEN_ID = 'toplevel_page_agentic-admin';

/**
 * Build a one-line description of the current admin page.
 *
 * @return {string} Context sentence, or '' when unknown or on the plugin page.
 */
export function getPageContextString() {
	const ctx = window.agenticAdmin?.pageContext;
	if ( ! ctx || ! ctx.pagenow || ctx.screenId === PLUGIN_SCREEN_ID ) {
		return '';
	}

	if ( ctx.screenBase === 'post' && ctx.postType ) {
		return `The user is editing a "${ ctx.postType }" in the WordPress editor.`;
	}

	const label = SCREEN_LABELS[ ctx.screenId ];
	if ( label ) {
		return `The user is currently on the WordPress "${ label }" admin page (${ ctx.pagenow }).`;
	}

	return `The user is currently on the WordPress admin page ${ ctx.pagenow }${
		ctx.screenId ? ` (screen: ${ ctx.screenId })` : ''
	}.`;
}

/**
 * Page context as a system prompt section.
 *
 * @return {string} "\n\nCONTEXT:\n…", or '' when there is no context.
 */
export function getPageContextPrompt() {
	const context = getPageContextString();
	return context ? `\n\nCONTEXT:\n${ context }` : '';
}
