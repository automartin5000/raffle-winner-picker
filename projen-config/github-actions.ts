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
          name: "Wait for build workflow",
          uses: "actions/github-script@v7",
          with: {
            script: `
              async function waitForBuild() {
                const maxAttempts = 60;  // 10 minutes (60 * 10 seconds)
                const prRef = context.payload.pull_request?.head.sha;
                const buildRef = context.sha;
                
                console.log('Event type:', context.eventName);
                console.log('PR head commit:', prRef);
                console.log('Build commit SHA:', buildRef);
                console.log('PR number:', context.payload.pull_request?.number);
                
                // First, list all workflows to find the build workflow by name
                const workflows = await github.rest.actions.listRepoWorkflows({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                });
                
                console.log('Available workflows:');
                workflows.data.workflows.forEach(w => {
                  console.log(\`- \${w.name} (ID: \${w.id}, Path: \${w.path})\`);
                });
                
                const buildWorkflow = workflows.data.workflows.find(w => w.name === 'build');
                
                if (!buildWorkflow) {
                  throw new Error('Could not find workflow named "build"');
                }
                
                console.log('Found build workflow:', buildWorkflow.name, buildWorkflow.id);
                
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                  console.log(\`\\n[Attempt \${attempt + 1}/\${maxAttempts}] Checking build status...\`);
                  
                  // Get all recent runs for this workflow
                  const builds = await github.rest.actions.listWorkflowRuns({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    workflow_id: buildWorkflow.id,
                  });

                  // Log all runs to help debug
                  console.log('\\nAll recent workflow runs:');
                  builds.data.workflow_runs.forEach(run => {
                    console.log(\`- Run ID: \${run.id}, SHA: \${run.head_sha}, Status: \${run.status}, Branch: \${run.head_branch}\`);
                  });

                  // Filter for builds matching either the PR head commit or the build commit
                  const ourBuilds = builds.data.workflow_runs.filter(run => 
                    run.head_sha === prRef || run.head_sha === buildRef
                  );
                  
                  console.log('Query parameters:');
                  console.log('- Owner:', context.repo.owner);
                  console.log('- Repo:', context.repo.repo);
                  console.log('- Workflow ID:', buildWorkflow.id);
                  console.log('- PR Head SHA:', prRef);
                  console.log('- Build SHA:', buildRef);
                  console.log('- Branch:', context.payload.pull_request?.head.ref);
                  
                  console.log(\`Found \${ourBuilds.length} workflow runs for commits \${prRef} or \${buildRef}\`);
                  
                  if (ourBuilds.length > 0) {
                    const build = ourBuilds[0];
                    console.log('Latest build details:');
                    console.log(\`- Run ID: \${build.id}\`);
                    console.log(\`- Status: \${build.status}\`);
                    console.log(\`- Conclusion: \${build.conclusion}\`);
                    console.log(\`- Created: \${build.created_at}\`);
                    console.log(\`- URL: \${build.html_url}\`);
                    
                    if (build.status === 'completed') {
                      if (build.conclusion === 'success') {
                        // Find the artifact for this build
                        const artifacts = await github.rest.actions.listWorkflowRunArtifacts({
                          owner: context.repo.owner,
                          repo: context.repo.repo,
                          run_id: build.id,
                        });
                        
                        console.log('Available artifacts:', artifacts.data.artifacts.map(a => a.name));
                        
                        const cdkArtifact = artifacts.data.artifacts.find(a => a.name.startsWith('cdk-out-'));
                        if (!cdkArtifact) {
                          console.log('No CDK artifact found yet, waiting...');
                          await new Promise(resolve => setTimeout(resolve, 10000));
                          continue;
                        }

                        core.exportVariable('CDK_ARTIFACT_NAME', cdkArtifact.name);
                        console.log('✅ Build completed successfully and artifact found:', cdkArtifact.name);
                        return cdkArtifact.name;
                      } else {
                        throw new Error(\`❌ Build failed with conclusion: \${build.conclusion}\`);
                      }
                    } else {
                      console.log('⏳ Build is still in progress, waiting...');
                    }
                  } else {
                    console.log('No matching workflow runs found yet, waiting...');
                  }
                  
                  await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
                }
                
                throw new Error('Timed out waiting for build to complete');
              }
              
              return await waitForBuild();
            `
          }
        },
        {
          name: "Download CDK artifacts",
          uses: "actions/download-artifact@v4",
          with: {
            name: "${{ env.CDK_ARTIFACT_NAME }}",
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
      name: "Find Build Artifact",
      runsOn: ["ubuntu-latest"],
      permissions: {
        contents: JobPermission.READ,
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
          name: "Download CDK artifacts",
          uses: "actions/download-artifact@v4",
          with: {
            name: "${{ needs.find_artifact.outputs.artifact-name }}",
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