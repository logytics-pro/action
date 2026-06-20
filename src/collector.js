const fs = require("fs");
const path = require("path");
const github = require("@actions/github");
const core = require("@actions/core");

async function getFailedSteps(token) {
  const failedSteps = [];

  try {
    const octokit = github.getOctokit(token);
    const { context } = github;

    const { data: jobs } = await octokit.rest.actions.listJobsForWorkflowRun({
      owner: context.repo.owner,
      repo: context.repo.repo,
      run_id: context.runId,
    });

    core.info(`Found ${jobs.jobs.length} job(s) in workflow run`);

    for (const job of jobs.jobs) {
      core.info(`Job: ${job.name} (status: ${job.status}, steps: ${job.steps?.length || 0})`);

      if (job.status === "completed" || job.status === "in_progress") {
        for (const step of job.steps || []) {
          core.info(`  Step: ${step.name} (status: ${step.status}, conclusion: ${step.conclusion})`);
          if (step.conclusion === "failure") {
            failedSteps.push({
              jobId: job.id,
              jobName: job.name,
              stepName: step.name,
              stepNumber: step.number,
              startedAt: step.started_at,
              completedAt: step.completed_at,
            });
          }
        }
      }
    }

    core.info(`Found ${failedSteps.length} failed step(s)`);
  } catch (e) {
    core.warning(`Could not fetch failed steps: ${e.message}`);
  }

  return failedSteps;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJobLogs(token, jobId) {
  try {
    const octokit = github.getOctokit(token);
    const { context } = github;

    // Wait briefly for GitHub to finalize logs
    core.info(`Waiting 2s for GitHub to finalize logs...`);
    await sleep(2000);

    core.info(`Calling downloadJobLogsForWorkflowRun...`);
    const response = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
      owner: context.repo.owner,
      repo: context.repo.repo,
      job_id: jobId,
    });

    core.info(`API response status: ${response.status}, data length: ${response.data?.length || 0}`);
    return response.data;
  } catch (e) {
    core.warning(`Could not fetch job logs: ${e.message} (${e.status || 'no status'})`);

    // Try workflow run logs as fallback
    try {
      const { context } = github;
      const octokit = github.getOctokit(token);

      const { data } = await octokit.rest.actions.downloadWorkflowRunLogs({
        owner: context.repo.owner,
        repo: context.repo.repo,
        run_id: context.runId,
      });

      core.info("Got workflow run logs as fallback");
      return data;
    } catch (e2) {
      core.warning(`Could not fetch workflow logs either: ${e2.message}`);
      return null;
    }
  }
}

async function getAnnotations(token) {
  try {
    const octokit = github.getOctokit(token);
    const { context } = github;

    // Get check runs for this commit
    const { data: checkRuns } = await octokit.rest.checks.listForRef({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: context.sha,
    });

    const annotations = [];
    for (const check of checkRuns.check_runs) {
      if (check.output && check.output.annotations_count > 0) {
        const { data: annotationData } = await octokit.rest.checks.listAnnotations({
          owner: context.repo.owner,
          repo: context.repo.repo,
          check_run_id: check.id,
        });
        annotations.push(...annotationData);
      }
    }

    core.info(`Found ${annotations.length} annotations`);
    return annotations;
  } catch (e) {
    core.warning(`Could not fetch annotations: ${e.message}`);
    return [];
  }
}

async function collectLogs(token) {
  const logs = [];
  const failedSteps = await getFailedSteps(token);

  // Try to get annotations (error messages from checks)
  const annotations = await getAnnotations(token);
  if (annotations.length > 0) {
    const annotationText = annotations.map(a =>
      `${a.path || ''}:${a.start_line || ''} ${a.annotation_level}: ${a.message}`
    ).join('\n');
    logs.push(`=== Annotations ===\n${annotationText}`);
    core.info(`Annotation preview: ${annotationText.substring(0, 300)}`);
  }

  // Try to fetch job logs (may fail for in-progress jobs)
  try {
    const octokit = github.getOctokit(token);
    const { context } = github;

    const { data: jobs } = await octokit.rest.actions.listJobsForWorkflowRun({
      owner: context.repo.owner,
      repo: context.repo.repo,
      run_id: context.runId,
    });

    for (const job of jobs.jobs) {
      if (job.status === "in_progress" || job.status === "completed") {
        core.info(`Fetching logs for job: ${job.name} (${job.id})...`);
        try {
          const jobLogs = await fetchJobLogs(token, job.id);
          if (jobLogs) {
            const logStr = typeof jobLogs === 'string' ? jobLogs : JSON.stringify(jobLogs);
            logs.push(logStr);
            core.info(`Got ${logStr.length} bytes of logs`);
            core.info(`Log preview: ${logStr.substring(0, 500)}`);
          }
        } catch (fetchErr) {
          core.info(`Job logs not available (expected for in-progress jobs)`);
        }
      }
    }
  } catch (e) {
    core.warning(`Could not list jobs: ${e.message}`);
  }

  // Also check GITHUB_STEP_SUMMARY
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      const summaryPath = process.env.GITHUB_STEP_SUMMARY;
      if (fs.existsSync(summaryPath)) {
        logs.push(fs.readFileSync(summaryPath, "utf8"));
      }
    } catch (e) {
      // ignore
    }
  }

  // Check for common log files
  const workspace = process.env.GITHUB_WORKSPACE || ".";
  core.info(`Workspace: ${workspace}`);

  const logPatterns = [
    "test-output.log",
    "npm-debug.log",
    "yarn-error.log",
    "pnpm-debug.log",
    "jest.log",
    "test-results.log",
    "build.log",
    "error.log",
  ];

  for (const pattern of logPatterns) {
    const fullPath = path.join(workspace, pattern);
    const exists = fs.existsSync(fullPath);
    core.info(`Checking ${fullPath}: ${exists ? 'EXISTS' : 'not found'}`);
    try {
      if (exists && fs.statSync(fullPath).isFile()) {
        const content = fs.readFileSync(fullPath, "utf8");
        core.info(`Read ${content.length} bytes from ${pattern}`);
        if (content.length < 100000) {
          logs.push(`=== ${pattern} ===\n${content}`);
        }
      }
    } catch (e) {
      core.warning(`Error reading ${pattern}: ${e.message}`);
    }
  }

  // Check env vars
  if (process.env.BUILD_LOG) {
    logs.push(process.env.BUILD_LOG);
  }
  if (process.env.TEST_OUTPUT) {
    logs.push(process.env.TEST_OUTPUT);
  }

  if (logs.length === 0) {
    return {
      logs: "No logs collected. The action runs after the failed step completes.",
      failedSteps
    };
  }

  // Combine and limit size
  let combined = logs.join("\n\n");
  if (combined.length > 50000) {
    combined = combined.substring(combined.length - 50000);
  }

  return { logs: combined, failedSteps };
}

module.exports = { collectLogs, getFailedSteps };
