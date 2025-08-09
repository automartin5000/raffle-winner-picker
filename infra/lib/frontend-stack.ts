import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as cfOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3Deploy from 'aws-cdk-lib/aws-s3-deployment';
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { AppStackProps } from "../bin/interfaces";
import { EXTERNAL_SERVICES } from '../../src/lib/domain-constants';

export const INDEX_FILES_CACHE_CONTROL_SECONDS = 0;
export const IMMUATABLE_FILES_CACHE_CONTROL_DAYS = 365 * 10;

export class FrontendStack extends cdk.Stack {
  private readonly envName: string;
  private readonly fullDomain: string;
  
  constructor(scope: Construct, id: string, props: AppStackProps & { api: RestApi }) {
        super(scope, id, {
          ...props,
          stackName: `RPW-Frontend-${props.envName}`,
        });
        this.envName = props.envName;

        // Skip hosted zone lookup for local development
        const hostedZone = HostedZone.fromLookup(this, 'HostedZone', {
                domainName: props.hostedZone,
            });

        const subdomainPrefix = props.envName === 'prod' ? '' : `${props.envName}.`;
        this.fullDomain = `${subdomainPrefix}raffle-picker.${hostedZone.zoneName}`

        // Create frontend infrastructure  
        const bucket = this.createWebsiteBucket();
        
        // Only create CloudFront and Route53 for real environments
        if (hostedZone) {
            const distribution = this.createCfDistribution(hostedZone, bucket, props.api);
            this.createRoute53Records(hostedZone, distribution);
        }
        
        this.uploadWebsiteAssets(bucket);
        
        cdk.Tags.of(this).add('environment', props.envName);
        cdk.Tags.of(this).add('project', 'raffle-winner-picker');
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
                                contentSecurityPolicy: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' ${EXTERNAL_SERVICES.AUTH0_DOMAIN}; style-src 'self' 'unsafe-inline' ${EXTERNAL_SERVICES.AUTH0_DOMAIN}; img-src 'self' data: ${EXTERNAL_SERVICES.AUTH0_DOMAIN}; connect-src 'self' ${EXTERNAL_SERVICES.AUTH0_DOMAIN} ${api.url}; font-src 'self' ${EXTERNAL_SERVICES.AUTH0_DOMAIN}; frame-src ${EXTERNAL_SERVICES.AUTH0_DOMAIN}; object-src 'none'; media-src 'self'; frame-ancestors 'self'; form-action 'self' ${EXTERNAL_SERVICES.AUTH0_DOMAIN}; base-uri 'self'; manifest-src 'self'; worker-src 'self'; child-src ${EXTERNAL_SERVICES.AUTH0_DOMAIN};` 
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