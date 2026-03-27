# WordPress Plugin Development

## Plugin Structure

### Minimum Plugin File
```php
<?php
/**
 * Plugin Name: My Plugin
 * Plugin URI: https://example.com
 * Description: Short description.
 * Version: 1.0.0
 * Author: Your Name
 * License: GPL-2.0-or-later
 * Text Domain: my-plugin
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
```

### Recommended Directory Structure
```
my-plugin/
  my-plugin.php          # Main plugin file
  includes/              # PHP classes and functions
  assets/                # CSS, JS, images
  templates/             # Template files
  languages/             # Translation files
  tests/                 # Test files
  readme.txt             # WordPress.org readme
```

## Activation & Deactivation

```php
// Runs on plugin activation
register_activation_hook( __FILE__, function () {
    // Create database tables, set default options, flush rewrite rules
    add_option( 'my_plugin_version', '1.0.0' );
    flush_rewrite_rules();
} );

// Runs on plugin deactivation
register_deactivation_hook( __FILE__, function () {
    // Clean up cron events, temporary data
    wp_clear_scheduled_hook( 'my_plugin_cron' );
} );

// Runs on plugin deletion (uninstall.php or register hook)
register_uninstall_hook( __FILE__, 'my_plugin_uninstall' );
function my_plugin_uninstall() {
    // Remove all plugin data from database
    delete_option( 'my_plugin_settings' );
}
```

## Admin Pages

### Adding Menu Pages
```php
add_action( 'admin_menu', function () {
    // Top-level menu
    add_menu_page(
        'My Plugin Settings',     // Page title
        'My Plugin',              // Menu title
        'manage_options',         // Capability required
        'my-plugin',              // Menu slug
        'my_plugin_render_page',  // Callback
        'dashicons-admin-generic', // Icon
        80                        // Position
    );

    // Submenu page
    add_submenu_page(
        'my-plugin',              // Parent slug
        'Advanced Settings',      // Page title
        'Advanced',               // Menu title
        'manage_options',         // Capability
        'my-plugin-advanced',     // Menu slug
        'my_plugin_advanced_page' // Callback
    );
} );
```

### Settings API
```php
add_action( 'admin_init', function () {
    register_setting( 'my_plugin_group', 'my_plugin_option', array(
        'sanitize_callback' => 'sanitize_text_field',
        'default'           => '',
    ) );

    add_settings_section( 'general', 'General Settings', null, 'my-plugin' );

    add_settings_field( 'api_key', 'API Key', function () {
        $value = get_option( 'my_plugin_option', '' );
        echo '<input type="text" name="my_plugin_option" value="' . esc_attr( $value ) . '" />';
    }, 'my-plugin', 'general' );
} );
```

## AJAX Handling

### PHP Handler
```php
// For logged-in users
add_action( 'wp_ajax_my_action', function () {
    check_ajax_referer( 'my_nonce', 'nonce' );

    if ( ! current_user_can( 'edit_posts' ) ) {
        wp_send_json_error( 'Unauthorized' );
    }

    $result = do_something();
    wp_send_json_success( $result );
} );

// For logged-out users (public)
add_action( 'wp_ajax_nopriv_my_action', 'my_public_handler' );
```

### JavaScript
```javascript
jQuery.post( ajaxurl, {
    action: 'my_action',
    nonce: myPlugin.nonce,
    data: 'value'
}, function( response ) {
    if ( response.success ) {
        console.log( response.data );
    }
} );
```

## Database Tables

### Creating Custom Tables
```php
register_activation_hook( __FILE__, function () {
    global $wpdb;
    $table = $wpdb->prefix . 'my_table';
    $charset = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        name varchar(255) NOT NULL,
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) $charset;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql );
} );
```

### dbDelta Rules
- Table name on its own line after CREATE TABLE.
- Each column on its own line.
- PRIMARY KEY and indexes must use KEY (not INDEX).
- Two spaces between PRIMARY KEY and the column definition.
- Use `$wpdb->get_charset_collate()` for charset.

## Shortcodes

```php
add_shortcode( 'my_button', function ( $atts ) {
    $atts = shortcode_atts( array(
        'text'  => 'Click Me',
        'url'   => '#',
        'color' => 'blue',
    ), $atts, 'my_button' );

    return sprintf(
        '<a href="%s" class="btn btn-%s">%s</a>',
        esc_url( $atts['url'] ),
        esc_attr( $atts['color'] ),
        esc_html( $atts['text'] )
    );
} );
// Usage: [my_button text="Learn More" url="/about" color="green"]
```

## Internationalization (i18n)

```php
// Translatable strings
__( 'Hello World', 'my-plugin' );    // Return translated string
_e( 'Hello World', 'my-plugin' );    // Echo translated string
_n( '%d item', '%d items', $count, 'my-plugin' ); // Singular/plural
_x( 'Post', 'verb', 'my-plugin' );   // With context

// Load text domain
add_action( 'init', function () {
    load_plugin_textdomain( 'my-plugin', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
} );
```
