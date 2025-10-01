import { App } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApiStack } from "../lib/api-stack";
import { FrontendStack } from "../lib/frontend-stack";
import { type AppStackProps } from "./interfaces";
import { DEPLOYMENT_ENVIRONMENTS, getAllEnvironments, resolveAwsAccount } from "../../src/lib/shared-constants";

const region = 'us-east-1';

// Create AWS environment configurations based on shared environment definitions
const awsEnvironments: AppStackProps[] = [];

// Determine the current AWS account
const currentAwsAccount = resolveAwsAccount({
  deployEnv: process.env.DEPLOY_ENV,
  isEphemeral: process.env.DEPLOY_EPHEMERAL === 'true',
});

console.log(`Resolved AWS account: ${currentAwsAccount}`);

// Determine if we're doing an ephemeral PR environment operation
const isEphemeralOp = process.env.DEPLOY_EPHEMERAL === 'true' && process.env.DEPLOY_ENV;
const isStaticEnv = process.env.DEPLOY_ENV && getAllEnvironments().includes(process.env.DEPLOY_ENV as any);

// For ephemeral PR environments, only create the PR stacks (skip dev/prod)
// For static environments or when no DEPLOY_ENV is set, create all static stacks
if (isEphemeralOp && !isStaticEnv) {
  // Only create the ephemeral PR environment
  console.log(`Creating ephemeral environment for ${process.env.DEPLOY_ENV}`);
  awsEnvironments.push({
    env: {
      account: process.env.NONPROD_AWS_ACCOUNT_ID!,
      region,
    },
    envName: process.env.DEPLOY_ENV!, // Use PR-specific name (e.g., "pr123")
    hostedZone: process.env.NONPROD_HOSTED_ZONE!,
    deploymentEnv: currentAwsAccount,
  });
} else {
  // Create both dev and prod static environments for CDK synthesis
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
            apiStack,
        });
    }
}

awsEnvironments.forEach((props) => {
    console.log(`Creating stack for ${props.envName} with props: ${JSON.stringify(props)}`);
    new RootApp(cdkApp, props.envName, props);
});

cdkApp.synth();