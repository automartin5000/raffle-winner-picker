import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { CorsHttpMethod, HttpApi, HttpMethod, DomainName, ApiMapping } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone, IHostedZone, ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayv2DomainProperties } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { AppStackProps } from "../bin/interfaces";
import { buildApiDomain, CORE_SERVICES } from "../../src/lib/domain-constants";

export class ApiStack extends cdk.Stack {
    public readonly winnersApi: HttpApi;
    public readonly winnersApiDomain: string;
    private readonly envName: string;
    private readonly fullDomain: string;
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
        this.winnersApiDomain = buildApiDomain({
            envName: props.envName,
          hostedZone: this.hostedZone.zoneName,
            service: CORE_SERVICES.WINNERS
        });

        // Create backend infrastructure
        const raffleTable = this.createDynamoTable();
        this.winnersApi = this.createApi(raffleTable);

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

    private createApi(raffleTable: Table): HttpApi {
        // Lambda function for raffle operations
        const raffleFunction = new Function(this, 'RaffleFunction', {
            runtime: Runtime.NODEJS_22_X,
            architecture: Architecture.ARM_64,
            handler: 'index.handler',
            code: Code.fromAsset(path.join(__dirname, '../lambda/raffle-api')),
            environment: {
                TABLE_NAME: raffleTable.tableName,
                ALLOWED_ORIGIN: `https://${this.fullDomain}`,
                DEPLOY_ENV: this.envName,
            },
            timeout: cdk.Duration.seconds(30),
        });

        // Grant DynamoDB permissions
        raffleTable.grantReadWriteData(raffleFunction);

        // Create HTTP API with CORS
        const allowedOrigins = [`https://${this.fullDomain}`];
        
        // Add localhost origins for non-production environments only
        if (this.envName !== 'prod') {
            allowedOrigins.push(
                'http://localhost:5173',
                'http://localhost:5174',
                'http://localhost:3000', 
                'http://127.0.0.1:5173',
                'http://127.0.0.1:5174'
            );
        }

        const api = new HttpApi(this, 'RaffleHttpApi', {
            disableExecuteApiEndpoint: true,
            description: 'HTTP API for Raffle Winner Picker application',
            corsPreflight: {
                allowOrigins: allowedOrigins,
                allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PUT, CorsHttpMethod.DELETE, CorsHttpMethod.OPTIONS],
                allowHeaders: ['Content-Type', 'Authorization'],
                allowCredentials: true,
            },
        });

        // Create JWT Authorizer for Auth0
        const jwtAuthorizer = new HttpJwtAuthorizer(
            'Auth0JWTAuthorizer',
            `https://${process.env.AUTH0_DOMAIN}/`,
            {
                authorizerName: 'Auth0JWTAuthorizer',
                identitySource: ['$request.header.Authorization'],
                jwtAudience: [`https://${this.winnersApiDomain}`],
            }
        );

        // Create Lambda integration
        const lambdaIntegration = new HttpLambdaIntegration('RaffleLambdaIntegration', raffleFunction);

        // Add routes with JWT authorization
        api.addRoutes({
            path: '/runs',
            methods: [HttpMethod.GET, HttpMethod.POST],
            integration: lambdaIntegration,
            authorizer: jwtAuthorizer,
        });

        api.addRoutes({
            path: '/runs/{runId}',
            methods: [HttpMethod.GET],
            integration: lambdaIntegration,
            authorizer: jwtAuthorizer,
        });

        // Add OPTIONS routes without authorization for CORS preflight
        api.addRoutes({
            path: '/runs',
            methods: [HttpMethod.OPTIONS],
            integration: lambdaIntegration,
        });

        api.addRoutes({
            path: '/runs/{runId}',
            methods: [HttpMethod.OPTIONS],
            integration: lambdaIntegration,
        });

        // Create custom domain for API
        this.setupCustomDomain(api);

        // Output API URL

        new cdk.CfnOutput(this, 'ApiCustomDomainUrl', {
            value: `https://${this.winnersApiDomain}`,
            description: 'Custom domain URL for API',
        });

        return api;
    }

    private setupCustomDomain(api: HttpApi): void {
        // Create certificate for the API domain
        const certificate = new Certificate(this, 'ApiCertificate', {
            domainName: this.winnersApiDomain,
            validation: CertificateValidation.fromDns(this.hostedZone),
        });

        // Create custom domain name for HTTP API
        const domainName = new DomainName(this, 'ApiDomainName', {
            domainName: this.winnersApiDomain,
            certificate: certificate,
        });

        // Create API mapping to connect custom domain to the API
        new ApiMapping(this, 'ApiMapping', {
            api: api,
            domainName: domainName,
        });

        // Create Route53 record to point to the custom domain
        new ARecord(this, 'ApiAliasRecord', {
            zone: this.hostedZone,
            recordName: this.winnersApiDomain.replace(`.${this.hostedZone.zoneName}`, ''),
            target: RecordTarget.fromAlias(new ApiGatewayv2DomainProperties(
                domainName.regionalDomainName,
                domainName.regionalHostedZoneId
            )),
        });
    }
}
