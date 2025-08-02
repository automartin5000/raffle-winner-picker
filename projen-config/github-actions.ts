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
  addManualProductionDeployWorkflow(github);
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
    limitConcurrency: true,
      concurrencyOptions: {
        group: "pr-deploy",
        cancelInProgress: false,
    },
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
      defaults: {
        run: {
          shell: "bash",
        }
      },
      permissions: {
        contents: JobPermission.READ,
        idToken: JobPermission.WRITE,
        actions: JobPermission.READ,  // Needed to download artifacts
        pullRequests: JobPermission.WRITE, // Needed for commenting
      },
      steps: [
        {
          name: "Checkout",
          uses: "actions/checkout@v4",
          with: {
            ref: "${{ github.event.pull_request.head.sha }}",
          }
        },
        {
          id: "build",
          uses: "./.github/actions/build",
          with: {
            upload_artifacts: true,
          },
        },
        {
          name: "Generate CDK Diff",
          id: "cdk-diff",
          run: [
            'echo "Stack Changes:" > cdk-diff.txt',
            'echo "" >> cdk-diff.txt',
            'bunx cdk diff "prod/*" --app cdk.out "$AWS_CDK_ENV_NAME/*" > cdk-diff-raw.txt 2>&1 || true',
            '# Obfuscate sensitive information',
            'cat cdk-diff-raw.txt | sed -E "s/[0-9]{12}/XXXX-ACCOUNT-ID-XXXX/g" | ' +
            'sed -E "s/${{ secrets.NONPROD_AWS_ACCOUNT_ID }}/XXXX-NONPROD-ACCOUNT-ID-XXXX/g" | ' +
            'sed -E "s/${{ secrets.PROD_AWS_ACCOUNT_ID }}/XXXX-PROD-ACCOUNT-ID-XXXX/g" | ' +
            'sed -E "s/${{ secrets.NONPROD_HOSTED_ZONE }}/nonprod.example.com/g" | ' +
            'sed -E "s/${{ secrets.PROD_HOSTED_ZONE }}/example.com/g" > cdk-diff.txt',
            'echo "CDK_DIFF_CONTENT<<EOF" >> $GITHUB_OUTPUT',
            'cat cdk-diff.txt >> $GITHUB_OUTPUT',
            'echo "EOF" >> $GITHUB_OUTPUT',
            'rm cdk-diff-raw.txt'
          ].join("\n"),
        },
        {
          name: "Deploy PR environment",
          id: "deploy",
          run: "bunx projen deploy \"$AWS_CDK_ENV_NAME/*\" --require-approval never",
        },
        {
          name: "Get CloudFront URL",
          id: "get-url",
          run: [
            'URL=$(cdk --app cdk.out --outputs-file outputs.json deploy --require-approval never 2>/dev/null && cat outputs.json | jq -r \'.[] | select(.CloudFrontUrl) | .CloudFrontUrl\' || echo "Not available yet")',
            'echo "CLOUDFRONT_URL=$URL" >> $GITHUB_OUTPUT',
          ].join("\n"),
        },
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
              "**Status:** ${{ steps.deploy.outcome == 'success' && '✅ Deployed' || '❌ Failed' }}",
              "",
              "### 📋 CDK Prod Diff",
              "<details>",
              "<summary>Click to view infrastructure changes</summary>",
              "",
              "```diff",
              "${{ steps.cdk-diff.outputs.CDK_DIFF_CONTENT }}",
              "```",
              "</details>",
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
    pullRequestTarget: {
      types: ["closed"],
      branches: ["main"]
    }
  });

  workflow.addJobs({
    deploy_production: {
      name: "Deploy to Production",
      runsOn: RUNNER_TYPE,
      if: "github.event.pull_request.merged == true",
      environment: "production",
      permissions: {
        contents: JobPermission.READ,
        idToken: JobPermission.WRITE,
        actions: JobPermission.READ,  // Needed to download artifacts
        pullRequests: JobPermission.READ,
      },
      steps: [
        { name: "Checkout", uses: "actions/checkout@v4" },
        {
          name: "Find build artifact",
          id: "find-artifact",
          uses: "actions/github-script@v7",
          with: {
            "result-encoding": "string",
            script: `
              const headSha = context.payload.pull_request.head.sha;
              const mergeCommitSha = context.payload.pull_request.merge_commit_sha;
              
              console.log('Looking for builds:', {
                headSha,
                mergeCommitSha,
                pr: context.payload.pull_request.number,
                title: context.payload.pull_request.title
              });
              
              // Find the build workflow
              const workflows = await github.rest.actions.listRepoWorkflows({
                owner: context.repo.owner,
                repo: context.repo.repo,
              });
              
              const buildWorkflow = workflows.data.workflows.find(w => w.name === 'build');
              if (!buildWorkflow) {
                throw new Error('Could not find build workflow');
              }
              
              // Get workflow runs for the target commit
              const runs = await github.rest.actions.listWorkflowRuns({
                owner: context.repo.owner,
                repo: context.repo.repo,
                workflow_id: buildWorkflow.id,
              });
              
              console.log('Found workflow runs:', runs.data.workflow_runs.map(r => 
                \`\${r.head_sha} (\${r.status})\`).join(', '));

              // Find the successful run for our target commit
              const successRun = runs.data.workflow_runs.find(r => 
                (r.head_sha === headSha || r.head_sha === mergeCommitSha) && 
                r.status === 'completed' && 
                r.conclusion === 'success'
              );
              
              if (!successRun) {
                throw new Error(
                  \`No successful build found for PR #\${context.payload.pull_request.number}\\n\` +
                  \`Head commit: \${headSha}\\n\` +
                  \`Merge commit: \${mergeCommitSha}\\n\` +
                  \`Available runs: \${runs.data.workflow_runs.map(r => \`\${r.head_sha} (\${r.status})\`).join(', ')}\`
                );
              }
              
              console.log('Found successful build run:', successRun.head_sha);

              // List artifacts for the successful run
              const artifacts = await github.rest.actions.listWorkflowRunArtifacts({
                owner: context.repo.owner,
                repo: context.repo.repo,
                run_id: successRun.id,
              });

              // Look for artifacts with either the head SHA or merge commit SHA
              const cdkArtifact = artifacts.data.artifacts.find(a => 
                a.name === \`cdk-out-\${headSha}\` || 
                a.name === \`cdk-out-\${mergeCommitSha}\`
              );
              
              if (!cdkArtifact) {
                throw new Error(
                  \`No CDK artifact found. Expected cdk-out-\${headSha} or cdk-out-\${mergeCommitSha}\\n\` +
                  \`Available artifacts: \${artifacts.data.artifacts.map(a => a.name).join(', ')}\`
                );
              }

              console.log('Found CDK artifact:', cdkArtifact.name);
              console.log('Artifact ID:', cdkArtifact.id);
              return JSON.stringify({
                artifactId: cdkArtifact.id,
                runId: successRun.id
              });
            `
          }
        },
        {
          name: "Set artifact details",
          id: "artifact-details",
          run: [
            'RESULT=${{ steps.find-artifact.outputs.result }}',
            'echo "artifact-id=$(echo $RESULT | jq -r .artifactId)" >> $GITHUB_OUTPUT',
            'echo "run-id=$(echo $RESULT | jq -r .runId)" >> $GITHUB_OUTPUT'
          ].join('\n'),
        },
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
            "artifact-ids": "${{ steps.artifact-details.outputs.artifact-id }}",
            "run-id": "${{ steps.artifact-details.outputs.run-id }}",
            path: "cdk.out/",
          },
        },
        { name: "Setup Bun", uses: "oven-sh/setup-bun@v2" },
        { name: "Install dependencies", run: "bun install --frozen-lockfile" },
        {
          name: "Deploy to Production",
          run: "bun projen deploy 'prod/*' --app cdk.out --require-approval never",
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
            'echo "Artifact: ${{ steps.find-artifact.outputs.result }}"',
          ].join("\n"),
        },
      ],
    },
  });
};

