import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { CdkUtils } from './cdk-utils';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { LambdaTemplate } from './lambda-template';
import { QueueEnvironmentVariables } from './network-stack';


interface BackOfficeLambdasProps {
  environment: string;
  apiGateway: apigateway.RestApi;
  baseResource: apigateway.Resource;
  queueEnvironmentVariables?: QueueEnvironmentVariables;
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;

}

export class BackOfficeLambdas extends Construct {
  constructor(scope: Construct, id: string, props: BackOfficeLambdasProps) {
    super(scope, id);

    const { environment, baseResource, vpc, securityGroup } = props;
    const BACKOFFICE = 'backoffice';

    const envConfig = this.node.tryGetContext('environments')[environment];
    const awsRegion = CdkUtils.getRegion(this);

    const secretRole = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "secretsmanager:GetSecretValue"
      ],
      resources: ['*']
    });

    const dbRole = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "rds-db:connect"
      ],
      resources: ['*']
    });

    const dynamodbRole = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
        "dynamodb:Query"
      ],
      resources: ["*"]
    });

    const cognitoIdpRole = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminUpdateUserAttributes",
        "cognito-idp:AdminDeleteUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminInitiateAuth",
        "cognito-idp:ListUsers",

      ],
      resources: ["*"]
    });


    const ssmRole = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ssm:GetParameter"
      ],
      resources: ["*"] // We might want to restrict this to specific queue ARNs in production
    });


    const s3Role = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "s3:PutObject",
      ],
      resources: ["*"]
    });

    const envVar = {
      REGION: awsRegion,
      ENVIRONMENT: environment,
      // add queues required by the lambdas or add to individual lambdas
      //...props.queueEnvironmentVariables
    }

 // ADMIN  APIs

    // Create admin Lambda
    const createAdminLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeCreateAdminLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'create-admin',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { 
        ...envVar
      },
      policies: [cognitoIdpRole, secretRole, dbRole, dynamodbRole, ssmRole]
    });

    // Admin change password Lambda
    const adminChangePassLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeAdmChangePassLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'admin-change-password',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { 
        ...envVar
      },
      policies: [cognitoIdpRole, secretRole, dbRole, ssmRole, dynamodbRole]
    });

    // Admin update password Lambda
    const adminUpdatePassLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeAdmUpdatePassLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'update-password',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { 
        ...envVar
      },
      policies: [cognitoIdpRole, secretRole, dbRole, ssmRole, dynamodbRole]
    });

    // Admin login Lambda
    const adminLoginLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeAdminLoginLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'admin-login',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { 
        ...envVar
      },
      policies: [cognitoIdpRole, secretRole, dbRole, ssmRole, dynamodbRole]
    });


    // List Admins Lambda
    const listAdminsLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeListAdminsLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'list-admins',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { 
        ...envVar
      },
      policies: [cognitoIdpRole, secretRole, dbRole, ssmRole, dynamodbRole]
    });

    const getAdminByIdLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeGetAdminByIdLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'get-admin-by-id',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { ...envVar },
      policies: [secretRole, dbRole, ssmRole, dynamodbRole, cognitoIdpRole]
    });

    const editAdminLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeEditAdminLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'edit-admin',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { ...envVar },
      policies: [secretRole, dbRole, ssmRole, dynamodbRole, cognitoIdpRole]
    });


    const verifyAdminAccountLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeVerifyAdminAccountLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'verify-account',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { 
        ...envVar
      },
      policies: [cognitoIdpRole, secretRole, dbRole, ssmRole, dynamodbRole]
    });


    const getListBettingsLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeGetListBettingsLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'get-list-bettings',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { 
        ...envVar
      },
      policies: [secretRole, dynamodbRole, ssmRole, dbRole]
    });

    const getListPaymentsLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeGetListPaymentsLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'get-list-payments',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { 
        ...envVar
      },
      policies: [secretRole, dynamodbRole, ssmRole]
    });

    const getKpisLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeGetKpisLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'get-kpis',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { 
        ...envVar
      },
      policies: [secretRole, dynamodbRole, ssmRole]
    });

    const getCourbeLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeGetCourbeLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'get-courbe',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { 
        ...envVar
      },
      policies: [secretRole, dynamodbRole, ssmRole]
    });


    const getRepartitionLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeGetRepartitionLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'get-repartition',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { 
        ...envVar
      },
      policies: [secretRole, dynamodbRole, ssmRole]
    });


    const getPaymentKpisLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeGetPaymentKpisLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'get-payment-kpis',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { 
        ...envVar
      },
      policies: [secretRole, dynamodbRole, ssmRole]
    });

    const getBettingKpisLambda = new LambdaTemplate(this, CdkUtils.formatId(this, 'BackOfficeGetBettingKpisLambdaFunction'), {
      baseName: BACKOFFICE,
      serviceName: 'get-betting-kpis',
      vpc: vpc,
      securityGroup: securityGroup,
      environments: { 
        ...envVar
      },
      policies: [secretRole, dynamodbRole, ssmRole]
    });



    


    



    const backofficeResource = baseResource.addResource('backoffice');

    const adminResource = backofficeResource.addResource('admin');
    


    // ADMIN  APIs

    adminResource.addMethod('POST', new apigateway.LambdaIntegration(createAdminLambda.lambdaFunction));
    adminResource.addResource('change-password').addMethod('POST', new apigateway.LambdaIntegration(adminChangePassLambda.lambdaFunction));
    adminResource.addResource('update-password').addMethod('PUT', new apigateway.LambdaIntegration(adminUpdatePassLambda.lambdaFunction));
    adminResource.addResource('login').addMethod('POST', new apigateway.LambdaIntegration(adminLoginLambda.lambdaFunction));
    adminResource.addResource('all').addMethod('GET', new apigateway.LambdaIntegration(listAdminsLambda.lambdaFunction));
    adminResource.addResource('verification').addResource('{email}').addMethod('GET', new apigateway.LambdaIntegration(verifyAdminAccountLambda.lambdaFunction));
    adminResource.addResource('{adminId}').addMethod('GET', new apigateway.LambdaIntegration(getAdminByIdLambda.lambdaFunction));
    adminResource.addResource('update').addResource('{adminId}').addMethod('PUT', new apigateway.LambdaIntegration(editAdminLambda.lambdaFunction));




    backofficeResource.addResource('bettings').addMethod('POST', new apigateway.LambdaIntegration(getListBettingsLambda.lambdaFunction));
    backofficeResource.addResource('payments').addMethod('POST', new apigateway.LambdaIntegration(getListPaymentsLambda.lambdaFunction));
    backofficeResource.addResource('kpis').addMethod('POST', new apigateway.LambdaIntegration(getKpisLambda.lambdaFunction));
    backofficeResource.addResource('courbe').addMethod('POST', new apigateway.LambdaIntegration(getCourbeLambda.lambdaFunction));
    backofficeResource.addResource('repartition').addMethod('POST', new apigateway.LambdaIntegration(getRepartitionLambda.lambdaFunction));
    backofficeResource.addResource('payment-kpis').addMethod('POST', new apigateway.LambdaIntegration(getPaymentKpisLambda.lambdaFunction));
    backofficeResource.addResource('betting-kpis').addMethod('POST', new apigateway.LambdaIntegration(getBettingKpisLambda.lambdaFunction));
   
    

  }
}