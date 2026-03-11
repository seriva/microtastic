---
description: Verify changes with lint and tests before completing any task
---

# Verification Workflow

Run these two commands (in order) before considering **any** task complete.

1. Run the linter:
// turbo
```
npm run check
```
This must exit with no errors. Fix any reported issues before moving on.

2. Run the tests:
// turbo
```
npm test
```
This must complete successfully with all tests passing. If it fails, fix the issues and re-run both steps from the top.

Only after both commands exit cleanly is the task considered done.
