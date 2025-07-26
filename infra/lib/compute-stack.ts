import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as cfOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3Deploy from 'aws-cdk-lib/aws-s3-deployment';
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { RestApi, LambdaIntegration, Cors, AuthorizationType } from 'aws-cdk-lib/aws-apigateway';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { AppStackProps } from "../bin/interfaces";

export const INDEX_FILES_CACHE_CONTROL_SECONDS = 0;
export const IMMUATABLE_FILES_CACHE_CONTROL_DAYS = 365 * 10;

export class ComputeStack extends cdk.Stack {
    envName: string;
    fullDomain: string;
    apiDomain: string;
    
    constructor(scope: Construct, id: string, props: AppStackProps) {
        super(scope, id, props);
        this.envName = props.envName;
      // Skip hosted zone lookup for local development
      const hostedZone = this.envName === 'local' 
        ? undefined 
        : HostedZone.fromLookup(this, 'HostedZone', {
            domainName: props.hostedZone,
          });

      const subdomainPrefix = props.envName === 'prod' ? '' : `${props.envName}.`;
      this.fullDomain = hostedZone 
        ? `${subdomainPrefix}raffle-picker.${hostedZone.zoneName}`
        : `${subdomainPrefix}raffle-picker.localhost`;
      this.apiDomain = hostedZone 
        ? `${subdomainPrefix}api.raffle-picker.${hostedZone.zoneName}`
        : `${subdomainPrefix}api.raffle-picker.localhost`;

      // Create backend infrastructure
      const raffleTable = this.createDynamoTable();
      const api = this.createApi(raffleTable, hostedZone);

      // Create frontend infrastructure  
      const bucket = this.createWebsiteBucket();
      
      // Only create CloudFront and Route53 for real environments
      if (hostedZone) {
        const distribution = this.createCfDistribution(hostedZone, bucket, api);
        this.createRoute53Records(hostedZone, distribution);
      }
      
      this.uploadWebsiteAssets(bucket);
      
      cdk.Tags.of(this).add('environment', props.envName);
      cdk.Tags.of(this).add('project', 'raffle-winner-picker');
  }

    private createDynamoTable(): Table {
        return new Table(this, 'RaffleRunsTable', {
            tableName: `raffle-runs-${this.envName}`,
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

    private createApi(raffleTable: Table, hostedZone?: cdk.aws_route53.IHostedZone): RestApi {
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
            restApiName: `raffle-api-${this.envName}`,
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

    private createWebsiteBucket() {
        return new Bucket(this, 'WebsiteBucket', {
            autoDeleteObjects: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    }

    private uploadWebsiteAssets(destinationBucket: cdk.aws_s3.Bucket) {
        const baselineDeploy = new cdk.aws_s3_deployment.BucketDeployment(this, 'BaselineWebsiteDeployment', {
            sources: [cdk.aws_s3_deployment.Source.asset('./build')],
            destinationBucket,
            cacheControl: [
                s3Deploy.CacheControl.noCache(),
                s3Deploy.CacheControl.setPublic(),
                s3Deploy.CacheControl.maxAge(cdk.Duration.seconds(INDEX_FILES_CACHE_CONTROL_SECONDS)),
            ],
        });
        const immutableDeploy = new cdk.aws_s3_deployment.BucketDeployment(this, 'ImmutableWebsiteDeployment', {
            sources: [cdk.aws_s3_deployment.Source.asset('./build', {
                exclude: ['index.html', 'index.js'],
            })],
            destinationBucket,
            cacheControl: [
                s3Deploy.CacheControl.noCache(),
                s3Deploy.CacheControl.setPublic(),
                s3Deploy.CacheControl.maxAge(cdk.Duration.days(IMMUATABLE_FILES_CACHE_CONTROL_DAYS)),
            ],
            prune: false, // The first deployment already prunes the bucket
        });
        immutableDeploy.node.addDependency(baselineDeploy);
    }

    private createCfDistribution(hostedZone: cdk.aws_route53.IHostedZone, bucket: cdk.aws_s3.Bucket, api: RestApi): cf.Distribution {
        const rewriteFunction = new cf.Function(this, 'RewriteFunction', {
            code: cf.FunctionCode.fromFile({
                filePath: path.join(
                    __dirname,
                    'cf-functions/spa-rewrite-default-index.js')
            }),
            runtime: cf.FunctionRuntime.JS_2_0,
        });

        const certificate = new Certificate(this, 'WebsiteCertificate', {
            domainName: this.fullDomain,
            validation: CertificateValidation.fromDns(hostedZone),
        });
        const distribution = new cf.Distribution(this, 'WebsiteDistribution', {
            defaultBehavior: {
                origin: cfOrigins.S3BucketOrigin.withOriginAccessControl(bucket),
                cachePolicy: this.envName === "prod" ? cf.CachePolicy.CACHING_OPTIMIZED : cf.CachePolicy.CACHING_DISABLED,
                viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                functionAssociations: [
                    {
                        function: rewriteFunction,
                        eventType: cf.FunctionEventType.VIEWER_REQUEST,
                    },
                ],
                responseHeadersPolicy: new cf.ResponseHeadersPolicy(
                    this, 'CustomHeadersPolicy', {
                        securityHeadersBehavior: {
                            contentTypeOptions: {
                                override: true,
                            },
                            contentSecurityPolicy: {
                                override: true,
                                contentSecurityPolicy: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' *.auth0.com; style-src 'self' 'unsafe-inline' *.auth0.com; img-src 'self' data: *.auth0.com; connect-src 'self' *.auth0.com ${api.url}; font-src 'self' *.auth0.com; frame-src *.auth0.com; object-src 'none'; media-src 'self'; frame-ancestors 'self'; form-action 'self' *.auth0.com; base-uri 'self'; manifest-src 'self'; worker-src 'self'; child-src *.auth0.com;` 
                            },
                            referrerPolicy: {
                                override: true,
                                referrerPolicy: cf.HeadersReferrerPolicy.SAME_ORIGIN,
                            },
                            xssProtection: {
                                override: true,
                                protection: true,
                                modeBlock: true,
                            },
                            frameOptions: {
                                override: true,
                                frameOption: cf.HeadersFrameOption.SAMEORIGIN,
                            },
                            strictTransportSecurity: {
                                override: true,
                                accessControlMaxAge: cdk.Duration.days(365 * 10),
                                includeSubdomains: true,
                                preload: true,
                            },
                        },
                        removeHeaders: [
                            "x-amz-version-id",
                            "x-amz-server-side-encryption",
                            "x-amz-server-side-encryption-aws-kms-key-id"
                        ],
                        customHeadersBehavior: {
                            customHeaders: [
                                {
                                    header: "server",
                                    value: "True",
                                    override: true,
                                },
                            ],
                        }
                    }),
                    
            },
            domainNames: [this.fullDomain],
            certificate,
        });
        return distribution;
    }

    private createRoute53Records(hostedZone: cdk.aws_route53.IHostedZone, distribution: cdk.aws_cloudfront.Distribution) {
        const aRecord = new ARecord(this, 'WebsiteAliasRecord', {
            zone: hostedZone,
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
            recordName: this.fullDomain,
        });
        new AaaaRecord(this, 'WebsiteAliasRecordIPv6', {
            zone: hostedZone,
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
            recordName: this.fullDomain,
        });
        new cdk.CfnOutput(this, 'WebsiteUrl', {
            value: `https://${aRecord.domainName}`,
            description: `The URL of the website hosted on S3 and served via CloudFront`,
        });
    }
}