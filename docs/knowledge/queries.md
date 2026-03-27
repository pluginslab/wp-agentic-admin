# WordPress Query System

## WP_Query

The main class for querying posts. Powers the main loop and custom queries.

### Basic Usage
```php
$query = new WP_Query( array(
    'post_type'      => 'post',
    'posts_per_page' => 10,
    'orderby'        => 'date',
    'order'          => 'DESC',
) );

while ( $query->have_posts() ) {
    $query->the_post();
    the_title();
    the_content();
}
wp_reset_postdata();
```

### Common Parameters
- `post_type` — 'post', 'page', 'attachment', custom type, or array.
- `post_status` — 'publish', 'draft', 'pending', 'private', 'trash', 'any'.
- `posts_per_page` — Number of posts. Use -1 for all.
- `paged` — Page number for pagination.
- `orderby` — 'date', 'title', 'menu_order', 'meta_value', 'meta_value_num', 'rand'.
- `meta_key` / `meta_value` — Simple meta query.
- `tax_query` — Taxonomy query (see below).
- `meta_query` — Complex meta queries (see below).
- `s` — Search keyword.
- `author` / `author__in` — Filter by author.
- `date_query` — Filter by date range.

### Meta Queries
```php
'meta_query' => array(
    'relation' => 'AND',
    array(
        'key'     => 'price',
        'value'   => 100,
        'compare' => '>=',
        'type'    => 'NUMERIC',
    ),
    array(
        'key'     => 'color',
        'value'   => array( 'red', 'blue' ),
        'compare' => 'IN',
    ),
)
```
Compare operators: `=`, `!=`, `>`, `>=`, `<`, `<=`, `LIKE`, `NOT LIKE`, `IN`, `NOT IN`, `BETWEEN`, `NOT BETWEEN`, `EXISTS`, `NOT EXISTS`.

### Taxonomy Queries
```php
'tax_query' => array(
    'relation' => 'AND',
    array(
        'taxonomy' => 'category',
        'field'    => 'slug',
        'terms'    => array( 'news', 'updates' ),
    ),
    array(
        'taxonomy' => 'post_tag',
        'field'    => 'term_id',
        'terms'    => array( 5, 10 ),
        'operator' => 'NOT IN',
    ),
)
```

## pre_get_posts

Modify the main query before it executes. The recommended way to alter the main loop:
```php
add_action( 'pre_get_posts', function ( $query ) {
    if ( ! is_admin() && $query->is_main_query() && $query->is_home() ) {
        $query->set( 'posts_per_page', 5 );
        $query->set( 'post_type', array( 'post', 'news' ) );
    }
} );
```

## $wpdb Direct Queries

For complex queries that WP_Query can't handle:
```php
global $wpdb;

// Prepared statement (always use for user input)
$results = $wpdb->get_results(
    $wpdb->prepare(
        "SELECT * FROM {$wpdb->posts} WHERE post_type = %s AND post_status = %s",
        'post',
        'publish'
    )
);

// Get a single value
$count = $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->posts}" );

// Get a single row
$post = $wpdb->get_row( $wpdb->prepare(
    "SELECT * FROM {$wpdb->posts} WHERE ID = %d", $post_id
) );
```

### $wpdb Methods
- `get_results( $query, $output_type )` — Multiple rows. Output: OBJECT, ARRAY_A, ARRAY_N.
- `get_row( $query, $output_type )` — Single row.
- `get_col( $query )` — Single column as array.
- `get_var( $query )` — Single value.
- `insert( $table, $data, $format )` — Insert a row.
- `update( $table, $data, $where, $format, $where_format )` — Update rows.
- `delete( $table, $where, $format )` — Delete rows.
- `prepare( $query, ...$args )` — Prepare a query with placeholders (%s, %d, %f).

### Table References
Use `$wpdb->prefix` or named properties:
- `$wpdb->posts`, `$wpdb->postmeta`
- `$wpdb->comments`, `$wpdb->commentmeta`
- `$wpdb->users`, `$wpdb->usermeta`
- `$wpdb->options`
- `$wpdb->terms`, `$wpdb->term_taxonomy`, `$wpdb->term_relationships`

## get_posts()

Simpler wrapper around WP_Query for fetching an array of posts:
```php
$posts = get_posts( array(
    'post_type'   => 'product',
    'numberposts' => 5,
    'meta_key'    => 'featured',
    'meta_value'  => '1',
) );
```
Note: uses `numberposts` instead of `posts_per_page`, and `suppress_filters` defaults to true.
