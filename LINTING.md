# WordPress Coding Standards - Linting Guide

This project follows WordPress Coding Standards for both PHP and JavaScript.

## Quick Start

```bash
# Install dependencies
composer install
npm install

# Run all linters
npm run lint

# Auto-fix issues where possible
npm run lint:fix
```

## PHP Linting (PHPCS)

### Configuration

- **Config file**: `phpcs.xml.dist`
- **Standards**: WordPress Coding Standards (WPCS) 3.3.0
- **PHP version**: 8.2+
- **Text domain**: `wp-agentic-admin`
- **Prefixes**: `wp_agentic_admin`, `WPAgenticAdmin`

### Commands

```bash
# Check PHP files
npm run lint:php
# or
composer lint

# Auto-fix PHP issues
npm run lint:php:fix
# or
composer lint:fix

# Show only errors (ignore warnings)
composer lint:errors
```

### What PHPCS Checks

✅ WordPress Coding Standards compliance
✅ PHP 8.2+ compatibility
✅ Text domain consistency (`wp-agentic-admin`)
✅ Global namespace prefixing
✅ Security best practices (escaping, sanitization)
✅ Code formatting and indentation

### Common PHP Issues

**Problem**: Missing text domain
```php
// Bad
__( 'Hello', 'wrong-domain' );

// Good
__( 'Hello', 'wp-agentic-admin' );
```

**Problem**: Unprefixed global
```php
// Bad
function my_function() {}

// Good
function wp_agentic_admin_my_function() {}
```

**Problem**: Short array syntax (WordPress requires long form)
```php
// Allowed in this project (excluded in phpcs.xml.dist)
$array = ['foo', 'bar'];
```

## JavaScript Linting (ESLint)

### Configuration

- **Config file**: `.eslintrc.js`
- **Standards**: WordPress JavaScript Coding Standards (via `@wordpress/scripts`)
- **Environment**: Browser, ES2021, Node, React JSX

### Commands

```bash
# Check JavaScript files
npm run lint:js

# Auto-fix JavaScript issues
npm run lint:js:fix

# Check CSS/SCSS files
npm run lint:css

# Auto-fix CSS issues
npm run lint:css:fix
```

### What ESLint Checks

✅ WordPress JavaScript Coding Standards
✅ React/JSX best practices
✅ ES2021 syntax compliance
✅ Dependency grouping (`@wordpress/dependency-group`)
✅ Code formatting and consistency

### Common JS Issues

**Problem**: Wrong import grouping
```javascript
// Bad - WordPress imports not grouped
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import MyComponent from './MyComponent';

// Good - WordPress imports grouped together
import { __ } from '@wordpress/i18n';
import { useState } from 'react';

import MyComponent from './MyComponent';
```

**Problem**: Unused variables before return
```javascript
// Warning
const handleClick = () => {
    const unused = 'value';
    return 'result';
};

// Good
const handleClick = () => {
    return 'result';
};
```

## IDE Integration

### VS Code

Install these extensions for real-time linting:

1. **PHP**:
   - [phpcs](https://marketplace.visualstudio.com/items?itemName=shevaua.phpcs)
   - Add to `.vscode/settings.json`:
     ```json
     {
       "phpcs.enable": true,
       "phpcs.standard": "WordPress"
     }
     ```

2. **JavaScript**:
   - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
   - Auto-fix on save:
     ```json
     {
       "editor.codeActionsOnSave": {
         "source.fixAll.eslint": true
       }
     }
     ```

### PHPStorm

1. **PHP**: Settings → PHP → Quality Tools → PHP_CodeSniffer
   - Configuration: `vendor/bin/phpcs`
   - Coding standard: WordPress

2. **JavaScript**: Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
   - Automatic ESLint configuration

## Pre-Commit Hooks (Optional)

To automatically lint files before committing:

```bash
npm install --save-dev husky lint-staged

# Add to package.json
{
  "lint-staged": {
    "*.php": "composer lint:fix",
    "*.js": "npm run lint:js:fix",
    "*.scss": "npm run lint:css:fix"
  }
}
```

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'

      - name: Install Composer dependencies
        run: composer install

      - name: Install npm dependencies
        run: npm install

      - name: Lint PHP
        run: composer lint

      - name: Lint JavaScript
        run: npm run lint:js

      - name: Lint CSS
        run: npm run lint:css
```

## Files Excluded from Linting

Both PHPCS and ESLint ignore:
- `node_modules/`
- `vendor/`
- `build-extensions/`

## Overriding Rules

### PHP (phpcs.xml.dist)

```xml
<rule ref="WordPress">
    <exclude name="WordPress.Files.FileName"/>
</rule>
```

### JavaScript (.eslintrc.js)

```javascript
rules: {
    'no-console': 'off', // Allow console.log
}
```

## Troubleshooting

**PHPCS not finding WordPress standards**:
```bash
composer install
vendor/bin/phpcs -i  # Should list "WordPress" standards
```

**ESLint not working**:
```bash
npm install
npm run lint:js -- --debug
```

**Different results locally vs CI**:
- Ensure same versions in `composer.lock` and `package-lock.json`
- Commit lock files to repository

## Resources

- [WordPress PHP Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/php/)
- [WordPress JavaScript Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/javascript/)
- [WPCS GitHub](https://github.com/WordPress/WordPress-Coding-Standards)
- [@wordpress/scripts](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/)
