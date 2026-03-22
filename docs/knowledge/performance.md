# WordPress Performance

## Object Cache

WordPress has a built-in object cache (`wp_cache_*` functions) that persists data for the duration of a single request. With a persistent cache backend (Redis, Memcached), data persists across requests.

### Functions
- `wp_cache_get( $key, $group )` — Retrieve cached data.
- `wp_cache_set( $key, $data, $group, $expire )` — Store data in cache.
- `wp_cache_add( $key, $data, $group, $expire )` — Add only if key doesn't exist.
- `wp_cache_delete( $key, $group )` — Remove a cache entry.
- `wp_cache_flush()` — Clear entire cache.

### Cache Groups
WordPress uses groups to organize cached data: `posts`, `post_meta`, `users`, `user_meta`, `options`, `terms`, `comment`. Plugins should use their own group name.

### Persistent Cache Backends
Drop-in plugins (`wp-content/object-cache.php`):
- **Redis**: wp-redis, Redis Object Cache
- **Memcached**: memcached-object-cache
- **APCu**: apcu-object-cache

## Database Optimization

### Autoload Optimization
Large autoloaded options slow every page load:
```sql
SELECT option_name, LENGTH(option_value) as size
FROM wp_options WHERE autoload = 'yes'
ORDER BY size DESC LIMIT 20;
```

### Post Revisions
Limit revisions to prevent database bloat:
```php
define( 'WP_POST_REVISIONS', 5 ); // Keep only 5 revisions
define( 'WP_POST_REVISIONS', false ); // Disable revisions
```

### Cleanup Queries
```sql
-- Delete spam comments
DELETE FROM wp_comments WHERE comment_approved = 'spam';

-- Delete post revisions
DELETE FROM wp_posts WHERE post_type = 'revision';

-- Delete orphaned postmeta
DELETE pm FROM wp_postmeta pm LEFT JOIN wp_posts p ON pm.post_id = p.ID WHERE p.ID IS NULL;

-- Delete expired transients
DELETE FROM wp_options WHERE option_name LIKE '_transient_timeout_%' AND option_value < UNIX_TIMESTAMP();
```

## Query Optimization

### Avoid
- `'posts_per_page' => -1` — Loads all posts into memory.
- `'meta_query'` without index — Very slow on large tables.
- `query_posts()` — Replaces the main query. Use `pre_get_posts` instead.
- Queries inside the loop — Use eager loading or caching.

### Optimize
- Add database indexes for frequently-queried meta keys.
- Use `'fields' => 'ids'` when you only need post IDs.
- Use `'no_found_rows' => true` when you don't need pagination.
- Use `'update_post_meta_cache' => false` and `'update_post_term_cache' => false` when you don't need meta/term data.

## HTTP & Asset Optimization

### Script/Style Loading
- `wp_enqueue_script()` with `$in_footer = true` for non-critical scripts.
- Use `wp_script_add_data( $handle, 'strategy', 'defer' )` for deferred loading (WP 6.3+).
- Combine with `wp_register_script()` + conditional `wp_enqueue_script()` to load scripts only on pages that need them.

### HTTP API Caching
Cache external API responses:
```php
$data = get_transient( 'my_api_data' );
if ( false === $data ) {
    $response = wp_remote_get( 'https://api.example.com/data' );
    $data = wp_remote_retrieve_body( $response );
    set_transient( 'my_api_data', $data, HOUR_IN_SECONDS );
}
```

## Debugging Performance

### Query Monitor Plugin
Shows database queries, hooks fired, HTTP requests, and memory usage per page load.

### SAVEQUERIES
```php
define( 'SAVEQUERIES', true );
// Then access: $wpdb->queries (array of all queries with caller info)
```

### Memory Limit
```php
define( 'WP_MEMORY_LIMIT', '256M' );      // Frontend
define( 'WP_MAX_MEMORY_LIMIT', '512M' );   // Admin
```
