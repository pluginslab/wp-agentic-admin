# Contributing to WP Agentic Admin

Thank you for your interest in contributing to WP Agentic Admin! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Contribution Types](#contribution-types)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Community](#community)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [your contact email].

## Getting Started

### Prerequisites

- WordPress 6.9+
- PHP 8.2+
- Node.js 18+ and npm
- Modern browser with WebGPU support (Chrome 113+, Edge 113+)
- Git

### Local Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/wordpress-agentic-admin.git
   cd wordpress-agentic-admin
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/pluginslab/wordpress-agentic-admin.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Start development build**:
   ```bash
   npm run watch
   ```

6. **Set up WordPress**:
   - Copy plugin to your local WordPress installation: `wp-content/plugins/wp-agentic-admin/`
   - Activate the plugin
   - Navigate to "Agentic Admin" in WordPress admin

## Development Workflow

### Branch Strategy

- `main` - Primary development and release branch
- Feature branches - Created from `main` for new features/fixes

### Creating a Feature Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create your feature branch
git checkout -b feature/your-feature-name
# or for bug fixes:
git checkout -b fix/bug-description
```

### Staying Up to Date

```bash
# Regularly sync with upstream
git checkout main
git pull upstream main

# Rebase your feature branch
git checkout feature/your-feature-name
git rebase main
```

## Contribution Types

### 1. Implementing New Abilities

Abilities are atomic WordPress operations. See [Abilities Guide](../docs/ABILITIES-GUIDE.md) for details.

**Requirements:**
- PHP implementation using `register_agentic_ability()`
- JavaScript configuration with keywords and UI messages
- Input/output schema definitions
- Permission checks using WordPress capabilities
- Documentation with example queries

**Checklist:**
- [ ] PHP file in `includes/abilities/`
- [ ] JS file in `src/extensions/abilities/`
- [ ] Registered in `includes/class-abilities.php`
- [ ] Keywords that trigger the ability
- [ ] Permission callback
- [ ] Tests (if applicable)
- [ ] Documentation update

### 2. Creating Workflows

Workflows are multi-step sequences. See [Workflows Guide](../docs/WORKFLOWS-GUIDE.md).

**Requirements:**
- Workflow definition with clear steps
- Keywords for detection
- Confirmation requirements
- Rollback handling (if needed)
- Documentation

### 3. Improving the ReAct Agent

The ReAct agent decides tool selection. Located in `src/extensions/services/react-agent.js`.

**Areas for improvement:**
- Better reasoning logic
- Improved error recovery
- More efficient tool selection
- Better handling of ambiguous queries

### 4. Documentation

Help others understand and use the project:
- User guides
- Developer tutorials
- Code comments
- API documentation
- Example use cases

### 5. Testing

- Manual testing with real WordPress sites
- Automated tests for abilities and workflows
- Edge case testing
- Performance testing
- Browser compatibility testing

## Coding Standards

### PHP

Follow [WordPress PHP Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/php/):

```php
// Good
function wp_agentic_admin_example_function( string $param ): bool {
    if ( ! current_user_can( 'manage_options' ) ) {
        return false;
    }

    return true;
}
```

### JavaScript

Follow [WordPress JavaScript Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/javascript/):

```javascript
// Good
export function exampleFunction( param ) {
    if ( ! param ) {
        return null;
    }

    return processParam( param );
}
```

### Code Quality

- **Use meaningful names** - Variables and functions should be self-documenting
- **Keep functions small** - One responsibility per function
- **Comment complex logic** - Explain why, not what
- **Avoid duplication** - Use shared helpers
- **Handle errors** - Always check for error conditions

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- react-agent

# Watch mode
npm run test:watch
```

### Writing Tests

Place unit tests in `src/extensions/services/__tests__/` next to the source they test:

```javascript
import { exampleFunction } from '../example';

describe('exampleFunction', () => {
    it('should handle valid input', () => {
        const result = exampleFunction('test');
        expect(result).toBe('expected-value');
    });

    it('should handle invalid input', () => {
        const result = exampleFunction(null);
        expect(result).toBeNull();
    });
});
```

### E2E Browser Tests

The project also includes E2E tests that validate the full AI pipeline in a real browser. These are defined in `tests/e2e/` and executed via Claude Code using Chrome DevTools MCP. See [tests/TESTING.md](../tests/TESTING.md) for details.

## Pull Request Process

### Before Submitting

1. **Update your branch** with latest `main`:
   ```bash
   git checkout main
   git pull upstream main
   git checkout feature/your-feature-name
   git rebase main
   ```

2. **Run tests**:
   ```bash
   npm test
   npm run build
   ```

3. **Review your changes**:
   ```bash
   git diff develop
   ```

### Commit Messages

Write clear, descriptive commit messages:

```
Short (50 chars or less) summary

More detailed explanatory text, if necessary. Wrap it to about 72
characters. The blank line separating the summary from the body is
critical.

- Bullet points are okay
- Use imperative mood: "Add feature" not "Added feature"
- Reference issues: Fixes #123, Closes #456
```

**AI Assistance Disclosure (Required):**
If you used AI tools (ChatGPT, Claude, Copilot, etc.), add to your commit message:

```
Add new cache-warming ability

Implemented cache-warming ability that pre-loads critical pages
after cache flush.

AI Assistance: Claude Code was used to generate the initial
ability structure and test cases.
```

### Creating the Pull Request

1. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create PR on GitHub**:
   - Base branch: `main`
   - Compare branch: `your-fork:feature/your-feature-name`
   - Fill out the PR template completely

3. **PR Title Format**:
   - `feat: Add new ability for X`
   - `fix: Resolve issue with Y`
   - `docs: Update Z documentation`
   - `refactor: Improve A implementation`
   - `test: Add tests for B`

### PR Review Process

1. Automated checks will run (tests, linting)
2. Maintainers will review your code
3. Address any feedback by pushing new commits
4. Once approved, your PR will be merged into `main`

### What Happens Next

- Your changes will be included in the next release
- Your contribution will be credited in release notes
- You'll be added to the contributors list

## Community

### Where to Get Help

- **GitHub Discussions**: General questions and discussions
- **WordPress Slack**: Real-time chat in `#agentic-admin`
- **Issue Comments**: Technical questions about specific issues

### Communication Guidelines

- **Be respectful** - Follow the Code of Conduct
- **Be patient** - Maintainers are volunteers
- **Be clear** - Provide context and examples
- **Search first** - Check if your question has been answered
- **Share knowledge** - Help others when you can

## Recognition

We value all contributions! Contributors are recognized in:
- Project README
- Release notes
- GitHub contributors page

## Questions?

Don't hesitate to ask for help:
- Open a [GitHub Discussion](https://github.com/pluginslab/wordpress-agentic-admin/discussions)
- Join us on WordPress Slack: `#agentic-admin`
- Comment on relevant issues

Thank you for contributing to WP Agentic Admin! 🎉
