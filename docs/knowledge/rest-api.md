# WordPress REST API

## Endpoints

The REST API is available at `/wp-json/wp/v2/`. Core endpoints:

### Posts & Pages
- `GET /wp/v2/posts` — List posts. Params: per_page, page, search, status, categories, tags, orderby, order.
- `GET /wp/v2/posts/{id}` — Get a single post.
- `POST /wp/v2/posts` — Create a post. Body: title, content, status, categories, tags, meta.
- `PUT /wp/v2/posts/{id}` — Update a post.
- `DELETE /wp/v2/posts/{id}` — Trash a post. Add `?force=true` to permanently delete.
- `GET /wp/v2/pages` — Same pattern for pages.

### Media
- `GET /wp/v2/media` — List media items.
- `POST /wp/v2/media` — Upload file via multipart form data.

### Users
- `GET /wp/v2/users` — List users (requires authentication for full data).
- `GET /wp/v2/users/me` — Current authenticated user.

### Taxonomies
- `GET /wp/v2/categories` — List categories.
- `GET /wp/v2/tags` — List tags.

### Comments
- `GET /wp/v2/comments` — List comments.
- `POST /wp/v2/comments` — Create a comment.

### Settings
- `GET /wp/v2/settings` — Site settings (requires manage_options).

## Authentication

### Cookie Authentication
Default for logged-in users in the browser. Requires a nonce:
```javascript
fetch( '/wp-json/wp/v2/posts', {
    headers: { 'X-WP-Nonce': wpApiSettings.nonce }
} );
```

### Application Passwords (WordPress 5.6+)
For external applications. Generate in Users -> Profile -> Application Passwords.
```bash
curl -u username:xxxx-xxxx-xxxx-xxxx https://example.com/wp-json/wp/v2/posts
```

### JWT / OAuth
Available via plugins (JWT Authentication, WP OAuth Server).

## Registering Custom Endpoints

```php
add_action( 'rest_api_init', function () {
    register_rest_route( 'myplugin/v1', '/items', array(
        'methods'             => 'GET',
        'callback'            => 'my_get_items',
        'permission_callback' => function () {
            return current_user_can( 'edit_posts' );
        },
        'args'                => array(
            'per_page' => array(
                'default'           => 10,
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );
} );
```

## Custom Post Types in REST

Set `show_in_rest => true` and optionally `rest_base` when registering:
```php
register_post_type( 'product', array(
    'show_in_rest' => true,
    'rest_base'    => 'products',
) );
```
Endpoint becomes: `/wp-json/wp/v2/products`

## Common Patterns

### Pagination
Responses include `X-WP-Total` and `X-WP-TotalPages` headers. Use `?page=2&per_page=10`.

### Embedding
Use `?_embed` to include linked resources (author, featured media, terms) in the response.

### Filtering
Use `?search=keyword`, `?categories=1,2`, `?status=draft`, `?after=2024-01-01T00:00:00`.

### Error Responses
REST API returns errors as:
```json
{
    "code": "rest_forbidden",
    "message": "Sorry, you are not allowed to do that.",
    "data": { "status": 403 }
}
```
