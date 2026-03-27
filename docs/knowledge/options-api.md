# WordPress Options API

## Core Functions

### get_option( $option, $default )
Retrieve a single option value from wp_options. Returns `$default` (false by default) if the option doesn't exist. Autoloaded options are cached in memory after the first page load.

### update_option( $option, $value, $autoload )
Update or create an option. The `$autoload` parameter (default null, meaning "yes" for new options) controls whether the option is loaded into memory on every page request.

### add_option( $option, $value, $deprecated, $autoload )
Add a new option only if it doesn't already exist. Prefer this over `update_option` when creating options for the first time to avoid race conditions.

### delete_option( $option )
Remove an option from the database entirely.

## Autoload

Options with `autoload = 'yes'` are loaded in a single query on every page request and cached in the object cache. This is efficient for frequently-used small values but problematic for:
- Large serialized arrays (widget settings, plugin configurations)
- Options rarely needed (only on specific admin pages)

### Diagnosing autoload bloat
```sql
SELECT option_name, LENGTH(option_value) as size
FROM wp_options WHERE autoload = 'yes'
ORDER BY size DESC LIMIT 20;
```

Total autoloaded data should ideally be under 1MB. Common offenders: `_transient_*`, large plugin settings, `widget_*` options.

## Transients API

Transients are temporary cached values with an expiration time.

### set_transient( $transient, $value, $expiration )
Store a transient. `$expiration` is in seconds. Use constants: `HOUR_IN_SECONDS`, `DAY_IN_SECONDS`, `WEEK_IN_SECONDS`.

### get_transient( $transient )
Retrieve a transient. Returns false if expired or doesn't exist.

### delete_transient( $transient )
Remove a transient before it expires.

### Storage behavior
- **Without object cache**: Stored in wp_options as `_transient_{name}` and `_transient_timeout_{name}`. Expired transients are cleaned up lazily.
- **With object cache** (Redis, Memcached): Stored in the external cache with native TTL support. Much more efficient.

## Site Options (Multisite)

- `get_site_option()` / `update_site_option()` — Network-wide options stored in wp_sitemeta.
- `get_network_option()` / `update_network_option()` — Same as site options, more explicit naming.

## Common Core Options

- `blogname` — Site title
- `blogdescription` — Site tagline
- `siteurl` — WordPress installation URL
- `home` — Site homepage URL
- `admin_email` — Admin email address
- `active_plugins` — Serialized array of active plugin paths
- `template` — Active parent theme
- `stylesheet` — Active child theme (or same as template)
- `permalink_structure` — Permalink format string
- `date_format` / `time_format` — Date/time display formats
- `posts_per_page` — Blog posts per page (default 10)
- `default_role` — Default role for new users
