import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { CdkUtils } from './cdk-utils';
import { BackOfficeLambdas } from './backoffice-lambdas';

interface BackofficeLambdasStackProps extends cdk.NestedStackProps {
  environment: string;
  vpc: ec2.IVpc;
  securityGroup: ec2.SecurityGroup;
  apiGateway: apigateway.RestApi;
  baseResource: apigateway.Resource;
  queueEnvironmentVariables?: {[key: string]: string};
}

export class BackofficeLambdasStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: BackofficeLambdasStackProps) {
    super(scope, id, props);

    new BackOfficeLambdas(this, CdkUtils.formatId(this, 'BackofficeLambdas'), {
      environment: props.environment,
      apiGateway: props.apiGateway,
      baseResource: props.baseResource,
      vpc: props.vpc,
      securityGroup: props.securityGroup,
      queueEnvironmentVariables: props.queueEnvironmentVariables!
    });
}
}