const addManualProductionDeployWorkflow = (github: GitHub) => {
  const workflow = new GithubWorkflow(github, "manual-prod-deploy");

  workflow.on({
    workflowDispatch: {
      inputs: {
        commit: {
          description: "The commit SHA to deploy. If not provided, will use the latest commit on main.",
          required: false,
          type: "string"
        }
      }
    }
  });

  workflow.addJobs({
    find_artifact: {
      name: "Find Build Artifact",
      runsOn: RUNNER_TYPE,
      permissions: {
        contents: JobPermission.READ,
        actions: JobPermission.READ
      },
      steps: [
        {
          name: "Find build artifact",
          uses: "actions/github-script@v7",
          id: "find-artifact",
          with: {
            script: `
              const targetSha = core.getInput('commit') || context.sha;
              console.log('Looking for build for commit:', targetSha);
              
              // First, find the build workflow
              const workflows = await github.rest.actions.listRepoWorkflows({
                owner: context.repo.owner,
                repo: context.repo.repo,
              });
              
              const buildWorkflow = workflows.data.workflows.find(w => w.name === 'build');
              if (!buildWorkflow) {
                throw new Error('Could not find build workflow');
              }
              
              // Get the commit details to handle merge and squash commits
              const commit = await github.rest.git.getCommit({
                owner: context.repo.owner,
                repo: context.repo.repo,
                commit_sha: targetSha
              });
              
              // Get the commit message to check for squash merge
              const commitInfo = await github.rest.repos.getCommit({
                owner: context.repo.owner,
                repo: context.repo.repo,
                ref: targetSha
              });
              
              let commitToFind = targetSha;
              
              if (commit.data.parents.length > 1) {
                // Regular merge commit - use the PR branch commit
                commitToFind = commit.data.parents[1].sha;
              } else if (commitInfo.data.commit.message.includes('(#')) {
                // Squash merge - try to extract PR number and find the last PR commit
                const prNumber = commitInfo.data.commit.message.match(/\\(#(\\d+)\\)/)?.[1];
                if (prNumber) {
                  // Get the PR to find its last commit
                  const pr = await github.rest.pulls.get({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    pull_number: parseInt(prNumber, 10)
                  });
                  commitToFind = pr.data.head.sha;
                }
              }
              
              console.log('Using commit SHA for artifact:', commitToFind);
              
              // Get workflow runs for the target commit
              const runs = await github.rest.actions.listWorkflowRuns({
                owner: context.repo.owner,
                repo: context.repo.repo,
                workflow_id: buildWorkflow.id,
              });

              console.log('Found workflow runs:', runs.data.workflow_runs.map(r => 
                \`\${r.head_sha} (\${r.status})\`).join(', '));

              const successRun = runs.data.workflow_runs.find(r => 
                (r.head_sha === commitToFind || r.head_sha === targetSha) && 
                r.status === 'completed' && 
                r.conclusion === 'success'
              );
              
              if (!successRun) {
                throw new Error(
                  \`No successful build found for commit \${targetSha}\\n\` +
                  \`Commit message: \${commitInfo.data.commit.message}\\n\` +
                  \`Commit type: \${commit.data.parents.length > 1 ? 'merge' : commitInfo.data.commit.message.includes('(#') ? 'squash' : 'regular'}\\n\` +
                  \`Tried looking for: \${commitToFind} and \${targetSha}\\n\` +
                  \`Available runs: \${runs.data.workflow_runs.map(r => \`\${r.head_sha} (\${r.status})\`).join(', ')}\`
                );
              }

              // List artifacts for the successful run
              const artifacts = await github.rest.actions.listWorkflowRunArtifacts({
                owner: context.repo.owner,
                repo: context.repo.repo,
                run_id: successRun.id,
              });

              const cdkArtifact = artifacts.data.artifacts.find(a => 
                a.name === \`cdk-out-\${commitToFind}\` || a.name === \`cdk-out-\${targetSha}\`
              );
              if (!cdkArtifact) {
                throw new Error(
                  \`No CDK artifact found for commits \${commitToFind} or \${targetSha}\\n\` +
                  \`Available artifacts: \${artifacts.data.artifacts.map(a => a.name).join(', ')}\`
                );
              }

              console.log('Found CDK artifact:', cdkArtifact.name);
              return JSON.stringify({
                artifactName: cdkArtifact.name,
                runId: successRun.id,
                commitSha: commitToFind
              });
            `
          }
        },
        {
          name: "Set artifact details",
          run: [
            'RESULT=${{ steps.find-artifact.outputs.result }}',
            'echo "artifact-name=$(echo $RESULT | jq -r .artifactName)" >> $GITHUB_OUTPUT',
            'echo "run-id=$(echo $RESULT | jq -r .runId)" >> $GITHUB_OUTPUT',
            'echo "commit-sha=$(echo $RESULT | jq -r .commitSha)" >> $GITHUB_OUTPUT'
          ].join('\n'),
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
        actions: JobPermission.READ,
      },
      steps: [
        { 
          name: "Checkout",
          uses: "actions/checkout@v4",
          with: {
            ref: "${{ needs.find_artifact.outputs.commit-sha }}"
          }
        },
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
            'echo "Commit: ${{ needs.find_artifact.outputs.commit-sha }}"'
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
      env: {
        AWS_CDK_ENV_NAME: "pr${{ github.event.number }}",
        NONPROD_AWS_ACCOUNT_ID: '${{ secrets.NONPROD_AWS_ACCOUNT_ID }}',
        PROD_AWS_ACCOUNT_ID: '${{ secrets.PROD_AWS_ACCOUNT_ID }}',
        NONPROD_HOSTED_ZONE: '${{ secrets.NONPROD_HOSTED_ZONE }}',
        PROD_HOSTED_ZONE: '${{ secrets.PROD_HOSTED_ZONE }}',
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
          name: "Dummy build directory for cdk",
          run: "mkdir build && touch build/index.js",
        },
        {
          name: "Destroy PR environment",
          run: "bunx projen destroy \"$AWS_CDK_ENV_NAME/*\" --force",
        },
      ],
    },
  });
};