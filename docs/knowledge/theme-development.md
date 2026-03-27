# WordPress Theme Development

## Template Hierarchy

WordPress selects template files in a specific order of specificity:

### Pages
1. `page-{slug}.php` — Page with specific slug
2. `page-{id}.php` — Page with specific ID
3. `page.php` — Generic page template
4. `singular.php` — Any singular content
5. `index.php` — Ultimate fallback

### Single Posts
1. `single-{post_type}-{slug}.php` — Specific post by type and slug
2. `single-{post_type}.php` — Specific post type
3. `single.php` — Any single post
4. `singular.php` — Any singular content
5. `index.php`

### Archives
1. `archive-{post_type}.php` — CPT archive
2. `archive.php` — Generic archive
3. `index.php`

### Categories
1. `category-{slug}.php`
2. `category-{id}.php`
3. `category.php`
4. `archive.php`
5. `index.php`

### Search Results
1. `search.php`
2. `index.php`

### 404
1. `404.php`
2. `index.php`

## Theme Setup

### functions.php
```php
add_action( 'after_setup_theme', function () {
    // Enable features
    add_theme_support( 'title-tag' );
    add_theme_support( 'post-thumbnails' );
    add_theme_support( 'custom-logo' );
    add_theme_support( 'html5', array( 'search-form', 'comment-form', 'gallery' ) );
    add_theme_support( 'editor-styles' );

    // Navigation menus
    register_nav_menus( array(
        'primary' => 'Primary Menu',
        'footer'  => 'Footer Menu',
    ) );

    // Image sizes
    add_image_size( 'hero', 1920, 600, true );
} );
```

### Enqueuing Assets
```php
add_action( 'wp_enqueue_scripts', function () {
    wp_enqueue_style( 'theme-style', get_stylesheet_uri(), array(), '1.0' );
    wp_enqueue_script( 'theme-script', get_template_directory_uri() . '/js/main.js', array(), '1.0', true );
} );
```

## Template Tags

### The Loop
```php
if ( have_posts() ) :
    while ( have_posts() ) : the_post();
        the_title( '<h2>', '</h2>' );
        the_content();
        the_post_thumbnail( 'large' );
        the_excerpt();
        the_permalink();
        the_author();
        the_date();
        the_category( ', ' );
        the_tags( 'Tags: ', ', ' );
    endwhile;
    the_posts_pagination();
else :
    // No posts found
endif;
```

### Common Functions
- `get_header()` / `get_footer()` / `get_sidebar()` — Include template parts.
- `get_template_part( 'parts/content', 'post' )` — Include `parts/content-post.php`.
- `body_class()` — Output contextual CSS classes on body.
- `post_class()` — Output contextual CSS classes on post container.
- `wp_nav_menu( array( 'theme_location' => 'primary' ) )` — Display a navigation menu.
- `dynamic_sidebar( 'sidebar-1' )` — Display a widget area.
- `get_template_directory_uri()` — Theme directory URL (parent theme).
- `get_stylesheet_directory_uri()` — Theme directory URL (child theme).

## Block Themes (Full Site Editing)

### theme.json
Controls global styles, settings, and template configuration:
```json
{
    "version": 2,
    "settings": {
        "color": { "palette": [...] },
        "typography": { "fontSizes": [...] },
        "layout": { "contentSize": "800px", "wideSize": "1200px" }
    },
    "styles": {
        "color": { "background": "#ffffff", "text": "#000000" }
    }
}
```

### Block Templates
HTML files in `templates/` directory with block markup:
- `templates/index.html` — Fallback template
- `templates/single.html` — Single post
- `templates/page.html` — Page
- `parts/header.html` — Header template part
- `parts/footer.html` — Footer template part

## Child Themes

Create a child theme to customize a parent theme without losing changes on update:

### style.css
```css
/*
Theme Name: Parent Theme Child
Template: parent-theme-slug
*/
```

### functions.php
```php
add_action( 'wp_enqueue_scripts', function () {
    wp_enqueue_style( 'parent-style', get_template_directory_uri() . '/style.css' );
    wp_enqueue_style( 'child-style', get_stylesheet_uri(), array( 'parent-style' ) );
} );
```

Child theme files override parent theme files with the same name.
