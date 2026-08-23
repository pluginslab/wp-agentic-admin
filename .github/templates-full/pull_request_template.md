## Description

<!-- Provide a brief description of the changes in this PR -->

## Type of Change

<!-- Check all that apply -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New ability (adds a new atomic operation)
- [ ] New workflow (adds a multi-step sequence)
- [ ] Enhancement (improves existing functionality)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Testing (adds or improves tests)

## Related Issues

<!-- Link to related issues. Use "Fixes #123" to auto-close issues when PR is merged -->

Fixes #
Related to #

## Changes Made

<!-- Detailed list of changes -->

-
-
-

## Testing

<!-- Describe how you tested these changes -->

- [ ] Tested locally with WordPress 6.9+
- [ ] Tested in Chrome/Edge with WebGPU
- [ ] Tested ability/workflow execution
- [ ] Added/updated automated tests
- [ ] Verified WordPress coding standards (PHP/JS)

**Test Environment:**
- WordPress version:
- PHP version:
- Browser:

**Test Results:**
<!-- Describe what you tested and the results -->

## Screenshots/Demo

<!-- If applicable, add screenshots or a demo GIF -->

## For New Abilities

<!-- Complete this section if you're adding a new ability -->

- [ ] PHP implementation in `includes/abilities/`
- [ ] JS configuration in `src/extensions/abilities/`
- [ ] Registered in `includes/class-abilities.php`
- [ ] Input/output schemas defined
- [ ] Permission callback implemented
- [ ] Keywords added for natural language triggers
- [ ] Documentation added/updated
- [ ] Example queries provided

**Ability Details:**
- Ability ID: `agentic-admin/`
- Category:
- Operation Type: [ ] read-only [ ] write [ ] write-destructive
- Required Capability:

**Example Queries:**
<!-- Natural language queries that trigger this ability -->

1.
2.
3.

## For New Workflows

<!-- Complete this section if you're adding a new workflow -->

- [ ] Workflow definition created
- [ ] Steps clearly defined
- [ ] Keywords added for detection
- [ ] Confirmation requirements set
- [ ] Rollback handling (if applicable)
- [ ] Documentation added/updated

**Workflow Details:**
- Workflow ID:
- Steps:
- Requires Confirmation: [ ] Yes [ ] No

**Trigger Keywords:**
<!-- Keywords that detect this workflow -->

1.
2.
3.

## Documentation

<!-- Check all that apply -->

- [ ] README updated (if needed)
- [ ] CHANGELOG.md updated
- [ ] Inline code comments added
- [ ] API documentation updated (if applicable)
- [ ] Architecture documentation updated (if applicable)

## AI Assistance Disclosure

<!-- Required: Disclose if you used AI tools (ChatGPT, Claude, Copilot, etc.) -->

- [ ] No AI assistance was used
- [ ] AI assistance was used (describe below)

**AI Tools Used:**
<!-- If applicable, describe which AI tools you used and how -->

## Checklist

<!-- Ensure all items are complete before requesting review -->

- [ ] I have read the [CONTRIBUTING.md](CONTRIBUTING.md) guidelines
- [ ] My code follows the WordPress coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] My changes generate no new warnings or errors
- [ ] I have added tests that prove my fix/feature works (if applicable)
- [ ] New and existing tests pass locally
- [ ] I have updated the documentation accordingly
- [ ] I have disclosed any AI assistance used

## Additional Notes

<!-- Any additional information that reviewers should know -->
