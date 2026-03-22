# WordPress Security

## Data Validation & Sanitization

### Input Sanitization
Always sanitize data before using or storing it:
- `sanitize_text_field( $str )` — Strip tags, remove extra whitespace, encode entities.
- `sanitize_textarea_field( $str )` — Like sanitize_text_field but preserves newlines.
- `sanitize_email( $email )` — Strip invalid email characters.
- `sanitize_url( $url )` — Clean URL, check for allowed protocols.
- `sanitize_file_name( $name )` — Remove special characters from filenames.
- `sanitize_title( $title )` — Create a URL-friendly slug.
- `absint( $value )` — Absolute integer (non-negative).
- `wp_kses( $string, $allowed_html )` — Strip disallowed HTML tags and attributes.
- `wp_kses_post( $string )` — Allow HTML tags appropriate for post content.

### Output Escaping
Always escape data before outputting to the browser:
- `esc_html( $text )` — Escape for use in HTML context.
- `esc_attr( $text )` — Escape for use in HTML attributes.
- `esc_url( $url )` — Escape URLs for use in href, src, etc.
- `esc_js( $text )` — Escape for inline JavaScript.
- `esc_textarea( $text )` — Escape for use inside `<textarea>`.
- `wp_kses_post( $html )` — Allow only safe HTML tags.

### Translation + Escaping
- `esc_html__()` / `esc_html_e()` — Translate and escape for HTML.
- `esc_attr__()` / `esc_attr_e()` — Translate and escape for attributes.

## Nonces

Nonces prevent CSRF attacks. They're one-time-use tokens tied to a specific action and user.

### Creating
```php
// In forms
wp_nonce_field( 'my_action', 'my_nonce' );

// In URLs
$url = wp_nonce_url( $url, 'my_action', 'my_nonce' );

// Get raw nonce value
$nonce = wp_create_nonce( 'my_action' );
```

### Verifying
```php
// In form handlers
if ( ! wp_verify_nonce( $_POST['my_nonce'], 'my_action' ) ) {
    wp_die( 'Security check failed.' );
}

// In admin (checks nonce + referrer)
check_admin_referer( 'my_action', 'my_nonce' );

// In AJAX
check_ajax_referer( 'my_action', 'my_nonce' );
```

## SQL Injection Prevention

Always use `$wpdb->prepare()` for queries with user input:
```php
$wpdb->get_results( $wpdb->prepare(
    "SELECT * FROM {$wpdb->posts} WHERE post_author = %d AND post_status = %s",
    $user_id,
    'publish'
) );
```
Placeholders: `%s` (string), `%d` (integer), `%f` (float).

## File Security

### Direct Access Prevention
Every PHP file should start with:
```php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
```

### File Upload Validation
- Check MIME type with `wp_check_filetype()`.
- Use `wp_handle_upload()` for proper upload handling.
- Never trust file extensions alone.

### Filesystem Access
Use `WP_Filesystem` API instead of direct PHP file functions:
```php
global $wp_filesystem;
WP_Filesystem();
$content = $wp_filesystem->get_contents( $file_path );
```

## Capability Checks

Always check user capabilities before performing actions:
```php
if ( ! current_user_can( 'manage_options' ) ) {
    wp_die( 'Unauthorized.' );
}
```

### REST API
```php
'permission_callback' => function () {
    return current_user_can( 'edit_posts' );
}
```

## Common Vulnerabilities to Avoid

1. **XSS** — Always escape output. Never echo unsanitized user input.
2. **SQL Injection** — Always use `$wpdb->prepare()`. Never concatenate user input into queries.
3. **CSRF** — Always use and verify nonces for state-changing operations.
4. **Path Traversal** — Validate file paths with `realpath()` and check they're within expected directories.
5. **Object Injection** — Never `unserialize()` user input. Use `maybe_unserialize()` for trusted data only.
6. **Privilege Escalation** — Always check capabilities, not just login status.
