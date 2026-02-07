# WP-Agentic-Admin Roadmap

This document outlines the future development roadmap for WP-Agentic-Admin, building on the v1.0 foundation.

## Version 1.0 (Current Baseline) ✅

**Status:** Complete

**What's In v1.0:**
- ✅ ReAct (Reasoning + Acting) loop for adaptive execution
- ✅ 3-tier message routing (conversational/workflow/ReAct)
- ✅ 12 SRE abilities (cache, database, plugins, site health, error logs, cron, rewrites)
- ✅ 4 pre-defined workflows (site cleanup, performance check, plugin audit, database maintenance)
- ✅ Semi-flexible workflows with includeIf conditions (function-based and LLM-based)
- ✅ Dual-mode LLM support (function calling + prompt-based JSON)
- ✅ Service Worker persistence for model across page navigation
- ✅ Confirmation dialogs for destructive actions
- ✅ 43 automated tests with 80%+ coverage
- ✅ Optimized for 1.5B-3B parameter models (Qwen, Phi-3, Gemma)
- ✅ Local-first architecture (WebLLM + WebGPU)
- ✅ WordPress Abilities API integration

**Architecture Achievement:**
- Reduced codebase by ~2,200 lines (35% smaller)
- Simplified from 4-tier routing to 3-tier
- Clean, testable, maintainable foundation

---

## Version 1.1: Small Model Optimizations 🎯

**Focus:** Improve reliability and quality for 1.5B-3B parameter models

**Priority:** HIGH
**Timeline:** 2-4 weeks

### Features

#### 1. Error Recovery Improvements
**Problem:** Small models struggle when tools fail or return errors.

**Current Behavior:**
- Model calls `plugin-deactivate` with "broken-plugin"
- Tool returns `{success: false, message: "Plugin not found"}`
- Model hallucinates invalid tool names or gets stuck in loops

**Solution:**
- Add error context to system prompt (common failure modes)
- Provide explicit recovery suggestions in tool error responses
- Add "error recovery" examples to few-shot prompts
- Implement graceful degradation with helpful fallback messages

**Code Locations:**
- `src/extensions/services/react-agent.js:188` (TODO Hackathon)
- `src/extensions/services/react-agent.js:377` (TODO Hackathon)

**Testing:**
- Test case: "show errors and deactivate broken plugin"
- Verify model handles missing plugin gracefully
- No hallucinated tool calls after errors

---

#### 2. JSON Output Robustness
**Problem:** Small models produce malformed JSON (unescaped control characters, single quotes, missing quotes).

**Current Mitigations:**
- Sanitize control characters (\n, \t)
- Fix single quotes → double quotes
- Add missing quotes after property names
- Extract first valid JSON object

**Enhancements:**
- Add more sophisticated JSON repair strategies
- Detect and fix trailing commas
- Handle partial JSON output (model cuts off mid-response)
- Add JSON schema validation with helpful error messages
- Experiment with different temperature settings for more reliable output

**Code Location:**
- `src/extensions/services/react-agent.js:525` (TODO Hackathon)

**Testing:**
- Stress test with intentionally malformed JSON inputs
- Verify all repair strategies work correctly
- Maintain 100% parse success rate

---

#### 3. Prompt Engineering for Smaller Models
**Problem:** Over-eager tool calling (e.g., "flush cache" triggers both cache-flush AND transient-flush).

**Current Approach:**
- Complex system prompts with function definitions
- Technical language about JSON and tool schemas

**Simplifications to Explore:**
- Use simpler, more direct language
- Provide explicit "DO ONE THING" instruction
- Add examples of single-tool vs multi-tool scenarios
- Emphasize "STOP when you've answered the question"
- Reduce technical jargon in descriptions

**Code Locations:**
- `src/extensions/services/react-agent.js:768` (TODO Hackathon - function calling)
- `src/extensions/services/react-agent.js:817` (TODO Hackathon - prompt-based)

