# WordPress Post Types & Taxonomies

## Built-in Post Types

- **post** — Blog posts. Supports title, editor, author, thumbnail, excerpt, trackbacks, custom-fields, comments, revisions, post-formats.
- **page** — Static pages. Hierarchical (can have parent pages). Supports title, editor, author, thumbnail, page-attributes, custom-fields, comments, revisions.
- **attachment** — Media library items. Stores file metadata. `post_parent` links to the post it was uploaded to.
- **revision** — Auto-saved revisions of posts/pages. `post_parent` is the original post ID.
- **nav_menu_item** — Navigation menu items. Metadata stores URL, target, classes.

## Custom Post Types (CPTs)

### Registration
```php
register_post_type( 'product', array(
    'labels'       => array( 'name' => 'Products', 'singular_name' => 'Product' ),
    'public'       => true,
    'has_archive'  => true,
    'supports'     => array( 'title', 'editor', 'thumbnail', 'custom-fields' ),
    'show_in_rest' => true, // Required for Gutenberg editor
    'rewrite'      => array( 'slug' => 'products' ),
    'menu_icon'    => 'dashicons-cart',
) );
```

### Key Parameters
- `public` — Visible on frontend and in admin.
- `hierarchical` — Like pages (parent/child). Default false (like posts).
- `has_archive` — Creates an archive page at the rewrite slug.
- `show_in_rest` — Required for block editor support and REST API access.
- `supports` — Features: title, editor, author, thumbnail, excerpt, trackbacks, custom-fields, comments, revisions, page-attributes, post-formats.
- `capability_type` — Base for capabilities (e.g., 'post' gives edit_posts, 'product' gives edit_products).
- `taxonomies` — Array of taxonomy slugs to associate.

## Post Meta

### Functions
- `get_post_meta( $post_id, $key, $single )` — Get metadata. `$single = true` returns a single value, false returns array.
- `update_post_meta( $post_id, $key, $value )` — Update or create metadata.
- `add_post_meta( $post_id, $key, $value, $unique )` — Add metadata. `$unique = true` prevents duplicate keys.
- `delete_post_meta( $post_id, $key, $value )` — Delete metadata.

### Meta in REST API
```php
register_post_meta( 'product', 'price', array(
    'show_in_rest' => true,
    'single'       => true,
    'type'         => 'number',
) );
```

## Built-in Taxonomies

- **category** — Hierarchical. Posts can have multiple categories. Default: "Uncategorized".
- **post_tag** — Flat (non-hierarchical). Free-form tags.
- **nav_menu** — Navigation menus. Used internally.
- **link_category** — Blogroll link categories (legacy).
- **post_format** — Content formats: aside, gallery, link, image, quote, status, video, audio, chat.

## Custom Taxonomies

### Registration
```php
register_taxonomy( 'genre', array( 'book' ), array(
    'labels'       => array( 'name' => 'Genres', 'singular_name' => 'Genre' ),
    'hierarchical' => true,
    'show_in_rest' => true,
    'rewrite'      => array( 'slug' => 'genre' ),
) );
```

### Term Functions
- `get_terms( $args )` — Query terms. Args: taxonomy, hide_empty, number, orderby.
- `wp_get_post_terms( $post_id, $taxonomy )` — Get terms attached to a post.
- `wp_set_post_terms( $post_id, $terms, $taxonomy )` — Set terms on a post.
- `get_term_meta( $term_id, $key, $single )` — Get term metadata.

## Term Relationships Storage

The relationship between posts and terms uses three tables:
1. `wp_terms` holds the term name/slug
2. `wp_term_taxonomy` links term to taxonomy with count and parent
3. `wp_term_relationships` links post ID (`object_id`) to `term_taxonomy_id`
