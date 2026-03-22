# WordPress Hooks Lifecycle

## Action Execution Order

WordPress fires actions in a specific order during each page load. Understanding this order is critical for knowing when your code runs.

### Early Bootstrap

1. **muplugins_loaded** — After must-use plugins load. No theme, no regular plugins yet.
2. **registered_taxonomy** — After each taxonomy is registered.
3. **registered_post_type** — After each post type is registered.
4. **plugins_loaded** — All active plugins loaded. Good for plugin initialization, adding filters.
5. **sanitize_comment_cookies** — After comment cookies are sanitized.
6. **setup_theme** — Before theme is loaded. Child theme functions.php loads after parent.
7. **after_setup_theme** — Theme's functions.php has run. Register theme support, nav menus, image sizes here.

### Core Init

8. **init** — WordPress is fully loaded. Register custom post types, taxonomies, shortcodes. Most plugin code hooks here.
9. **widgets_init** — Register widget areas (sidebars) and custom widgets.
10. **register_sidebar** — Each time a sidebar is registered.

### Admin vs Frontend Split

For admin pages:
11. **admin_menu** — Register admin menu pages and submenus.
12. **admin_init** — First action on any admin page. Register settings, handle form submissions.
13. **admin_enqueue_scripts** — Enqueue admin CSS and JS.
14. **admin_head** — Output in admin `<head>`.

For frontend pages:
11. **parse_request** — WP parses the incoming URL.
12. **send_headers** — HTTP headers are sent.
13. **parse_query** — Query variables are parsed.
14. **pre_get_posts** — Modify the main query before it runs. Very powerful filter.
15. **wp** — WordPress environment is set up, query has run.
16. **template_redirect** — Before template is chosen. Good for custom redirects.
17. **wp_enqueue_scripts** — Enqueue frontend CSS and JS. Never use `init` for this.
18. **wp_head** — Output in `<head>`. Fires `wp_print_styles` and `wp_print_scripts`.
19. **the_post** — Each time a post is set up in the loop.
20. **wp_footer** — Before closing `</body>`. Deferred scripts output here.

### Shutdown

21. **shutdown** — Very last action. Connection may already be closed.

## Key Filters

- **the_content** — Filter post content before display. Priority 10 is default, `wpautop` runs at 10, `shortcode_unautop` at 10.
- **the_title** — Filter post title.
- **pre_get_posts** — Modify WP_Query before execution. Check `$query->is_main_query()` to avoid affecting all queries.
- **posts_where** — Modify the WHERE clause of queries.
- **wp_nav_menu_items** — Filter navigation menu HTML.
- **body_class** — Add/remove CSS classes on `<body>`.
- **excerpt_length** — Change excerpt word count (default 55).
- **upload_mimes** — Add/remove allowed upload MIME types.
- **authenticate** — Filter authentication (runs during login).
- **cron_schedules** — Add custom WP-Cron intervals.

## Hook Best Practices

- Use `add_action()` / `add_filter()` with appropriate priority (default 10, lower = earlier).
- Always check `is_admin()` before admin-only code.
- Use `wp_enqueue_scripts` for frontend assets, `admin_enqueue_scripts` for admin assets.
- Never echo output in filters — always return the modified value.
- Use `pre_get_posts` instead of `query_posts()` to modify the main query.
