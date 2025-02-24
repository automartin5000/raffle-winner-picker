import { App, Environment } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ComputeStack } from "../lib/compute-stack";
import { AppStackProps } from "./interfaces";

const awsEnvironments: AppStackProps[] = [
    {
        env: {
            region: process.env.NONPROD_REGION!,
            account: process.env.NONPROD_ACCOUNT_ID!,
        },
        envName: 'dev',
        hostedZone: process.env.NONPROD_HOSTED_ZONE!,
    },
    {   
        env: {
            account: process.env.PROD_ACCOUNT_ID!,
            region: process.env.PROD_REGION!,
        },
        envName: 'prod',
        hostedZone: process.env.PROD_HOSTED_ZONE!,
    },
];

if (process.env.AWS_CDK_ENV_NAME) {
    awsEnvironments.push({
        env: {
            account: process.env.NONPROD_ACCOUNT_ID!,
            region: process.env.NONPROD_REGION!,
        },
        envName: process.env.AWS_CDK_ENV_NAME,
        hostedZone: process.env.NONPROD_HOSTED_ZONE!,
    });
}

const cdkApp = new App();

class RootApp extends Construct {
    constructor(scope: Construct, id: string, props: AppStackProps ) {
        super(scope, id);
        new ComputeStack(this, 'ComputeStack', props);
    }
}

awsEnvironments.forEach((props) => {
    new RootApp(cdkApp, props.envName, props);
});

cdkApp.synth();