# WordPress Multisite

## Overview

WordPress Multisite allows running multiple WordPress sites from a single installation. All sites share the same WordPress core files, plugins, and themes, but each has its own content, settings, and users.

## Setup

### Enable Multisite
In `wp-config.php`:
```php
define( 'WP_ALLOW_MULTISITE', true );
```

After setup through Network Setup (Tools menu):
```php
define( 'MULTISITE', true );
define( 'SUBDOMAIN_INSTALL', false ); // true for subdomain, false for subdirectory
define( 'DOMAIN_CURRENT_SITE', 'example.com' );
define( 'PATH_CURRENT_SITE', '/' );
define( 'SITE_ID_CURRENT_SITE', 1 );
define( 'BLOG_ID_CURRENT_SITE', 1 );
```

## Database Structure

Each sub-site gets its own set of tables with a numeric prefix:
- Main site: `wp_posts`, `wp_postmeta`, etc.
- Site 2: `wp_2_posts`, `wp_2_postmeta`, etc.
- Site 3: `wp_3_posts`, `wp_3_postmeta`, etc.

### Global Tables (shared)
- `wp_blogs` — List of all sites (blog_id, domain, path, registered, last_updated)
- `wp_site` — Network information
- `wp_sitemeta` — Network-wide options
- `wp_users` — All users across the network
- `wp_usermeta` — User metadata (roles are per-site: `wp_capabilities`, `wp_2_capabilities`)
- `wp_registration_log` — User registrations
- `wp_signups` — Pending user/site signups

## Key Functions

### Site Switching
```php
switch_to_blog( $blog_id );  // Switch context to another site
// Do work on that site...
restore_current_blog();       // Switch back
```
Always pair `switch_to_blog()` with `restore_current_blog()`.

### Site Queries
- `get_sites( $args )` — Query sites. Args: network_id, domain, path, public, archived, deleted, number.
- `get_blog_details( $blog_id )` — Get site info.
- `get_current_blog_id()` — Current site ID.
- `is_multisite()` — Check if multisite is enabled.
- `is_main_site()` — Check if current site is the main site.

### Network Options
- `get_site_option( $option )` — Network-wide option.
- `update_site_option( $option, $value )` — Update network option.

### User Functions
- `is_super_admin()` — Check if user is a network Super Admin.
- `get_blogs_of_user( $user_id )` — Get sites a user belongs to.
- `add_user_to_blog( $blog_id, $user_id, $role )` — Add user to a site.
- `remove_user_from_blog( $user_id, $blog_id )` — Remove user from a site.

## Plugin & Theme Management

- Plugins can be **network activated** (active on all sites) or activated per-site.
- Themes must be **network enabled** before individual sites can use them.
- Must-use plugins (`wp-content/mu-plugins/`) run on all sites automatically.

### Checking Context
```php
if ( is_network_admin() ) {
    // Code for Network Admin dashboard
}

if ( is_main_site() ) {
    // Code for the main site only
}
```

## Common Multisite Hooks

- `wpmu_new_blog` — After a new site is created.
- `wp_initialize_site` — During site initialization (WP 5.1+).
- `wp_delete_site` — Before a site is deleted (WP 5.1+).
- `network_admin_menu` — Register Network Admin menu pages.
- `signup_blogform` — Custom fields on site registration form.
