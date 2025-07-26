import { awscdk } from "projen";
import { BuildWorkflow } from "projen/lib/build";
import { GitHub, GithubWorkflow } from "projen/lib/github";
import { JobPermission } from "projen/lib/github/workflows-model";

export const generateGitHubActions = (project: awscdk.AwsCdkTypeScriptApp) => {
  const github = project.github!;
  updateBuildWorkflow(project.buildWorkflow!);
  addDeployPrEnvironmentWorkflow(github);
  addProductionDeployWorkflow(github);
  addCleanupPrEnvironmentWorkflow(github);
};
const updateBuildWorkflow = (workflow: BuildWorkflow) => {
  workflow?.addPostBuildSteps(
    // Upload cdk.out directory as an artifact
    {
      name: "Upload CDK artifacts",
      uses: "actions/upload-artifact@v4",
      with: {
        name: "cdk-out",
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
      runsOn: ["ubuntu-latest"],
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
      runsOn: ["ubuntu-latest"],
      // environment: "development",
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
          name: "Wait for build workflow to complete",
          uses: "lewagon/wait-on-check-action@v1.4.0",
          with: {
            "ref": "${{ github.ref }}",
            "check-name": "build",
            "repo-token": "${{ secrets.GITHUB_TOKEN }}",
            "wait-interval": "10",
          },
        },
        {
          name: "Download CDK artifacts",
          uses: "actions/download-artifact@v4",
          with: {
            name: "cdk-out-pr-${{ github.event.number }}",
            path: "cdk.out/",
          },
        },
        {
          name: "CDK Bootstrap (if needed)",
          run: "bunx projen cdk-bootstrap --trust-for-lookup ${{ secrets.PROD_AWS_ACCOUNT_ID }}",
        },
        {
          name: "Generate CDK Diff",
          id: "cdk-diff",
          run: [
            "cdk diff --app cdk.out --context envName=pr${{ github.event.number }} > cdk-diff.txt 2>&1 || true",
            'echo "CDK_DIFF<<EOF" >> $GITHUB_OUTPUT',
            "cat cdk-diff.txt >> $GITHUB_OUTPUT",
            'echo "EOF" >> $GITHUB_OUTPUT',
          ].join("\n"),
        },
        {
          name: "Deploy ephemeral environment",
          run: "bunx projen deploy --app cdk.out --require-approval never",
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
      runsOn: ["ubuntu-latest"],
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
              "CDK diff will be shown here",
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
      name: "Find PR Artifact",
      runsOn: ["ubuntu-latest"],
      permissions: {
        contents: JobPermission.READ,
      },
      steps: [
        {
          name: "Find merged PR",
          id: "find-pr",
          run: [
            'PR_NUMBER=$(gh pr list --state merged --limit 1 --json number,mergeCommit --jq \'.[] | select(.mergeCommit.oid == "${{ github.sha }}") | .number\')',
            'echo "pr-number=$PR_NUMBER" >> $GITHUB_OUTPUT',
            'echo "artifact-name=cdk-out-pr-$PR_NUMBER" >> $GITHUB_OUTPUT',
          ].join("\n"),
        },
      ],
    },
    deploy_production: {
      name: "Deploy to Production",
      runsOn: ["ubuntu-latest"],
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
          name: "Download PR CDK artifacts",
          uses: "actions/download-artifact@v4",
          with: {
            name: "cdk-out-pr-${{ needs.find_artifact.outputs.pr-number }}",
            path: "cdk.out/",
            "github-token": "${{ secrets.GITHUB_TOKEN }}",
          },
        },
        {
          name: "Setup Node.js",
          uses: "actions/setup-node@v4",
          with: { "node-version": "20" },
        },
        { name: "Install AWS CDK", run: "npm install -g aws-cdk@^2.1022.0" },
        { name: "CDK Bootstrap Production", run: "cdk bootstrap" },
        {
          name: "Deploy to Production",
          run: "cdk deploy --app cdk.out --require-approval never --context envName=prod",
        },
        {
          name: "Get Production URL",
          id: "get-prod-url",
          run: [
            'URL=$(cdk --app cdk.out --context envName=prod --outputs-file prod-outputs.json deploy --require-approval never 2>/dev/null && cat prod-outputs.json | jq -r \'.[] | select(.CloudFrontUrl) | .CloudFrontUrl\' || echo "Deployment completed")',
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
      runsOn: ["ubuntu-latest"],
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