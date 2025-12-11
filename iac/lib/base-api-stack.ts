import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { CdkUtils } from './cdk-utils';

interface BaseApiStackProps extends cdk.NestedStackProps {
  environment: string;
  apiName: string;  // Name of the API (e.g., 'backoffice', 'user')
  basePath?: string; // Base path for the API (e.g., 'fantasycore')
  subBasePath: string; // Sub Base path for the API (e.g., 'backoffice', 'user')
}

export class BaseApiStack extends cdk.NestedStack {
  public readonly api: apigateway.RestApi;
  public readonly baseResource: apigateway.Resource;
  public readonly subBaseResource: apigateway.Resource;

  constructor(scope: Construct, id: string, props: BaseApiStackProps) {
    super(scope, id, props);

    const environment = CdkUtils.getEnvironment(this);
    const basePath = props.basePath || CdkUtils.AKWABET;

    this.api = new apigateway.RestApi(this, CdkUtils.formatId(this, `Akwabet${props.apiName}Api`), {
      restApiName: `akwabet-${props.apiName.toLowerCase()}-api-${environment}`,
      description: `API Gateway for akwabet ${props.apiName.toLowerCase()} services`,
      deployOptions: {
        stageName: environment
      },
      binaryMediaTypes: [
        'image/png',
        'image/jpeg',
        'multipart/form-data',
        'application/pdf'
      ],
    });

    // Create the base resource with the provided path
    this.baseResource = this.api.root.addResource(basePath, {});
    this.subBaseResource = this.baseResource.addResource(props.subBasePath, {});
    
    const proxyResource = this.api.root.addProxy({
      anyMethod: false,
    });

    // Add OPTIONS method to the proxy resource
    proxyResource.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Methods': "'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,Accept,Access-Control-Allow-Origin'",
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          },
          responseTemplates: {
            'application/json': ''
          }
        }
      ],
      passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Origin': true,
          }
        }
      ]
    });

    this.addGatewayResponses();
  }

  private addGatewayResponses() {
    const responseParameters = {
      'gatewayresponse.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,Origin,X-Requested-With,Accept'",
      'gatewayresponse.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS,PUT,PATCH,DELETE'",
      'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
    };

    const responseTemplate = '{"message":$context.error.messageString}';

    this.api.addGatewayResponse('UNAUTHORIZED', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      statusCode: '401',
      responseHeaders: responseParameters,
      templates: { 'application/json': responseTemplate },
    });

    this.api.addGatewayResponse('ACCESS_DENIED', {
      type: apigateway.ResponseType.ACCESS_DENIED,
      statusCode: '401',
      responseHeaders: responseParameters,
      templates: { 'application/json': responseTemplate },
    });

    this.api.addGatewayResponse('MISSING_AUTHENTICATION_TOKEN', {
      type: apigateway.ResponseType.MISSING_AUTHENTICATION_TOKEN,
      statusCode: '401',
      responseHeaders: responseParameters,
      templates: { 'application/json': responseTemplate },
    });

    this.api.addGatewayResponse('EXPIRED_TOKEN', {
      type: apigateway.ResponseType.EXPIRED_TOKEN,
      statusCode: '403',
      responseHeaders: responseParameters,
      templates: { 'application/json': responseTemplate },
    });
  }
}