**Testing:**
- Test case: "flush cache" → should call ONE tool
- Test case: "list plugins" → should call plugin-list once and stop
- Verify stopping behavior improves (target: 95%+ correct)

---

#### 4. Better Question Detection
**Problem:** Regex-based question detection is brittle for small models.

**Current Regex Patterns:**
```javascript
/^\s*(what|how|why|explain|tell me|describe)/i
```

**Limitations:**
- Misses: "I need to know what transients are"
- False positives: "how many plugins do I have?" (needs tool call, not conversation)

**Improvements:**
- Explore lightweight classifier (tiny model trained on question/action pairs)
- Add more sophisticated regex with negative lookups
- Detect "actionable questions" (need tool execution) vs "informational questions"
- Use LLM-based classification as fallback for ambiguous cases

**Code Location:**
- `src/extensions/services/message-router.js:28` (TODO Hackathon)

**Testing:**
- Test suite with 100+ varied queries
- Measure false positive/negative rates
- Target: 95%+ correct routing

---

#### 5. Error Log Output Improvement
**Problem:** Shows first few log entries instead of most recent errors.

**Current Behavior:**
- Returns first N entries from debug.log
- Often shows old/irrelevant errors

**Enhancement:**
- Filter by log level: show last 3 "ERROR" entries
- If no errors, show last 3 "WARNING" entries
- If no warnings, show last 3 entries of any level
- Add timestamp highlighting (< 1 hour ago, < 24 hours, older)

**Code Location:**
- `src/extensions/services/react-agent.js:496` (TODO Hackathon)
- `includes/abilities/error-log-read.php` (backend changes)

**Testing:**
- Test with various log files (errors, warnings, mixed)
- Verify correct prioritization
- Test empty log file handling

---

### Success Criteria

- ✅ Error recovery: 90%+ graceful handling of tool failures
- ✅ JSON parsing: 100% success rate (no crashes)
- ✅ Tool calling: 95%+ single-tool accuracy
- ✅ Question detection: 95%+ correct routing
- ✅ Error logs: Always shows most relevant entries

---

## Version 1.2: Expanded Ability Library 📚

**Focus:** Add more SRE capabilities and WordPress-specific tools

**Priority:** MEDIUM
**Timeline:** 3-5 weeks

### New Abilities

#### Site Management
1. **`theme-list`** - List all installed themes with activation status
2. **`theme-activate`** - Activate a specific theme (with confirmation)
3. **`user-list`** - List WordPress users with roles and capabilities
4. **`user-role-update`** - Change a user's role (admin-only, with confirmation)
5. **`permalink-update`** - Update permalink structure
6. **`maintenance-mode`** - Enable/disable maintenance mode

#### Content Operations
7. **`post-list`** - List recent posts by type, status, or author
8. **`post-publish`** - Publish a draft post (with preview)
9. **`comment-stats`** - Get comment statistics (pending, spam, approved)
10. **`comment-moderate`** - Bulk approve/spam pending comments

#### Security & Diagnostics
11. **`security-scan`** - Run basic security checks (file permissions, salts, versions)
12. **`backup-check`** - Verify backup plugin status and last backup date
13. **`update-check`** - Check for WordPress/plugin/theme updates
14. **`disk-usage`** - Check wp-content disk usage (uploads, plugins, themes)

#### Performance
15. **`opcode-cache-status`** - Check PHP opcode cache (OPcache) status
16. **`slow-query-log`** - Read MySQL slow query log (if enabled)

### New Workflows

1. **`security-audit`**
   - Steps: security-scan → update-check → backup-check → site-health
   - Purpose: Comprehensive security review

2. **`content-audit`**
   - Steps: post-list → comment-stats → user-list
   - Purpose: Content management overview

3. **`pre-deployment-check`**
   - Steps: backup-check → site-health → security-scan → update-check
   - Purpose: Verify site is ready for changes

### Success Criteria

