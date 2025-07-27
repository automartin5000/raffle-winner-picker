import { App } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApiStack } from "../lib/api-stack";
import { FrontendStack } from "../lib/frontend-stack";
import { type AppStackProps } from "./interfaces";

const region = 'us-east-1';

const awsEnvironments: AppStackProps[] = [
  {
    env: {
      region,
      account: process.env.NONPROD_AWS_ACCOUNT_ID,
    },
    envName: 'dev',
    hostedZone: process.env.NONPROD_HOSTED_ZONE!,
  },
  {
    env: {
      region,
      account: process.env.PROD_AWS_ACCOUNT_ID,
    },
    envName: 'prod',
    hostedZone: process.env.PROD_HOSTED_ZONE!,
  },

];

if (process.env.AWS_CDK_ENV_NAME) {
    awsEnvironments.push({
        env: {
            account: process.env.NONPROD_AWS_ACCOUNT_ID!,
            region,
        },
        envName: process.env.AWS_CDK_ENV_NAME,
        hostedZone: process.env.NONPROD_HOSTED_ZONE!,
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
            api: apiStack.api
        });
    }
}

awsEnvironments.forEach((props) => {
    console.log(`Creating stack for ${props.envName} with props: ${JSON.stringify(props)}`);
    new RootApp(cdkApp, props.envName, props);
});

cdkApp.synth();