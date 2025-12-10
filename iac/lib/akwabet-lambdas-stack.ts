import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkUtils } from './cdk-utils';
import { BaseApiStack } from './base-api-stack';
import { NetworkStack } from './network-stack';
import { BackofficeLambdasStack } from './backoffice-lambdas-stack';
import { DatabaseStack } from './database-stack';
import { StorageStack } from './storage-stack';


export class AkwabetLambdasStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const environment = CdkUtils.getEnvironment(this);
    const awsRegion = CdkUtils.getRegion(this);
    const envConfig = this.node.tryGetContext('environments')[environment];
    
    // Network Stack
    const networkStack = new NetworkStack(this, CdkUtils.formatId(this, 'NetworkStack'), {});

     // Database Stack
     const databaseStack = new DatabaseStack(this, CdkUtils.formatId(this, 'DataStorageStack'), {
      vpc: networkStack.vpc,
      securityGroup: networkStack.customSecurityGroup,
    });

    // Storage Stack
    const storageStack = new StorageStack(this, CdkUtils.formatId(this, 'StorageStack'), {});

    

    // Create shared API Gateway stacks
    const backofficeApiStack = new BaseApiStack(this, 'BackofficeApiGateway', {
      environment: environment,
      apiName: 'Backoffice',
      subBasePath: 'backoffice',
      projectName: 'Akwabet'
    });


    const backofficeSharedProps = {
      environment: environment,
      apiGateway: backofficeApiStack.api,
      vpc: networkStack.vpc,
      securityGroup: networkStack.customSecurityGroup,
      baseResource: backofficeApiStack.subBaseResource,
    };
    
    new BackofficeLambdasStack(this, `BackofficeApiStack-${environment}`, backofficeSharedProps);

    // Outputs
    this.createOutputs(storageStack);
    
  }

  private createOutputs(storageStack: StorageStack) {
    
    new cdk.CfnOutput(this, 'CloudFrontDistributionDomainName', {
      value: storageStack.distribution.distributionDomainName,
      description: 'Domain name of the CloudFront distribution',
    });

  }

  }