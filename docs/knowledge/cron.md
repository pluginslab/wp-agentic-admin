# WordPress Cron System

## How WP-Cron Works

WordPress has a pseudo-cron system that checks for scheduled tasks on every page load. Unlike a real system cron, WP-Cron only fires when someone visits the site.

### Execution Flow
1. A visitor loads any page.
2. WordPress checks `wp_options` for the `cron` option (serialized array of scheduled events).
3. If any events are past due, WordPress spawns a non-blocking HTTP request to `wp-cron.php`.
4. `wp-cron.php` runs the due events.

### Limitations
- Events won't run if the site has no traffic.
- High-traffic sites may trigger cron on every page load (wasted resources).
- Long-running tasks block the cron request.

## Scheduling Events

### Single Event
```php
// Schedule once, 1 hour from now
wp_schedule_single_event( time() + HOUR_IN_SECONDS, 'my_one_time_event' );

// Hook handler
add_action( 'my_one_time_event', function () {
    // Do something once
} );
```

### Recurring Event
```php
// Schedule recurring (check if not already scheduled first)
if ( ! wp_next_scheduled( 'my_hourly_task' ) ) {
    wp_schedule_event( time(), 'hourly', 'my_hourly_task' );
}

add_action( 'my_hourly_task', function () {
    // Runs every hour
} );
```

### Custom Intervals
```php
add_filter( 'cron_schedules', function ( $schedules ) {
    $schedules['every_five_minutes'] = array(
        'interval' => 300,
        'display'  => 'Every 5 Minutes',
    );
    return $schedules;
} );
```

### Built-in Intervals
- `hourly` — 3600 seconds
- `twicedaily` — 43200 seconds
- `daily` — 86400 seconds
- `weekly` — 604800 seconds (WordPress 5.4+)

## Managing Cron

### Useful Functions
- `wp_next_scheduled( $hook )` — Get timestamp of next run, or false.
- `wp_unschedule_event( $timestamp, $hook )` — Remove a specific scheduled event.
- `wp_clear_scheduled_hook( $hook )` — Remove all instances of a scheduled hook.
- `wp_get_scheduled_event( $hook )` — Get event details.
- `_get_cron_array()` — Get all scheduled events (internal function).
- `wp_unschedule_hook( $hook )` — Remove all events for a hook (WordPress 4.9.0+).

### Plugin Cleanup
Always unschedule cron events on plugin deactivation:
```php
register_deactivation_hook( __FILE__, function () {
    wp_clear_scheduled_hook( 'my_hourly_task' );
} );
```

## Common Issues

### Events not running
- **No traffic**: Use a real system cron (`* * * * * wget -q -O - https://example.com/wp-cron.php`).
- **Disabled**: `define( 'DISABLE_WP_CRON', true )` in wp-config.php (common with real cron).
- **Object cache**: Some caching plugins interfere. Check `wp_options` cron entry.
- **Long-running events**: Previous cron still executing. WordPress has a lock mechanism (15-minute timeout).

### Too many cron events
- Plugins may schedule events without cleanup on deactivation.
- Use WP-CLI: `wp cron event list` to see all scheduled events.
- Orphaned events: hooks with no registered callback. They run but do nothing.

### Performance
For high-traffic sites:
1. Disable WP-Cron in wp-config.php: `define( 'DISABLE_WP_CRON', true );`
2. Set up a system cron to hit wp-cron.php every minute.
3. This prevents multiple simultaneous cron executions.

## WP-CLI Cron Commands

- `wp cron event list` — List all scheduled events.
- `wp cron event run --all` — Run all due events.
- `wp cron event run my_hook` — Run a specific event.
- `wp cron event delete my_hook` — Delete a scheduled event.
- `wp cron schedule list` — List available recurrence schedules.
