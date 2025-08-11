import { StackProps } from "aws-cdk-lib";
import { type DeploymentEnvironment } from "../../src/lib/shared-constants";

export interface AppStackProps extends StackProps {
    // The name of the environment, e.g. 'dev', 'prod', 'pr123'
    readonly envName: string;
    readonly hostedZone: string;
    // The deployment environment configuration to use (dev or prod)
    readonly deploymentEnv?: DeploymentEnvironment;
}
