const github = require("@actions/github");
const core = require("@actions/core");

const COMMENT_MARKER = "<!-- sensethelog-analysis -->";

function formatFix(fix) {
  if (!fix) return "";
  fix = fix.replace(/(\d+)\.\s+/g, '\n$1. ');
  fix = fix.replace(/\s+-\s+/g, '\n- ');
  fix = fix.replace(/\n\n+/g, '\n\n');
  return fix.trim();
}

function formatSingleError(error, index) {
  let content = "";
  const num = index + 1;

  content += `### ${num}. ${error.jobName || 'Error'}\n\n`;

  if (error.keyError) {
    content += "**Error:**\n```\n" + error.keyError + "\n```\n\n";
  }

  if (error.rootCause) {
    content += `**🎯 Root Cause:** ${error.rootCause}\n\n`;
  }

  if (error.explanation) {
    content += `**Explanation:** ${error.explanation}\n\n`;
  }

  if (error.suggestedFix) {
    content += "**💡 Suggested Fix:**\n" + formatFix(error.suggestedFix) + "\n\n";
  }

  if (error.codeExample) {
    content += "**Example Fix:**\n```" + (error.codeLanguage || "") + "\n";
    content += error.codeExample + "\n```\n\n";
  }

  if (error.confidence) {
    const emoji = error.confidence >= 80 ? "🟢" : error.confidence >= 50 ? "🟡" : "🔴";
    content += `**Confidence:** ${emoji} ${error.confidence}%\n\n`;
  }

  return content;
}

function formatPRComment(result, failedSteps, context) {
  const { rootCause, suggestedFix, isRecurring, occurrences, signature, errors, summary } = result;

  let body = `${COMMENT_MARKER}
## 🔍 CI Failure Analysis

`;

  // Recurring warning at top
  if (isRecurring && occurrences > 1) {
    body += `> ⚠️ **Recurring Failure** - This issue has occurred **${occurrences} times** before\n\n`;
  }

  // Failed steps
  if (failedSteps && failedSteps.length > 0) {
    body += `### ❌ Failed Steps\n\n`;
    failedSteps.forEach((step) => {
      const continueTag = step.continueOnError ? " *(continue-on-error)*" : "";
      body += `- **${step.jobName}** → \`${step.stepName}\`${continueTag}\n`;
    });
    body += `\n`;
  }

  // Handle multiple errors
  if (errors && errors.length > 0) {
    body += `### 📋 Found ${errors.length} Error(s)\n\n`;

    if (summary) {
      body += `> ${summary}\n\n`;
    }

    errors.forEach((error, index) => {
      body += formatSingleError(error, index);
      if (index < errors.length - 1) {
        body += "---\n\n";
      }
    });
  } else {
    // Single error format (backward compatibility)
    if (rootCause) {
      body += `### 🎯 Root Cause\n\n${rootCause}\n\n`;
    }

    if (result.keyError) {
      body += "### Key Error\n\n```\n" + result.keyError + "\n```\n\n";
    }

    if (result.explanation) {
      body += `### Explanation\n\n${result.explanation}\n\n`;
    }

    if (suggestedFix) {
      body += `### 💡 Suggested Fix\n\n${formatFix(suggestedFix)}\n\n`;
    }

    if (result.codeExample) {
      body += "### Example Fix\n\n```" + (result.codeLanguage || "") + "\n";
      body += result.codeExample + "\n```\n\n";
    }

    if (result.confidence) {
      const emoji = result.confidence >= 80 ? "🟢" : result.confidence >= 50 ? "🟡" : "🔴";
      body += `### Confidence\n\n${emoji} **${result.confidence}%**\n\n`;
    }
  }

  // Fix PR link
  if (result.fixPrUrl) {
    body += `### 🔧 Auto-Fix PR\n\nA fix has been automatically generated: [View PR](${result.fixPrUrl})\n\n`;
  }

  // Error signature (collapsed)
  if (signature) {
    body += `<details>\n<summary>📝 Error Signature</summary>\n\n\`\`\`\n${signature}\n\`\`\`\n</details>\n\n`;
  }

  // Footer
  body += `---\n`;
  body += `*Analyzed by [SenseTheLog](https://sensethelog.com) • [View Dashboard](https://sensethelog.com/dashboard)*`;

  return body;
}

async function postPRComment(githubToken, result, failedSteps, context) {
  const octokit = github.getOctokit(githubToken);
  const { owner, repo } = context.repo;

  // Get PR number from context
  let prNumber = null;

  // Check if we're in a pull_request event
  if (context.payload.pull_request) {
    prNumber = context.payload.pull_request.number;
  }
  // Check if we're in a workflow_run event triggered by a PR
  else if (context.payload.workflow_run?.pull_requests?.length > 0) {
    prNumber = context.payload.workflow_run.pull_requests[0].number;
  }
  // Try to find PR by commit SHA
  else {
    const sha = context.payload.workflow_run?.head_sha || context.sha;
    try {
      const { data: prs } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: sha,
      });
      if (prs.length > 0) {
        prNumber = prs[0].number;
      }
    } catch (e) {
      core.debug(`Failed to find PR for commit ${sha}: ${e.message}`);
    }
  }

  if (!prNumber) {
    core.info("SenseTheLog: No PR found, skipping comment");
    return null;
  }

  core.info(`SenseTheLog: Posting comment to PR #${prNumber}`);

  const body = formatPRComment(result, failedSteps, context);

  // Check for existing comment to update
  try {
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
    });

    const existingComment = comments.find(
      (c) => c.body && c.body.includes(COMMENT_MARKER)
    );

    if (existingComment) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body,
      });
      core.info(`SenseTheLog: Updated existing comment #${existingComment.id}`);
      return existingComment.html_url;
    }
  } catch (e) {
    core.debug(`Failed to check existing comments: ${e.message}`);
  }

  // Create new comment
  const { data: comment } = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });

  core.info(`SenseTheLog: Created comment #${comment.id}`);
  return comment.html_url;
}

module.exports = { postPRComment, formatPRComment };