- ✅ All new abilities registered and tested
- ✅ Abilities follow dual PHP+JS pattern
- ✅ New workflows have good `summarize()` functions
- ✅ Documentation updated in ABILITIES-GUIDE.md

---

## Version 1.3: Template Workflows (LLM-Composed) 🤖

**Focus:** Flexible, LLM-composed workflows for open-ended queries

**Priority:** MEDIUM
**Timeline:** 4-6 weeks

### Concept

**Current Workflows:** Rigid (fixed steps) or Semi-Flexible (conditional steps)

**Template Workflows:** LLM selects and orders steps from available abilities based on user intent.

### Example Use Cases

**User:** "something is broken"

**Current Behavior:** ReAct loop explores adaptively (works, but slow)

**Template Workflow:**
1. LLM analyzes query: "Broken site diagnostic"
2. Selects relevant abilities: `[site-health, error-log-read, plugin-list, cron-list]`
3. Orders them by priority: `site-health` (high) → `error-log-read` (high) → `plugin-list` (medium)
4. Generates workflow on-the-fly
5. Shows user preview: "I'm going to check site health, error logs, and plugins. Continue?"
6. Executes selected steps

### Implementation

**Workflow Definition:**
```javascript
wp.agenticAdmin.registerWorkflow('wp-agentic-admin/diagnostic', {
    label: 'Site Diagnostic',
    description: 'Intelligently diagnose site issues.',
    keywords: ['broken', 'not working', 'something wrong', 'diagnose'],
    template: true, // NEW: LLM-composed workflow

    availableSteps: [
        {
            abilityId: 'site-health',
            priority: 'high',
            keywords: ['health', 'status', 'check'],
            category: 'diagnostic'
        },
        {
            abilityId: 'error-log-read',
            priority: 'high',
            keywords: ['error', 'log', 'crash', 'fatal'],
            category: 'diagnostic'
        },
        {
            abilityId: 'plugin-list',
            priority: 'medium',
            keywords: ['plugin', 'extension', 'broken plugin'],
            category: 'plugins'
        },
        // ... more abilities
    ],

    selectionPrompt: `
        User said: "{userMessage}"

        Available diagnostic tools:
        {availableSteps}

        Select 3-5 tools to run, ordered by priority.
        Return JSON: { "steps": ["ability-id-1", "ability-id-2", ...], "reason": "why these tools" }
    `,

    requiresConfirmation: true, // Show preview before executing
});
```

**Workflow Orchestrator Changes:**
- Detect `template: true` workflows
- Call LLM to compose step list
- Generate preview message with selected steps
- Request user confirmation
- Execute composed workflow

### Challenges

1. **LLM Accuracy:** 3B models may select irrelevant tools
2. **Preview Quality:** Must explain WHY these tools were selected
3. **Step Ordering:** LLM must understand dependencies (e.g., read log before deactivating plugin)
4. **Confirmation UX:** Show clear preview of what will happen

### Testing

- Test with 20+ "open-ended" queries
- Verify tool selection is relevant (target: 80%+)
- Verify user confirmation shows clear preview
- Test with 1.5B (may not work), 3B (should work), 7B+ (should work well)

### Success Criteria

- ✅ Template workflows registered and functional
- ✅ LLM composes relevant tool sequences
- ✅ Preview shown before execution
- ✅ Works reliably with 3B+ models

---

## Version 1.4: Larger Model Support (7B+) 🚀

**Focus:** Enhanced capabilities when users have hardware for larger models

**Priority:** LOW
**Timeline:** 6-8 weeks

### Target Models

- **Llama 3.2 7B** - Meta's latest, excellent reasoning
- **Qwen 2.5 7B** - Strong JSON output, multilingual
- **Phi-4 7B** (when available) - Microsoft's compact model

### Enhanced Features with Larger Models

#### 1. Multi-Step Reasoning
- More complex tool chains (5-10 steps instead of 2-3)
- Better error recovery (retry with different approach)
- Context awareness across longer conversations

