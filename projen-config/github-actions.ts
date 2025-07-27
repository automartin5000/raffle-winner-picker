import { awscdk } from "projen";
import { BuildWorkflow } from "projen/lib/build";
import { GitHub, GithubWorkflow } from "projen/lib/github";
import { JobPermission, JobStepOutput } from "projen/lib/github/workflows-model";

const RUNNER_TYPE = ["ubuntu-latest"];

export const generateGitHubActions = (project: awscdk.AwsCdkTypeScriptApp) => {
  const github = project.github!;
  updateBuildWorkflow(project.buildWorkflow!);
  addDeployPrEnvironmentWorkflow(github);
  addProductionDeployWorkflow(github);
  addCleanupPrEnvironmentWorkflow(github);
  addSecurityScanningJob(github);
};

const updateBuildWorkflow = (workflow: BuildWorkflow) => {
  workflow?.addPostBuildSteps(
    // Upload cdk.out directory as an artifact
    {
      name: "Upload CDK artifacts",
      uses: "actions/upload-artifact@v4",
      with: {
        name: "cdk-out-${{ github.sha }}",
        path: "cdk.out/",
        "retention-days": "30",
      },
    },
  );
};
const addSecurityScanningJob = (github: GitHub) => {
  const workflow = new GithubWorkflow(github, "security-scanning");
  workflow.on({
    push: {
      branches: ["**"],
    },
  });
  workflow.addJobs({
    security: {
      name: "Security Scanning",
      runsOn: RUNNER_TYPE,
      permissions: {
        contents: JobPermission.READ,
        securityEvents: JobPermission.WRITE,
      },
      steps: [
        { name: "Checkout", uses: "actions/checkout@v4" },
        { name: "Setup Bun", uses: "oven-sh/setup-bun@v2" },
        { name: "Install dependencies", run: "bun install --frozen-lockfile" },
        {
          name: "Initialize CodeQL",
          uses: "github/codeql-action/init@v3",
          with: { languages: "javascript,typescript" },
        },
        { name: "Perform CodeQL Analysis", uses: "github/codeql-action/analyze@v3" },
      ],
    },
  });
};
const addDeployPrEnvironmentWorkflow = (github: GitHub) => {
  const workflow = new GithubWorkflow(github, "deploy-pr-environment", {
    env: {
      AWS_CDK_ENV_NAME: "pr${{ github.event.number }}",
      NONPROD_AWS_ACCOUNT_ID: '${{ secrets.NONPROD_AWS_ACCOUNT_ID }}',
      PROD_AWS_ACCOUNT_ID: '${{ secrets.PROD_AWS_ACCOUNT_ID }}',
      NONPROD_HOSTED_ZONE: '${{ secrets.NONPROD_HOSTED_ZONE }}',
      PROD_HOSTED_ZONE: '${{ secrets.PROD_HOSTED_ZONE }}',
    }
  });

  workflow.on({
    pullRequest: {
      types: ["opened", "synchronize", "reopened"],
    },
  });


  workflow.addJobs({
    deploy_pr: {
      name: "Deploy PR Environment",
      runsOn: RUNNER_TYPE,
      outputs: {
        "CDK_DIFF": { stepId: "cdk-diff", outputName: "CDK_DIFF" } as JobStepOutput
      },
      // environment: "development",
      permissions: {
        contents: JobPermission.READ,
        idToken: JobPermission.WRITE,
        actions: JobPermission.READ,  // Needed to download artifacts
      },
      steps: [
        { name: "Checkout", uses: "actions/checkout@v4" },
        {
          id: "build",
          uses: ".github/actions/build/action.yml",
          with: {
            uploadArtifacts: true,
          },
        },
        {
          name: "Generate CDK Diff",
          id: "cdk-diff",
          run: [
            "cdk diff --app cdk.out > cdk-diff.txt 2>&1 || true",
            'echo "CDK_DIFF<<EOF" >> $GITHUB_OUTPUT',
            "cat cdk-diff.txt >> $GITHUB_OUTPUT",
            'echo "EOF" >> $GITHUB_OUTPUT',
          ].join("\n"),
        },
        {
          name: "Deploy ephemeral environment",
          run: "bunx projen deploy \"$AWS_CDK_ENV_NAME/*\" --require-approval never",
        },
        {
          name: "Get CloudFront URL",
          id: "get-url",
          run: [
            'URL=$(cdk --app cdk.out --context envName=pr${{ github.event.number }} --outputs-file outputs.json deploy --require-approval never 2>/dev/null && cat outputs.json | jq -r \'.[] | select(.CloudFrontUrl) | .CloudFrontUrl\' || echo "Not available yet")',
            'echo "CLOUDFRONT_URL=$URL" >> $GITHUB_OUTPUT',
          ].join("\n"),
        },
      ],
    },
    comment: {
      name: "Comment PR Environment Status and diff",
      runsOn: RUNNER_TYPE,
      needs: ["deploy_pr"],
      permissions: {
        contents: JobPermission.READ,
        pullRequests: JobPermission.WRITE,
      },
      steps: [
        {
          name: "Find existing comment",
          uses: "peter-evans/find-comment@v3",
          id: "find-comment",
          with: {
            "issue-number": "${{ github.event.pull_request.number }}",
            "comment-author": "github-actions[bot]",
            "body-includes": "## 🚀 PR Environment Status",
          },
        },
        {
          name: "Create or update comment",
          uses: "peter-evans/create-or-update-comment@v4",
          with: {
            "comment-id": "${{ steps.find-comment.outputs.comment-id }}",
            "issue-number": "${{ github.event.pull_request.number }}",
            "edit-mode": "replace",
            body: [
              "## 🚀 PR Environment Status",
              "",
              "**Environment:** `pr${{ github.event.number }}`",
              "**Status:** ${{ needs.deploy_ephemeral.result == 'success' && '✅ Deployed' || '❌ Failed' }}",
              "**Preview URL:** Deployment in progress...",
              "",
              "### 📋 CDK Diff",
              "<details>",
              "<summary>Click to view infrastructure changes</summary>",
              "",
              "```diff",
              "${{ needs.deploy_pr.outputs.CDK_DIFF }}",
              "```",
              "</details>",
              "",
              "### 🔒 Security Scan",
              "**Status:** ${{ needs.security.result == 'success' && '✅ Passed' || '❌ Failed' }}",
              "",
              "---",
              "*Last updated: ${{ github.event.head_commit.timestamp }}*",
              "*Commit: ${{ github.event.head_commit.id }}*",
            ].join("\n"),
          },
        },
      ],
    },
  });
};

