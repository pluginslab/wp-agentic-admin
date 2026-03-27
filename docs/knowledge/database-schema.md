# WordPress Database Schema

## Core Tables Overview

WordPress uses 12 core database tables (with the configured prefix, usually `wp_`).

### Content Tables

- **wp_posts** — All content: posts, pages, custom post types, revisions, attachments, nav menu items. The `post_type` column differentiates them. `post_status` can be publish, draft, pending, private, trash, auto-draft, inherit (revisions/attachments).
- **wp_postmeta** — Key-value metadata for posts. Every custom field, ACF field, SEO data, and plugin data lives here. Joined to posts via `post_id`.
- **wp_comments** — Comments on posts. `comment_approved` values: 0 (pending), 1 (approved), spam, trash.
- **wp_commentmeta** — Key-value metadata for comments. Akismet stores spam scores here.

### Taxonomy Tables

- **wp_terms** — Term names and slugs (e.g., "Uncategorized", "news").
- **wp_term_taxonomy** — Links terms to their taxonomy type (category, post_tag, custom). Contains `count` of posts and `parent` for hierarchy.
- **wp_term_relationships** — Junction table linking posts to terms via `object_id` (post ID) and `term_taxonomy_id`.
- **wp_termmeta** — Key-value metadata for terms.

### User Tables

- **wp_users** — User accounts with login, email, password hash, display name.
- **wp_usermeta** — User metadata: roles (`wp_capabilities`), admin color scheme, dashboard settings, plugin preferences.

### Settings Table

- **wp_options** — Site-wide key-value settings. `autoload` column (yes/no) controls which options are loaded into memory on every page request. Plugin settings, widget configurations, and WordPress core settings all live here.

### Legacy

- **wp_links** — Blogroll links. Disabled by default since WordPress 3.5.

## Common Queries

### Count posts by type
```sql
SELECT post_type, COUNT(*) as count FROM wp_posts GROUP BY post_type;
```

### Find large autoloaded options
```sql
SELECT option_name, LENGTH(option_value) as size FROM wp_options WHERE autoload = 'yes' ORDER BY size DESC LIMIT 20;
```

### Get user roles
```sql
SELECT u.user_login, um.meta_value FROM wp_users u JOIN wp_usermeta um ON u.ID = um.user_id WHERE um.meta_key = 'wp_capabilities';
```

## Table Relationships

- Posts -> PostMeta: `wp_posts.ID = wp_postmeta.post_id`
- Posts -> Comments: `wp_posts.ID = wp_comments.comment_post_ID`
- Posts -> Terms: `wp_posts.ID = wp_term_relationships.object_id` -> `wp_term_relationships.term_taxonomy_id = wp_term_taxonomy.term_taxonomy_id` -> `wp_term_taxonomy.term_id = wp_terms.term_id`
- Users -> UserMeta: `wp_users.ID = wp_usermeta.user_id`
- Comments -> CommentMeta: `wp_comments.comment_ID = wp_commentmeta.comment_id`

## Multisite Additional Tables

In multisite, each sub-site gets its own set of tables with numeric prefix (e.g., `wp_2_posts`). Global tables shared across all sites:
- `wp_blogs` — List of sites
- `wp_site` — Network info
- `wp_sitemeta` — Network-wide options
- `wp_registration_log` — User registrations
- `wp_signups` — Pending signups
