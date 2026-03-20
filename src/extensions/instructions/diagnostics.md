---
id: diagnostics
label: Site Diagnostics
description: Site health, error logs, and environment info
keywords:
  - health
  - error
  - errors
  - log
  - logs
  - debug
  - environment
  - diagnostics
  - broken
  - white screen
  - crash
  - not working
  - slow
  - performance
  - speed
abilities:
  - wp-agentic-admin/site-health
  - wp-agentic-admin/error-log-read
  - core/get-site-info
  - core/get-environment-info
---

Start with error-log-read when the user reports something broken — the error log is the fastest way to find the cause. Use site-health when the user asks about versions, memory, or general status. If the error log mentions a plugin file path, suggest loading the plugins instruction to investigate further.
