import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { CdkUtils } from './cdk-utils';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface QueueEnvironmentVariables {
  [key: string]: string;
}

export class NetworkStack extends cdk.NestedStack {
  public readonly vpc: ec2.Vpc;
  public readonly customSecurityGroup: ec2.SecurityGroup;
  public readonly cluster: ecs.Cluster;
  public readonly queueEnvironmentVariables: QueueEnvironmentVariables = {};


  

  constructor(scope: Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);

    const environment = CdkUtils.getEnvironment(this);
    const awsRegion = CdkUtils.getRegion(this);
    
    // Creating VPC
    this.vpc = new ec2.Vpc(this, 'AkwabetVPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        { 
          cidrMask: 24, 
          name: 'Public', 
          subnetType: ec2.SubnetType.PUBLIC 
        },
      ],
      restrictDefaultSecurityGroup: false,
    });

    (this.vpc.node.defaultChild as cdk.CfnResource).applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    // Creating VPC Flow Logs
    const flowLogGroup = new logs.LogGroup(this, 'VPCFlowLogsGroup', {
      logGroupName: `/aws/vpc/flowlogs/${this.vpc.vpcId}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Creating a role for VPC Flow Logs
    const flowLogRole = new iam.Role(this, 'VPCFlowLogsRole', {
    assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
    });

    new ec2.FlowLog(this, 'VPCFlowLogs', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
    });

    // Creating custom security group
    this.customSecurityGroup = new ec2.SecurityGroup(this, 'CustomSecurityGroup-Allow-VPC-Traffic', {
      vpc: this.vpc,
      description: 'Custom security group allowing ingress within VPC and all egress',
      allowAllOutbound: true,
    });

    this.customSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.allTraffic(),
      'Allow all traffic within VPC'
    );

    // Adding VPC Endpoints
    this.addVpcEndpoints();

    // Creating SQS Queues
   /* this.transactionDebitRequestQueue = this.createQueueWithDLQ('TransactionDebitRequest', 'transaction-debit-request', false);
    this.walletUpdateRequestQueue = this.createQueueWithDLQ('WalletUpdateRequest', 'wallet-update-request', false);
    this.transactionStatusUpdateQueue = this.createQueueWithDLQ('TransactionStatusUpdate', 'transaction-status-update-queue', false);
    this.notificationSendQueue = this.createQueueWithDLQ('NotificationSend', 'notification-send-queue', false);

    this.debitRequestTrxWalletQueue = this.createQueueWithDLQ('DebitRequestTrxWalletQueue', 'debit-request-trx-wallet', false);;
    this.debitResponseTrxWalletQueue = this.createQueueWithDLQ('DebitResponseTrxWalletQueue', 'debit-response-trx-wallet', false);;
    this.creditRequestTrxWalletQueue = this.createQueueWithDLQ('CreditRequestTrxWalletQueue', 'credit-request-trx-wallet', false);;
    this.creditResponseTrxWalletQueue = this.createQueueWithDLQ('CreditResponseTrxWalletQueue', 'credit-response-trx-wallet', false);;
    this.mmDebitRequestTrxOpQueue = this.createQueueWithDLQ('MmDebitRequestTrxOpQueue', 'mm-debit-request-trx-op', false);;
    this.mmResponseTrxOpQueue = this.createQueueWithDLQ('MmResponseTrxOpQueue', 'mm-response-trx-op', false);;
    this.balanceUpdateTrxWwalletQueue = this.createQueueWithDLQ('BalanceUpdateTrxWwalletQueue', 'balance-update-trx-wallet', false);;
    this.serviceExecRequestTrxLebedooQueue = this.createQueueWithDLQ('ServiceExecRequestTrxLebedooQueue', 'service-exec-request-trx-lebedoo', false);;
    this.refundRequestTrxWalletQueue = this.createQueueWithDLQ('RefundRequestTrxWalletQueue', 'refund-request-trx-wallet', false);;
    this.refundResponseTrxWalletQueue = this.createQueueWithDLQ('RefundResponseTrxWalletQueue', 'refund-response-trx-wallet', false);;
    this.paymentValidationOpTrxQueue = this.createQueueWithDLQ('PaymentValidationOpTrxQueue', 'payment-validation-op-trx', false);;
    this.plafondRequestCheckerQueue = this.createQueueWithDLQ('PlafonRequestCheckerQueue', 'plafond-request-checker', false);;
    this.serviceExterneQueue = this.createQueueWithDLQ('ServiceExterneQueue', 'service-externe', false);;
    this.unsubscribeUserQueue = this.createQueueWithDLQ('UnsubscribeUserQueue', 'unsubscribe-user', false);;
    this.mercureQueue = this.createQueueWithDLQ('MercureQueue', 'mercure', false);;*/

    // Create or get existing ECS cluster
    /*this.cluster = new ecs.Cluster(this, CdkUtils.formatId(this, 'AkwabetServers'), {
      vpc: this.vpc,
      clusterName: CdkUtils.formatId(this, 'AkwabetServers'),
      containerInsights: true,
    });*/

    // Export VPC details
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `akwabet-${environment}-vpc-id`,
    });

    new cdk.CfnOutput(this, 'VpcAZs', {
      value: this.vpc.availabilityZones.join(','),
      exportName: `akwabet-${environment}-vpc-azs`,
    });
    
    new cdk.CfnOutput(this, 'PrivateSubnets', {
      value: this.vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
      exportName: `akwabet-${environment}-vpc-private-subnets`,
    });
    
    new cdk.CfnOutput(this, 'PublicSubnets', {
      value: this.vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
      exportName: `akwabet-${environment}-vpc-public-subnets`,
    });

    // Export Security Group details
    new cdk.CfnOutput(this, 'SecurityGroupId', {
      value: this.customSecurityGroup.securityGroupId,
      description: 'Custom Security Group ID',
      exportName: `akwabet-${environment}-security-group-id`,
    });

    // Export ECS Cluster details
    /*new cdk.CfnOutput(this, 'EcsClusterArn', {
      value: this.cluster.clusterArn,
      description: 'ECS Cluster ARN',
      exportName: `akwabet-${environment}-ecs-cluster-arn`,
    });*/

    /*new cdk.CfnOutput(this, 'EcsClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: `akwabet-${environment}-ecs-cluster-name`,
    });*/

    // Store infrastructure details in SSM Parameter Store for easy lookup
    CdkUtils.createSsmParameter(this, 'vpc-id', this.vpc.vpcId);
    CdkUtils.createSsmParameter(this, 'security-group-id', this.customSecurityGroup.securityGroupId);
    /*CdkUtils.createSsmParameter(this, 'ecs-cluster-name', this.cluster.clusterName);*/
  }

  private addVpcEndpoints() {
    this.vpc.addInterfaceEndpoint('SSMEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
      privateDnsEnabled: true,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    this.vpc.addInterfaceEndpoint('EC2MessagesEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
      privateDnsEnabled: true,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    this.vpc.addInterfaceEndpoint('SSMMessagesEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
      privateDnsEnabled: true,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      privateDnsEnabled: true,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    this.vpc.addInterfaceEndpoint('SQSEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SQS,
      privateDnsEnabled: true,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });
  }

 /* private createQueueWithDLQ(name: string, queueName: string, isFifo: boolean): sqs.Queue {
    // Create DLQ
    let dlqServiceName = `${name.toLowerCase()}-dlq`;
    if(isFifo) {
      dlqServiceName = dlqServiceName + '.fifo'
    }
    const dlq = new sqs.Queue(this, `${name}DLQ`, {
      queueName: dlqServiceName,
      retentionPeriod: cdk.Duration.days(14), 
      encryption: sqs.QueueEncryption.SQS_MANAGED
    });
    let queueServiceName = `${queueName.toLowerCase()}-queue`;
    if(isFifo) {
      queueServiceName = queueServiceName + '.fifo'
    }
    
    // Create main queue
    const sqsQueue = new sqs.Queue(this, CdkUtils.formatId(this, `${name}Queue`), {
      queueName: `${queueServiceName}`,
      visibilityTimeout: cdk.Duration.seconds(30), 
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3, // Move to DLQ after 3 failed processing attempts
      },
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // Create SSM Parameter for the queue URL
    const parameterName = `${name.toLowerCase()}-queue`;
    CdkUtils.createSsmParameter(this, parameterName, sqsQueue.queueUrl);
    
    // Create SSM Parameter for the DLQ URL
    const dlqParameterName = `${name.toLowerCase()}-dlq`;
    CdkUtils.createSsmParameter(this, dlqParameterName, dlq.queueUrl);
    
    // Store environment variable mapping
    const envVarName = `QUEUE_URL_${name.toUpperCase().replace(/-/g, '_')}`;
    this.queueEnvironmentVariables[envVarName] = sqsQueue.queueUrl;

    return sqsQueue;
  }*/
}