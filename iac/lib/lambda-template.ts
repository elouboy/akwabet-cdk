import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';
import { CdkUtils } from './cdk-utils';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export interface LambdaTemplateProps {
  baseName?: string;
  serviceName?: string;
  namePrefix?: string;
  lambdaPath?: string;
  policies?: string[] | iam.PolicyStatement[];
  handler?: string;
  environments?: { [key: string]: string };
  timeout?: cdk.Duration;
  memorySize?: number;
  bucket?: s3.Bucket;
  layerArns?: string[];
  bucketPrefix?: string[];
  bucketSuffix?: string[];
  commonCodePath?: string;
  vpc: ec2.IVpc;
  vpcSubnets?: ec2.SubnetSelection;
  logRetention?: logs.RetentionDays;
  securityGroup: ec2.ISecurityGroup;
}

export class LambdaTemplate extends Construct {
  public readonly lambdaFunction: NodejsFunction;
  public readonly lambdaRole: iam.Role;
  public readonly commonCodePath: string;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: LambdaTemplateProps) {
    super(scope, id);
    var namePrefixValue = props.namePrefix 
    if(!namePrefixValue) {
        namePrefixValue = `${props.baseName}-${props.serviceName}`  
    }
    const lambdaName = `${namePrefixValue}-lambda`;
    const roleName = `${namePrefixValue}-lambda-role`;
    // Define the common base path for all Lambda functions
    this.commonCodePath = path.join(__dirname, '..', '..', 'build');

    if (props.policies) {
        this.lambdaRole = this.createRole(roleName, props.policies);
    }
    this.lambdaFunction = this.createLambda(lambdaName, props);
    
    // Output the Lambda function ARN
    this.outputArn(lambdaName);
  }

  private createLambda(lambdaName: string, props: LambdaTemplateProps): lambda.Function {
    const layers = this.loadLayers(lambdaName, props.layerArns || []);

    const lambdaFunction = new NodejsFunction(this, lambdaName, {
      functionName: CdkUtils.formatId(this, lambdaName),
      code: lambda.Code.fromAsset(path.join(props.commonCodePath || this.commonCodePath, props.lambdaPath || `${props.baseName}/${props.serviceName}`)),
      handler: props.handler || 'index.handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: props.timeout || cdk.Duration.seconds(180),
      role: this.lambdaRole,
      environment: props.environments,
      layers: layers.length > 0 ? layers : undefined,
      vpc: props.vpc,
      memorySize: props.memorySize || 512,
      vpcSubnets: props.vpcSubnets || { subnetType: ec2.SubnetType.PUBLIC },
      allowPublicSubnet: true,
      securityGroups: [props.securityGroup],
      logRetention: props.logRetention || logs.RetentionDays.FIVE_DAYS, 
    });

    

    if (props.bucket) {
      if (props.bucketPrefix && props.bucketPrefix.length > 0) {
        for (const prefix of props.bucketPrefix) {
          lambdaFunction.addEventSource(new S3EventSource(props.bucket, {
            events: [s3.EventType.OBJECT_CREATED_PUT, s3.EventType.OBJECT_CREATED_COPY],
            filters: [{ prefix }]
          }));
        }
      }
      if (props.bucketSuffix && props.bucketSuffix.length > 0) {
        for (const suffix of props.bucketSuffix) {
          lambdaFunction.addEventSource(new S3EventSource(props.bucket, {
            events: [s3.EventType.OBJECT_CREATED_PUT, s3.EventType.OBJECT_CREATED_COPY],
            filters: [{ suffix }]
          }));
        }
      }
    }

    return lambdaFunction;
  }

  private createRole(roleName: string, policies: string[] | iam.PolicyStatement[]): iam.Role {
    const role = new iam.Role(this, roleName, {
      roleName: roleName,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'));
    
    for (const policy of policies) {
      if (policy instanceof iam.PolicyStatement) {
        role.addToPolicy(policy);
      } else {
        role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(policy));
      }
    }

    return role;
  }

  private loadLayers(lambdaName: string, layerArns: string[]): lambda.ILayerVersion[] {
    return layerArns.map((arn, index) => 
      lambda.LayerVersion.fromLayerVersionArn(this, CdkUtils.formatId(this, `${lambdaName}-${index + 1}-layer`), arn)
    );
  }

  private outputArn(lambdaName: string) {
    new cdk.CfnOutput(this, CdkUtils.formatId(this, `${lambdaName}-functionArn`), {
        value: this.lambdaFunction.functionArn,
        description: `The ARN of the ${lambdaName} Lambda function`,
    });
  }
}