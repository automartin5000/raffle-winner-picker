module.exports = async ({ github, context }) => {
  const workflowName = 'build';
  const maxAttempts = 60;  // 10 minutes (60 * 10 seconds)
  const ref = context.sha;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`Checking build status (attempt ${attempt + 1}/${maxAttempts})`);
    
    const builds = await github.rest.actions.listWorkflowRuns({
      owner: context.repo.owner,
      repo: context.repo.repo,
      workflow_id: workflowName + '.yml',
      head_sha: ref,
    });
    
    if (builds.data.workflow_runs.length > 0) {
      const build = builds.data.workflow_runs[0];
      console.log(`Build status: ${build.status}, conclusion: ${build.conclusion}`);
      
      if (build.status === 'completed') {
        if (build.conclusion === 'success') {
          console.log('Build completed successfully');
          return;
        } else {
          throw new Error(`Build failed with conclusion: ${build.conclusion}`);
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
  }
  
  throw new Error('Timed out waiting for build to complete');
};
