# WordPress User Roles & Capabilities

## Default Roles

### Super Admin (Multisite only)
All capabilities plus network-level administration. Can manage all sites in the network.

### Administrator
Full control of a single site. Key capabilities:
- `manage_options` — Access Settings pages, modify options
- `activate_plugins` — Activate/deactivate plugins
- `install_plugins` / `install_themes` — Install from repository
- `edit_theme_options` — Customize themes, manage widgets/menus
- `create_users` / `delete_users` — User management
- `unfiltered_html` — Post HTML without sanitization (disabled in multisite)
- `manage_network` — Multisite network admin (Super Admin only)

### Editor
Manages all content but no site settings. Key capabilities:
- `edit_others_posts` / `edit_others_pages` — Edit any user's content
- `publish_posts` / `publish_pages` — Publish content
- `delete_others_posts` — Delete any user's content
- `manage_categories` — Create/edit/delete categories
- `moderate_comments` — Approve/reject comments
- `unfiltered_html` — Post raw HTML

### Author
Manages their own content. Key capabilities:
- `edit_published_posts` — Edit own published posts
- `publish_posts` — Publish own posts
- `upload_files` — Upload media
- `delete_published_posts` — Delete own published posts

### Contributor
Can write but not publish. Key capabilities:
- `edit_posts` — Write and edit own draft posts
- `delete_posts` — Delete own draft posts
- Cannot publish or upload files

### Subscriber
Can only manage their profile. Key capabilities:
- `read` — View the site (relevant for private sites)

## Capability Functions

### Checking
- `current_user_can( $capability )` — Check if current user has a capability.
- `user_can( $user, $capability )` — Check a specific user.
- `current_user_can( 'edit_post', $post_id )` — Meta capabilities resolve to the actual post owner check.

### Managing Roles
```php
// Add a role
add_role( 'shop_manager', 'Shop Manager', array(
    'read'         => true,
    'edit_posts'   => true,
    'manage_shop'  => true,
) );

// Remove a role
remove_role( 'shop_manager' );

// Add capability to existing role
$role = get_role( 'editor' );
$role->add_cap( 'manage_shop' );

// Remove capability
$role->remove_cap( 'manage_shop' );
```

### User Functions
- `wp_get_current_user()` — Get current WP_User object.
- `get_userdata( $user_id )` — Get user by ID.
- `get_user_by( 'email', $email )` — Get user by field (email, login, slug).
- `get_users( $args )` — Query users. Args: role, role__in, meta_key, meta_value, orderby.

## Storage

Roles and capabilities are stored in `wp_options` as `wp_{prefix}_user_roles` (serialized array). Individual user roles are stored in `wp_usermeta` with meta_key `wp_capabilities`.

## Meta Capabilities

WordPress maps "primitive" capabilities to "meta" capabilities for per-object checks:
- `edit_post` -> checks `edit_posts` or `edit_others_posts` depending on ownership
- `delete_page` -> checks `delete_pages` or `delete_others_pages`
- `read_post` -> checks `read` or `read_private_posts` depending on post status

Custom post types can define custom capability mappings via `capability_type` and `map_meta_cap`.