#### 2. Natural Language Summaries
- Richer, more detailed explanations
- Better markdown formatting
- Include actionable recommendations

#### 3. LLM-Based includeIf Conditions
- More reliable than 3B models
- Can handle complex conditional logic
- Semantic understanding of previous results

#### 4. Template Workflow Composition
- More accurate tool selection
- Better step ordering
- Smarter dependency resolution

#### 5. Conversational Context
- Remember previous queries in session
- Reference past tool results: "Check that again" → knows what "that" refers to
- Follow-up questions: "What about plugins?" after site health check

### Implementation

**Model Loader Changes:**
```javascript
// Auto-detect model capabilities
if (modelId.includes('7B') || modelId.includes('8B')) {
    capabilities.complexReasoning = true;
    capabilities.multiStepChains = true;
    capabilities.reliableLLMConditions = true;
    maxIterations = 20; // Allow longer chains
}
```

**ReAct Agent Changes:**
- Increase max iterations for larger models
- Enable more sophisticated system prompts
- Use conversation history more effectively

**Workflow Orchestrator:**
- Prioritize LLM-based includeIf over function-based (if 7B+)
- Enable template workflows by default (if 7B+)

### UI Enhancements

- Show model capabilities in status area
- Badge: "Enhanced Mode (7B)" when larger model loaded
- Explain what enhanced features are available

### Success Criteria

- ✅ Detect model size and enable appropriate features
- ✅ Complex tool chains execute reliably
- ✅ LLM-based includeIf conditions work well
- ✅ Template workflows compose accurate plans

---

## Version 2.0: Multi-Site Management 🌐

**Focus:** Manage multiple WordPress sites from a single interface

**Priority:** LOW
**Timeline:** 8-12 weeks

### Concept

**Current:** Single-site management
**Future:** Manage fleet of WordPress sites

### Features

#### 1. Site Registry
- Register multiple WordPress sites
- Store credentials securely (encrypted in browser storage)
- Connect via WordPress REST API (remote)

#### 2. Cross-Site Operations
- "Check health of all sites"
- "Update plugins across all sites"
- "Find sites with security issues"

#### 3. Site Comparison
- Compare plugin versions across sites
- Find configuration drift
- Identify sites running outdated WordPress

#### 4. Bulk Operations
- Deploy plugin to multiple sites
- Update theme across sites
- Run workflow on selected sites

### Implementation Challenges

- **Authentication:** Secure storage of credentials for multiple sites
- **API Rate Limits:** Throttle bulk operations
- **Error Handling:** Some sites may be offline or restricted
- **UI Complexity:** Showing results from multiple sites

### Success Criteria

- ✅ Register and manage 10+ sites
- ✅ Cross-site queries work reliably
- ✅ Bulk operations execute safely
- ✅ Credentials stored securely (encrypted)

---

## Version 2.1: Scheduled Tasks & Automation ⏰

**Focus:** Proactive maintenance with scheduled workflows

**Priority:** LOW
**Timeline:** 6-8 weeks

### Features

#### 1. Scheduled Workflows
- Run workflows on a schedule (daily, weekly, monthly)
- "Database Maintenance" every Sunday at 2am
- "Security Audit" every Monday morning

#### 2. Alerting
- Email or browser notification on critical issues
- "Error log has 50+ new errors"
- "WordPress update available"

#### 3. Smart Recommendations
- Proactive suggestions based on site health
- "Your database hasn't been optimized in 30 days"
- "3 plugins have updates available"

### Implementation

**Backend (WordPress):**
- Use WP-Cron for scheduling
- Register cron jobs for each scheduled workflow
- Store results in database for review

**Frontend:**
- Settings page for schedule configuration
- Dashboard widget showing last run results
- Notification center for alerts

### Success Criteria

- ✅ Workflows run on schedule reliably
- ✅ Email/browser notifications work
- ✅ Dashboard shows scheduled task history

---

## Ongoing: Model & WebLLM Updates 🔄

**Focus:** Keep up with latest WebLLM and model releases

