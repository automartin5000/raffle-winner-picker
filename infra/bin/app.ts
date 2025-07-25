import { App } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ComputeStack } from "../lib/compute-stack";
import { type AppStackProps } from "./interfaces";

const region = 'us-east-1';

const awsEnvironments: AppStackProps[] = [];

// Only create stacks if environment variables are set
if (process.env.NONPROD_AWS_ACCOUNT_ID && process.env.NONPROD_HOSTED_ZONE) {
    awsEnvironments.push({
        env: {
            region,
            account: process.env.NONPROD_AWS_ACCOUNT_ID,
        },
        envName: 'dev',
        hostedZone: process.env.NONPROD_HOSTED_ZONE,
    });
}

if (process.env.PROD_AWS_ACCOUNT_ID && process.env.PROD_HOSTED_ZONE) {
    awsEnvironments.push({   
        env: {
            account: process.env.PROD_AWS_ACCOUNT_ID,
            region,
        },
        envName: 'prod',
        hostedZone: process.env.PROD_HOSTED_ZONE,
    });
}

// For local development, create a minimal stack
if (awsEnvironments.length === 0) {
    awsEnvironments.push({
        env: {
            region,
            account: process.env.CDK_DEFAULT_ACCOUNT || '123456789012',
        },
        envName: 'local',
        hostedZone: 'example.com', // Placeholder for local development
    });
}

if (process.env.AWS_CDK_ENV_NAME) {
    awsEnvironments.push({
        env: {
            account: process.env.NONPROD_ACCOUNT_ID!,
            region,
        },
        envName: process.env.AWS_CDK_ENV_NAME,
        hostedZone: process.env.NONPROD_HOSTED_ZONE!,
    });
}
console.log(`Creating stacks for environments: ${awsEnvironments.map((env) => env.envName).join(', ')}`);
const cdkApp = new App();

class RootApp extends Construct {
    constructor(scope: Construct, id: string, props: AppStackProps ) {
        super(scope, id);
        new ComputeStack(this, 'Compute', props);
    }
}

awsEnvironments.forEach((props) => {
    console.log(`Creating stack for ${props.envName} with props: ${JSON.stringify(props)}`);
    new RootApp(cdkApp, props.envName, props);
});

cdkApp.synth();