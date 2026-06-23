# SenseTheLog GitHub Action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-SenseTheLog-blue?logo=github)](https://github.com/marketplace/actions/sensethelog)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Stop wasting time debugging CI failures.** Get AI-powered root cause analysis in seconds.

```yaml
- uses: sensethelog/action@v1
  if: failure()
  with:
    sensethelog-api-key: ${{ secrets.SENSETHELOG_API_KEY }}
```

## Why SenseTheLog?

| Before | After |
|--------|-------|
| Scroll through 1000s of log lines | Instant root cause identification |
| Google the error message | AI-suggested fix with code example |
| Same error keeps happening | Pattern detection alerts you |
| 30+ minutes debugging | Under 30 seconds |

**Free tier: 100 analyses/month. No credit card required.**

---

## Quick Start (2 minutes)

### 1. Get your API key

Sign up at [sensethelog.com](https://sensethelog.com) and create an API key in Settings.

### 2. Add the secret to your repository

Go to your GitHub repository:

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

- **Name:** `SENSETHELOG_API_KEY`
- **Value:** Your API key from SenseTheLog

### 3. Add to your workflow

```yaml
name: CI Pipeline

on: [push, pull_request]

permissions:
  actions: read
  contents: read
  pull-requests: write  # Required for PR comments

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npm test

  # Add this job - runs only when build fails
  analyze:
    runs-on: ubuntu-latest
    needs: [build]
    if: failure()
    steps:
      - name: Analyze with SenseTheLog
        uses: sensethelog/action@v1
        with:
          sensethelog-api-key: ${{ secrets.SENSETHELOG_API_KEY }}
```

**That's it!** When your CI fails, you'll see:
- Root cause analysis in the GitHub Actions summary
- Suggested fix with code examples
- **Automatic PR comment** with the analysis
- Link to view history and patterns in your dashboard

---

## Features

| Feature | Description |
|---------|-------------|
| **AI Root Cause Analysis** | Instantly understand why your CI failed |
| **Suggested Fixes** | Get working code examples to fix the issue |
| **PR Comments** | Auto-post analysis as PR comment |
| **Pattern Detection** | Know when the same error keeps happening |
| **Multi-Job Support** | Analyzes all failed jobs in one run |
| **GitHub Summary** | See results directly in Actions tab |
| **Dashboard** | Track trends and insights across all repos |

---

## Supported Error Types

Works with any CI failure, including:

- **JavaScript/Node.js** - TypeError, Module not found, npm/yarn errors
- **Python** - ImportError, SyntaxError, pip errors
- **Build Tools** - Webpack, TypeScript, ESBuild, Vite
- **Test Frameworks** - Jest, pytest, Mocha, Cypress
- **Linters** - ESLint, Prettier, Pylint
- **Infrastructure** - Terraform, CloudFormation, Docker, Kubernetes
- **Databases** - Connection errors, migration failures

---

## Configuration

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `sensethelog-api-key` | Your SenseTheLog API key | Yes | - |
| `comment-on-pr` | Post analysis as PR comment | No | `true` |
| `workflow-run-id` | Workflow run ID to analyze | No | Current run |
| `github-token` | Token for fetching logs | No | `github.token` |

### Outputs

| Output | Description |
|--------|-------------|
| `failure-id` | Unique ID of the recorded failure |
| `signature` | Error signature for pattern matching |
| `is-recurring` | `true` if this error has occurred before |
| `root-cause` | AI-generated root cause analysis |
| `suggested-fix` | AI-suggested fix with code example |
| `comment-url` | URL of the PR comment |

---

## Examples

### Multiple Jobs (Recommended)

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run build

  deploy:
    runs-on: ubuntu-latest
    needs: [test, build]
    steps:
      - run: ./deploy.sh

  # Analyze ALL failures in one place
  analyze:
    runs-on: ubuntu-latest
    needs: [test, build, deploy]
    if: failure()
    steps:
      - uses: sensethelog/action@v1
        with:
          sensethelog-api-key: ${{ secrets.SENSETHELOG_API_KEY }}
```

### PR Comments (Automatic)

PR comments are **enabled by default**. When CI fails on a PR, SenseTheLog automatically posts an analysis comment:

```yaml
- uses: sensethelog/action@v1
  if: failure()
  with:
    sensethelog-api-key: ${{ secrets.SENSETHELOG_API_KEY }}
    # comment-on-pr: true  (default)
```

**Example PR Comment:**

> ## 🔍 CI Failure Analysis
>
> ### ❌ Failed Steps
> - **build** → `npm test`
>
> ### 🎯 Root Cause
> The test is trying to access `data.email` but `data` is undefined. The `validateInput` function doesn't handle null/undefined input.
>
> ### 💡 Suggested Fix
> ```javascript
> const validateInput = (data) => {
>   if (!data?.email) return false;
>   return data.email.includes('@');
> };
> ```
>
> ### ⚠️ Recurring Issue
> This error has occurred **3 times** before. Consider prioritizing a permanent fix.

**Features:**
- Updates existing comment (no spam)
- Works with `pull_request` and `workflow_run` events
- Detects PR from commit SHA automatically

To disable PR comments:

```yaml
- uses: sensethelog/action@v1
  if: failure()
  with:
    sensethelog-api-key: ${{ secrets.SENSETHELOG_API_KEY }}
    comment-on-pr: false
```

---

## Permissions

Add these permissions to your workflow:

```yaml
permissions:
  actions: read        # Required to fetch workflow logs
  contents: read       # Required to access repository
  pull-requests: write # Required for PR comments
```

---

## Pricing

| Plan | Analyses/Month | Price |
|------|---------------|-------|
| **Free** | 100 | $0 |
| **Pro** | 10,000 | $10/mo |
| **Team** | 100,000 | $29/mo |

[Start Free →](https://sensethelog.com)

---

## Links

- **Website:** [sensethelog.com](https://sensethelog.com)
- **Documentation:** [sensethelog.com/#docs](https://sensethelog.com/#docs)
- **Issues:** [GitHub Issues](https://github.com/sensethelog/action/issues)
- **Email:** support@sensethelog.com

---

## License

MIT
