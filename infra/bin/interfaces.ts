import { StackProps } from "aws-cdk-lib";

export interface AppStackProps extends StackProps {
    // The name of the environment, e.g. 'dev', 'prod', 'staging'
    readonly envName: string;
    readonly hostedZone: string;
}
