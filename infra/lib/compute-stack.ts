import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as cfOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3Deploy from 'aws-cdk-lib/aws-s3-deployment';
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export const INDEX_FILES_CACHE_CONTROL_SECONDS = 0;
export const IMMUATABLE_FILES_CACHE_CONTROL_DAYS = 365 * 10;

export interface ComputeStackProps extends cdk.StackProps {
    hostedZone: string;
    envName: string;
}

export class ComputeStack extends cdk.Stack {
    envName: string;
    fullDomain: string;
    constructor(scope: Construct, id: string, props: ComputeStackProps) {
        super(scope, id, props);
        this.envName = props.envName;
      const hostedZone = HostedZone.fromLookup(this, 'HostedZone', {
        domainName: props.hostedZone,
      });

      const subdomainPrefix = props.envName === 'prod' ? '' : `${props.envName}.`;
      this.fullDomain = `${subdomainPrefix}www.${hostedZone.zoneName}`;

      const bucket = this.createWebsiteBucket();
      const distribution = this.createCfDistribution(hostedZone, bucket);
      this.createRoute53Records(hostedZone, distribution);
      this.uploadWebsiteAssets(bucket);

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

    private createCfDistribution(hostedZone: cdk.aws_route53.IHostedZone, bucket: cdk.aws_s3.Bucket): cf.Distribution {
        const rewriteFunction = new cf.Function(this, 'RewriteFunction', {
            code: cf.FunctionCode.fromFile({
                filePath: path.join(
                    __dirname,
                    'cf-functions/spa-rewrite.default-index.js')
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
                                contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; font-src 'self'; frame-src 'self'; object-src 'self'; media-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; manifest-src 'self'; worker-src 'self'; prefetch-src 'self'; child-src 'self';" 
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