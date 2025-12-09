// File: lib/storage-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { CdkUtils } from './cdk-utils';

export class StorageStack extends cdk.NestedStack {
  public readonly staticContentBucket: s3.Bucket;
  public readonly dbMigrationBucket: s3.Bucket;
  public readonly tinyTuneAudiosBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);

    const environment = CdkUtils.getEnvironment(this);

    // Create S3 bucket for static content
    this.staticContentBucket = new s3.Bucket(this, CdkUtils.formatId(this, 'StaticContentBucket'), {
      bucketName: `akwabet-static-content-bckt-res-${environment.toLowerCase()}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      accessControl: s3.BucketAccessControl.PRIVATE,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ["http://localhost:3030"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ]
    });

    // Create S3 bucket for DB migration
    this.dbMigrationBucket = new s3.Bucket(this, CdkUtils.formatId(this, 'DBMigrationBucket'), {
      bucketName: `akwabet-db-migration-bkt-res-${environment.toLowerCase()}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: false,
      versioned: false,
      accessControl: s3.BucketAccessControl.PRIVATE,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ["http://localhost:3030"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ]
    });


    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, CdkUtils.formatId(this, 'CloudFrontOAI'), {
      comment: `OAI for ${id}`
    });

    // Grant read access to CloudFront
    this.staticContentBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [this.staticContentBucket.arnForObjects('*')],
      principals: [new iam.CanonicalUserPrincipal(originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
    }));

    // CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, CdkUtils.formatId(this, 'StaticContentDistribution'), {
        defaultBehavior: {
          origin: new origins.S3StaticWebsiteOrigin(this.staticContentBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 404,
            responsePagePath: '/404.html',
          },
        ],
      });
  

    // Outputs
    new cdk.CfnOutput(this, 'StaticContentBucketName', {
      value: this.staticContentBucket.bucketName,
      description: 'Name of the S3 bucket for static content',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'Domain name of the CloudFront distribution',
    });
  }
}