**Priority:** ONGOING

### Activities

1. **Test New Models**
   - Qwen 2.5 Coder series
   - Llama 3.3/3.4 when released
   - Gemma updates
   - Phi-4 when available for WebGPU

2. **WebLLM Updates**
   - Track WebLLM releases
   - Adopt new features (streaming improvements, caching)
   - Optimize for performance

3. **Browser WebGPU Support**
   - Monitor Safari WebGPU progress
   - Test on Firefox when stable
   - Optimize for different GPU vendors (Apple, NVIDIA, AMD, Intel)

4. **Model Quantization**
   - Test different quantization levels (4-bit, 6-bit, 8-bit)
   - Balance quality vs memory usage
   - Provide model selection guide in docs

---

## Community & Ecosystem 🤝

**Focus:** Foster third-party extensions and community contributions

**Priority:** ONGOING

### Activities

1. **Developer Resources**
   - Video tutorials on creating abilities
   - Example plugins demonstrating patterns
   - Showcase third-party abilities on website

2. **Ability Marketplace** (Future)
   - Directory of community abilities
   - One-click install for ability packs
   - Rating and review system

3. **Hosting Provider Integration**
   - Partner with hosting companies (Cloudways, Kinsta, WP Engine)
   - Pre-install on managed WordPress hosting
   - Custom ability packs for hosting-specific features

4. **WordPress Plugin Directory**
   - Submit to official WordPress plugin directory
   - Build reputation and user base
   - Gather feedback from wider community

---

## Research & Experimentation 🔬

**Focus:** Explore emerging AI techniques and technologies

**Priority:** EXPLORATORY

### Areas to Explore

#### 1. Fine-Tuning Small Models
- Fine-tune Qwen/Phi on WordPress-specific tasks
- Train on WordPress documentation corpus
- Create "WordPress Expert" specialized models

#### 2. Retrieval-Augmented Generation (RAG)
- Embed WordPress documentation in vector DB
- RAG for answering technical questions
- "How do I configure WP-Cron?" → retrieve from docs + LLM summarizes

#### 3. Multi-Modal Capabilities
- Screenshot analysis: "What's wrong with my site?"
- Visual diff detection for theme changes
- Chart generation for site metrics

#### 4. Code Generation
- Generate custom functions: "Create a shortcode that shows latest posts"
- Write plugin boilerplate
- Fix PHP errors with suggested code

#### 5. Natural Language to SQL
- "Show me posts from last week with more than 10 comments"
- LLM generates safe SQL query
- Execute with proper escaping/sanitization

---

## Notes on Prioritization

**HIGH Priority:** Critical for 1.5B-3B model reliability and user experience.

**MEDIUM Priority:** Valuable features that expand capabilities without compromising stability.

**LOW Priority:** Advanced features that require larger models or are more experimental.

**ONGOING:** Maintenance and ecosystem work that continues indefinitely.

---

## Version Numbering Philosophy

- **1.x:** Incremental improvements to ReAct loop foundation
- **2.x:** Major new capabilities (multi-site, scheduling, automation)
- **3.x:** Advanced AI features (fine-tuning, RAG, multi-modal)

Each minor version (1.1, 1.2, etc.) should be shippable and stable. Major versions (2.0, 3.0) represent architectural changes or significant new capabilities.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on proposing features, reporting bugs, and submitting pull requests.

Feature requests should reference this roadmap and explain:
1. **What problem does it solve?**
2. **Which version should it target?**
3. **What's the implementation complexity?**
4. **Does it work with 1.5B-3B models, or require 7B+?**

---

## Feedback

This roadmap is a living document. We welcome feedback and suggestions:

- **GitHub Discussions:** Share ideas and vote on priorities
- **GitHub Issues:** Report bugs or request specific features
- **CloudFest Hackathon:** Join us to work on experimental features

The goal is to make WP-Agentic-Admin the most reliable, privacy-first AI site reliability assistant for WordPress.
