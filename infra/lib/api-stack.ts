import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { RestApi, LambdaIntegration, Cors } from 'aws-cdk-lib/aws-apigateway';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { AppStackProps } from "../bin/interfaces";

export class ApiStack extends cdk.Stack {
    public readonly api: RestApi;
    private readonly envName: string;
    private readonly fullDomain: string;
    private readonly apiDomain: string;

    constructor(scope: Construct, id: string, props: AppStackProps) {
      super(scope, id, {
        ...props,
        stackName: `RPW-Api-${props.envName}`,
      });
        this.envName = props.envName;

        // Skip hosted zone lookup for local development
        const hostedZone = HostedZone.fromLookup(this, 'HostedZone', {
                domainName: props.hostedZone,
            });

        const subdomainPrefix = props.envName === 'prod' ? '' : `${props.envName}.`;
        this.fullDomain = `${subdomainPrefix}raffle-picker.${hostedZone.zoneName}`
        this.apiDomain = `${subdomainPrefix}api.raffle-picker.${hostedZone.zoneName}`

        // Create backend infrastructure
        const raffleTable = this.createDynamoTable();
        this.api = this.createApi(raffleTable);

        // Add tags
        cdk.Tags.of(this).add('environment', props.envName);
        cdk.Tags.of(this).add('project', 'raffle-winner-picker');
    }

    private createDynamoTable(): Table {
        return new Table(this, 'RaffleRunsTable', {
            partitionKey: {
                name: 'userId',
                type: AttributeType.STRING,
            },
            sortKey: {
                name: 'runId',
                type: AttributeType.STRING,
            },
            billingMode: BillingMode.PAY_PER_REQUEST,
            removalPolicy: this.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: this.envName === 'prod'
            },
        });
    }

    private createApi(raffleTable: Table): RestApi {
        // Lambda function for raffle operations
        const raffleFunction = new Function(this, 'RaffleFunction', {
            runtime: Runtime.NODEJS_18_X,
            architecture: Architecture.ARM_64,
            handler: 'index.handler',
            code: Code.fromAsset(path.join(__dirname, '../lambda/raffle-api')),
            environment: {
                TABLE_NAME: raffleTable.tableName,
                ALLOWED_ORIGIN: `https://${this.fullDomain}`,
            },
            timeout: cdk.Duration.seconds(30),
        });

        // Grant DynamoDB permissions
        raffleTable.grantReadWriteData(raffleFunction);

        // Create API Gateway
        const api = new RestApi(this, 'RaffleApi', {
            description: 'API for Raffle Winner Picker application',
            defaultCorsPreflightOptions: {
                allowOrigins: [`https://${this.fullDomain}`],
                allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });

        // API routes
        const raffleResource = api.root.addResource('raffle-runs');
        raffleResource.addMethod('GET', new LambdaIntegration(raffleFunction));
        raffleResource.addMethod('POST', new LambdaIntegration(raffleFunction));

        const singleRaffleResource = raffleResource.addResource('{runId}');
        singleRaffleResource.addMethod('GET', new LambdaIntegration(raffleFunction));

        // Output API URL
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: api.url,
            description: 'API Gateway endpoint URL',
        });

        return api;
    }
}
