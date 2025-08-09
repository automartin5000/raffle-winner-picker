import { App } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApiStack } from "../lib/api-stack";
import { FrontendStack } from "../lib/frontend-stack";
import { type AppStackProps } from "./interfaces";
import { DEPLOYMENT_ENVIRONMENTS, getAllEnvironments, resolveDeploymentEnvironment } from "../../src/lib/shared-constants";

const region = 'us-east-1';

// Create AWS environment configurations based on shared environment definitions
const awsEnvironments: AppStackProps[] = [];

// Determine the current deployment environment
const currentDeployEnv = resolveDeploymentEnvironment({
  deployEnv: process.env.DEPLOY_ENV,
  isEphemeral: process.env.DEPLOY_EPHEMERAL === 'true',
});

console.log(`Resolved deployment environment: ${currentDeployEnv}`);

// Always create both dev and prod static environments for CDK synthesis
getAllEnvironments().forEach(envKey => {
  awsEnvironments.push({
    env: {
      region,
      account: envKey === 'prod' 
        ? process.env.PROD_AWS_ACCOUNT_ID 
        : process.env.NONPROD_AWS_ACCOUNT_ID,
    },
    envName: envKey,
    hostedZone: envKey === 'prod' 
      ? process.env.PROD_HOSTED_ZONE! 
      : process.env.NONPROD_HOSTED_ZONE!,
    deploymentEnv: envKey,
  });
});

// If this is an ephemeral deployment (PR), also create the ephemeral environment
// But only if it's different from the static environments
if (process.env.DEPLOY_EPHEMERAL === 'true' && process.env.DEPLOY_ENV) {
  const isStaticEnv = getAllEnvironments().includes(process.env.DEPLOY_ENV as any);
  
  if (!isStaticEnv) {
    awsEnvironments.push({
      env: {
        account: process.env.NONPROD_AWS_ACCOUNT_ID!,
        region,
      },
      envName: process.env.DEPLOY_ENV, // Use PR-specific name (e.g., "pr123")
      hostedZone: process.env.NONPROD_HOSTED_ZONE!,
      deploymentEnv: currentDeployEnv, // But use "dev" for configuration
    });
  }
}
console.log(`Creating stacks for environments: ${awsEnvironments.map((env) => env.envName).join(', ')}`);
const cdkApp = new App();

class RootApp extends Construct {
    constructor(scope: Construct, id: string, props: AppStackProps) {
        super(scope, id);
        
        // Create API stack first
        const apiStack = new ApiStack(this, 'Api', props);
        
        // Create frontend stack with API reference
        new FrontendStack(this, 'Frontend', {
            ...props,
            api: apiStack.api
        });
    }
}

awsEnvironments.forEach((props) => {
    console.log(`Creating stack for ${props.envName} with props: ${JSON.stringify(props)}`);
    new RootApp(cdkApp, props.envName, props);
});

cdkApp.synth();