const addProductionDeployWorkflow = (github: GitHub) => {
  const workflow = new GithubWorkflow(github, "prod-deploy");

  workflow.on({
    push: { branches: ["main"] },
    workflowDispatch: {},
  });

  workflow.addJobs({
    find_artifact: {
      name: "Find Build Artifact",
      runsOn: RUNNER_TYPE,
      permissions: {
        contents: JobPermission.READ,
        actions: JobPermission.READ,
      },
      steps: [
        {
          name: "Find build artifact",
          uses: "actions/github-script@v7",
          id: "find-artifact",
          with: {
            script: `
              // First, find the build workflow
              const workflows = await github.rest.actions.listRepoWorkflows({
                owner: context.repo.owner,
                repo: context.repo.repo,
              });
              
              const buildWorkflow = workflows.data.workflows.find(w => w.name === 'build');
              if (!buildWorkflow) {
                throw new Error('Could not find build workflow');
              }

              // Get workflow runs for the current commit
              const runs = await github.rest.actions.listWorkflowRuns({
                owner: context.repo.owner,
                repo: context.repo.repo,
                workflow_id: buildWorkflow.id,
                commit_sha: context.sha,
              });

              if (runs.data.workflow_runs.length === 0) {
                throw new Error('No build workflow run found for commit ' + context.sha);
              }

              // Find the successful run
              const successRun = runs.data.workflow_runs.find(r => r.status === 'completed' && r.conclusion === 'success');
              if (!successRun) {
                throw new Error('No successful build found for commit ' + context.sha);
              }

              // List artifacts for the successful run
              const artifacts = await github.rest.actions.listWorkflowRunArtifacts({
                owner: context.repo.owner,
                repo: context.repo.repo,
                run_id: successRun.id,
              });

              const cdkArtifact = artifacts.data.artifacts.find(a => a.name === \`cdk-out-\${context.sha}\`);
              if (!cdkArtifact) {
                throw new Error('No CDK artifact found for commit ' + context.sha);
              }

              console.log('Found CDK artifact:', cdkArtifact.name);
              return cdkArtifact.name;
            `
          }
        },
        {
          name: "Set artifact name",
          run: 'echo "artifact-name=${{ steps.find-artifact.outputs.result }}" >> $GITHUB_OUTPUT',
        }
      ],
    },
    deploy_production: {
      name: "Deploy to Production",
      runsOn: RUNNER_TYPE,
      needs: ["find_artifact"],
      environment: "production",
      permissions: {
        contents: JobPermission.READ,
        idToken: JobPermission.WRITE,
      },
      steps: [
        { name: "Checkout", uses: "actions/checkout@v4" },
        {
          name: "Configure AWS credentials",
          uses: "aws-actions/configure-aws-credentials@v4",
          with: {
            "aws-region": "us-east-1",
            audience: "sts.amazonaws.com",
            "role-to-assume": "arn:aws:iam::${{ secrets.PROD_AWS_ACCOUNT_ID }}:role/github-actions-deployer",
          },
        },
        {
          name: "Download CDK artifacts",
          uses: "actions/download-artifact@v4",
          with: {
            name: "${{ needs.find_artifact.outputs.artifact-name }}",
            path: "cdk.out/",
            "github-token": "${{ secrets.GITHUB_TOKEN }}",
            "run-id": "${{ needs.find_artifact.outputs.run-id }}",
          },
        },
        { name: "Setup Bun", uses: "oven-sh/setup-bun@v2" },
        { name: "Install dependencies", run: "bun install --frozen-lockfile" },
        {
          name: "Deploy to Production",
          run: "bunx cdk deploy 'prod/*' --app cdk.out --require-approval never",
        },
        {
          name: "Get Production URL",
          id: "get-prod-url",
          run: [
            'URL=$(bunx cdk --app cdk.out --outputs-file prod-outputs.json deploy --require-approval never 2>/dev/null && cat prod-outputs.json | jq -r \'.[] | select(.CloudFrontUrl) | .CloudFrontUrl\' || echo "Deployment completed")',
            'echo "PROD_URL=$URL" >> $GITHUB_OUTPUT',
          ].join("\n"),
        },
        {
          name: "Notify deployment success",
          run: [
            'echo "🎉 Production deployment successful!"',
            'echo "URL: ${{ steps.get-prod-url.outputs.PROD_URL }}"',
          ].join("\n"),
        },
      ],
    },
  });
};

const addCleanupPrEnvironmentWorkflow = (github: GitHub) => {
  const workflow = new GithubWorkflow(github, "cleanup-pr-environment");

  workflow.on({
    pullRequest: { types: ["closed"] },
  });

  workflow.addJobs({
    cleanup: {
      name: "Cleanup PR Environment",
      runsOn: RUNNER_TYPE,
      permissions: {
        contents: JobPermission.READ,
        idToken: JobPermission.WRITE,
      },
      steps: [
        { name: "Checkout", uses: "actions/checkout@v4" },
        {
          name: "Configure AWS credentials",
          uses: "aws-actions/configure-aws-credentials@v4",
          with: {
            "aws-region": "us-east-1",
            audience: "sts.amazonaws.com",
            "role-to-assume": "arn:aws:iam::${{ secrets.NONPROD_AWS_ACCOUNT_ID }}:role/github-actions-deployer",
          },
        },
        {
          name: "Install Bun",
          uses: "oven-sh/setup-bun@v2",
        },
        {
          name: "Install dependencies",
          run: "bun install --frozen-lockfile",
        },
        {
          name: "Destroy PR environment",
          run: "bunx projen destroy --force --context envName=pr${{ github.event.number }}",
        },
      ],
    },
  });
};