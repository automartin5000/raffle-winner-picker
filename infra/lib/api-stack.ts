import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { RestApi, LambdaIntegration, DomainName, BasePathMapping } from 'aws-cdk-lib/aws-apigateway';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone, ARecord, RecordTarget, IHostedZone } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayDomain } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { AppStackProps } from "../bin/interfaces";
import { buildApiDomain } from "../../src/lib/domain-constants";

export class ApiStack extends cdk.Stack {
    public readonly api: RestApi;
    private readonly envName: string;
    private readonly fullDomain: string;
    private readonly apiDomain: string;
    private readonly hostedZone: IHostedZone;

    constructor(scope: Construct, id: string, props: AppStackProps) {
      super(scope, id, {
        ...props,
        stackName: `RPW-Api-${props.envName}`,
      });
        this.envName = props.envName;

        // Skip hosted zone lookup for local development
        this.hostedZone = HostedZone.fromLookup(this, 'HostedZone', {
          domainName: props.hostedZone,
          
            });

        const subdomainPrefix = props.envName === 'prod' ? '' : `${props.envName}.`;
        this.fullDomain = `${subdomainPrefix}${this.hostedZone.zoneName}`
        this.apiDomain = buildApiDomain({
            envName: props.envName,
            hostedZone: this.hostedZone.zoneName,
            isProd: props.envName === 'prod',
        });

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

        // Create custom domain for API
        this.setupCustomDomain(api);

        // Output API URL
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: api.url,
            description: 'API Gateway endpoint URL',
        });

        new cdk.CfnOutput(this, 'ApiCustomDomainUrl', {
            value: `https://${this.apiDomain}`,
            description: 'Custom domain URL for API',
        });

        return api;
    }

    private setupCustomDomain(api: RestApi): void {
        // Create SSL certificate for the API domain
        const certificate = new Certificate(this, 'ApiCertificate', {
            domainName: this.apiDomain,
            validation: CertificateValidation.fromDns(this.hostedZone),
        });

        // Create custom domain name
        const customDomain = new DomainName(this, 'ApiCustomDomain', {
            domainName: this.apiDomain,
            certificate: certificate,
        });

        // Map the custom domain to the API
        new BasePathMapping(this, 'ApiBasePathMapping', {
            domainName: customDomain,
            restApi: api,
        });

        // Create A record pointing to the custom domain
        // Extract just the subdomain part (everything before the hosted zone)
        const recordName = this.apiDomain.replace(`.${this.hostedZone.zoneName}`, '');
        new ARecord(this, 'ApiAliasRecord', {
            zone: this.hostedZone,
            recordName: recordName || undefined, // undefined for apex domain
            target: RecordTarget.fromAlias(new ApiGatewayDomain(customDomain)),
        });
    }
}
