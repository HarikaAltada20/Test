# AI Pull Request Review Workflow

## Purpose

Large pull requests often contain hundreds or thousands of changed lines.
Manual review alone can be slow and developers may accidentally miss bugs.

To improve reliability, we use **AI-assisted code review** using Cursor.
This allows us to quickly analyze PR changes and identify potential issues.

AI review **assists** developers but does **not replace manual review**.

---

# Overview

```text
Developer creates feature branch
        ↓
Generate diff between main and branch
        ↓
Open diff in Cursor
        ↓
AI analyzes the changes
        ↓
Developer manually verifies
        ↓
Merge PR
```

---

# Step 1 — Fetch Latest Code

Always ensure your local repository is up to date.

```bash
git fetch --all
```

---

# Step 2 — Checkout the Branch

Example:

```bash
git checkout instagram-insights
```

Replace with the branch you want to review.

---

# Step 3 — Generate the PR Diff

Generate a diff between `main` and the current branch.

```bash
git diff main...your-branch > reviews/pr-your-branch.diff
```

Example:

```bash
git diff main...instagram-insights > reviews/pr-instagram-insights.diff
```

This file contains all changes introduced by the branch.

---

# Step 4 — Store Diff Files Locally

Diff files are stored inside the `reviews` folder.

Example:

```
reviews/
   pr-instagram-insights.diff
```

These files **must not be committed to the repository**.

Add the following to `.gitignore`:

```
reviews/
```

---

# Step 5 — Open the Diff in Cursor

Open the generated diff file in Cursor.

Example:

```
reviews/pr-instagram-insights.diff
```

Select the entire file and ask Cursor to analyze it.

---

# Step 6 — Ask AI to Review

Example prompt:

```
You are a senior software engineer reviewing a pull request.

Analyze this diff and identify:
- logic errors
- security vulnerabilities
- missing error handling
- race conditions
- database query issues
- performance problems
- edge cases

Provide feedback in this format:
1. Critical issues
2. Potential bugs
3. Improvements
4. Code quality suggestions
```

---

# Best Practices

### Keep Pull Requests Small

Large PRs are difficult to review.

Recommended size:

```
500–800 lines per PR
```

---

### Focus on Logic First

Review critical areas first:

* Business logic correctness
* API validation
* Database queries
* Error handling
* Edge cases

---

### AI Assists — Developers Decide

AI helps detect issues quickly, but **developers must verify before merging**.

---

# Faster Workflow Using the AI Review Script

To simplify the process, the repository includes a script that automatically generates the PR diff.

Script location:

```
scripts/ai-review.ps1
```

This script:

1. Detects the current branch
2. Generates the diff with `main`
3. Saves it in the `reviews` folder
4. Opens the diff file automatically

Run the script with:

```bash
./scripts/ai-review.ps1
```

Example output:

```
Current branch: instagram-insights
Diff created at reviews/pr-instagram-insights.diff
```

The diff file will open automatically and can be reviewed using Cursor.

---

# Repository Structure

Example structure:

```
go-viral
│
├ app
├ docs
│   └ ai-pr-review-workflow.md
│
├ scripts
│   └ ai-review.ps1
│
├ reviews     (gitignored)
│
└ .gitignore
```

---

# Summary

This workflow improves PR quality by combining:

* Git diff
* AI analysis using Cursor
* Manual developer verification

The goal is to **catch issues early and reduce production bugs**.
