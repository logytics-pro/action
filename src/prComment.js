const github = require("@actions/github");
const core = require("@actions/core");

const COMMENT_MARKER = "<!-- sensethelog-analysis -->";

function formatPRComment(result, failedSteps, context) {
  const { rootCause, suggestedFix, isRecurring, occurrences, signature } = result;

  let body = `${COMMENT_MARKER}
## 🔍 CI Failure Analysis

**SenseTheLog** analyzed this failure and found the following:

`;

  // Failed steps
  if (failedSteps && failedSteps.length > 0) {
    body += `### ❌ Failed Steps\n\n`;
    failedSteps.forEach((step) => {
      body += `- **${step.jobName}** → \`${step.stepName}\`\n`;
    });
    body += `\n`;
  }

  // Root cause
  if (rootCause) {
    body += `### 🎯 Root Cause\n\n${rootCause}\n\n`;
  }

  // Suggested fix
  if (suggestedFix) {
    body += `### 💡 Suggested Fix\n\n${suggestedFix}\n\n`;
  }

  // Recurring warning
  if (isRecurring && occurrences > 1) {
    body += `### ⚠️ Recurring Issue\n\n`;
    body += `This error has occurred **${occurrences} times** before. Consider prioritizing a permanent fix.\n\n`;
  }

  // Error signature
  if (signature) {
    body += `<details>\n<summary>Error Signature</summary>\n\n\`\`\`\n${signature}\n\`\`\`\n</details>\n\n`;
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
