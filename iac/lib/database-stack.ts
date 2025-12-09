// File: lib/database-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { CdkUtils } from './cdk-utils';

interface DatabaseStackProps extends cdk.NestedStackProps {
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
}

interface DatabaseProps {
  dbName?: string;
  dbUsername?: string;
  dbPort?: string;
  dbProxy?: rds.DatabaseProxy;
  multiAz?: boolean;
  backupRetention?: number;
  instanceType?: ec2.InstanceType;
  dbCredentials?: secretsmanager.Secret;
  allocatedStorage?: number;
}

export class DatabaseStack extends cdk.NestedStack {
  public readonly akwabetServiceDB: DatabaseProps;
 

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const environment = CdkUtils.getEnvironment(this);
    const envConfig = this.node.tryGetContext('environments')[environment];
    const awsRegion = CdkUtils.getRegion(this);
    const isDevEnv = awsRegion == 'dev'
    
    this.akwabetServiceDB = this.intiliazeDb(envConfig.db.akwabet_service);

    // Security group for RDS
    const rdsSecurityGroup = new ec2.SecurityGroup(this, CdkUtils.formatId(this, 'AkwabetRDSSecurityGroup'), {
      vpc: props.vpc,
      description: 'Security group for RDS instance',
      allowAllOutbound: false,
    });

    rdsSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(parseInt(this.akwabetServiceDB.dbPort!)),
      'Allow PostgreSQL traffic from within VPC'
    );

    /********************************************/
    /* players service DB start */
    /*******************************************/

    // Secret for RDS credentials
    this.akwabetServiceDB.dbCredentials = new secretsmanager.Secret(this, CdkUtils.formatId(this, 'AkwabetServiceRDSCredentials'), {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: this.akwabetServiceDB.dbUsername }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    // RDS instance
    // TODO: For Prod - aurora postgresql the meduim one
    const  akwabetServiceRdsInstance = new rds.DatabaseInstance(this, CdkUtils.formatId(this, 'AkwabetServiceRDSInstance'), {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_13 }),
      instanceType: this.akwabetServiceDB.instanceType,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [rdsSecurityGroup],
      multiAz: this.akwabetServiceDB.multiAz,
      databaseName: this.akwabetServiceDB.dbName,
      credentials: rds.Credentials.fromSecret(this.akwabetServiceDB.dbCredentials),
      backupRetention: cdk.Duration.days(this.akwabetServiceDB.backupRetention!),
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      publiclyAccessible: false,
      allocatedStorage: this.akwabetServiceDB.allocatedStorage!
    });

    // RDS Proxy
    this.akwabetServiceDB.dbProxy = new rds.DatabaseProxy(this, 'AkwabetServiceRDSProxy', {
      proxyTarget: rds.ProxyTarget.fromInstance(akwabetServiceRdsInstance),
      secrets: [this.akwabetServiceDB.dbCredentials],
      vpc: props.vpc,
      securityGroups: [rdsSecurityGroup],
      requireTLS: true,
      idleClientTimeout: cdk.Duration.seconds(1800),
      maxConnectionsPercent: 100,
      debugLogging: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Allow the custom security group to connect to the RDS Proxy
    this.akwabetServiceDB.dbProxy.connections.allowFrom(props.securityGroup, ec2.Port.tcp(5432));

    // Create SSM parameters
    CdkUtils.createSsmParameter(this, 'akwabet-service/rds-proxy-endpoint', this.akwabetServiceDB.dbProxy.endpoint);
    CdkUtils.createSsmParameter(this, 'akwabet-service/rds-secret-arn', this.akwabetServiceDB.dbCredentials.secretArn);
    CdkUtils.createSsmParameter(this, 'akwabet-service/rds-secret-name', this.akwabetServiceDB.dbCredentials.secretName);
    CdkUtils.createSsmParameter(this, 'akwabet-service/rds-db-name', this.akwabetServiceDB.dbName!);
    CdkUtils.createSsmParameter(this, 'akwabet-service/rds-db-port', this.akwabetServiceDB.dbPort!);


  






    // SSM Port Forwarding Instance
    const ec2Instance = this.createPortForwardingInstance(props.vpc, props.securityGroup);
    this.akwabetServiceDB.dbProxy.connections.allowFrom(ec2Instance, cdk.aws_ec2.Port.tcp(5432));


    new cdk.CfnOutput(this, 'SSMPortForwardingRoleArn', {
      value: ec2Instance.role.roleArn,
      description: 'IAM Role ARN for SSM Port Forwarding',
    });

  }

  private intiliazeDb(config: any) {
    let dbProps: DatabaseProps = {}
    dbProps.dbName = config.dbName;
    dbProps.dbUsername = config.dbUsername;
    dbProps.dbPort = config.dbPort;
    dbProps.multiAz = config.multiAz;
    dbProps.backupRetention = config.backupRetention;
    dbProps.allocatedStorage = config.allocatedStorage;
    const instanceClass = ec2.InstanceClass[config.dbInstanceClass?.toUpperCase() as keyof typeof ec2.InstanceClass];
    const instanceSize = ec2.InstanceSize[config.dbInstanceSize?.toUpperCase() as keyof typeof ec2.InstanceSize];
    if (!instanceClass || !instanceSize) {
      throw new Error('Invalid instance class or size provided.');
    }
    dbProps.instanceType = ec2.InstanceType.of(instanceClass, instanceSize);
    return dbProps;
  }

  private createPortForwardingInstance(vpc: cdk.aws_ec2.Vpc, securityGroup: cdk.aws_ec2.SecurityGroup): cdk.aws_ec2.Instance {
    const ssmPortForwardingRole = new cdk.aws_iam.Role(this, CdkUtils.formatId(this, 'SSMPortForwardingRole'), {
      assumedBy: new cdk.aws_iam.CompositePrincipal(
        new cdk.aws_iam.ServicePrincipal('ec2.amazonaws.com'),
        new cdk.aws_iam.ServicePrincipal('ssm.amazonaws.com')
      ),
      managedPolicies: [
        cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    this.addSsmPolicies(ssmPortForwardingRole);

    const ec2Instance = new cdk.aws_ec2.Instance(this, CdkUtils.formatId(this, 'PortForwardingInstance'), {
      vpc,
      vpcSubnets: { subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: cdk.aws_ec2.InstanceType.of(cdk.aws_ec2.InstanceClass.T3, cdk.aws_ec2.InstanceSize.NANO),
      machineImage: cdk.aws_ec2.MachineImage.latestAmazonLinux2(),
      securityGroup: securityGroup,
      role: ssmPortForwardingRole,
    });

    ec2Instance.role.addManagedPolicy(cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    CdkUtils.createSsmParameter(this, 'port-forwarding-instanceid', ec2Instance.instanceId);

    return ec2Instance;
  }

  private addSsmPolicies(role: cdk.aws_iam.Role) {
    role.addToPolicy(new cdk.aws_iam.PolicyStatement({
      actions: [
        'ssm:StartSession',
        'ssm:TerminateSession',
        'ssm:ResumeSession',
        'ssm:DescribeSessions',
        'ssm:GetConnectionStatus'
      ],
      resources: [
        `arn:aws:ec2:${this.region}:${this.account}:instance/*`,
        `arn:aws:ssm:${this.region}:${this.account}:document/AWS-StartPortForwardingSession`,
        `arn:aws:ssm:${this.region}::document/AWS-StartPortForwardingSession`,
      ],
    }));

    role.addToPolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['rds-db:connect'],
      resources: [`arn:aws:rds-db:${this.region}:${this.account}:dbuser:*/*`],
    }));

    role.addToPolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['rds:DescribeDBProxies'],
      resources: ['*'],
    }));

    role.addToPolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['s3:*'],
      resources: ['*'],
    }));
  }
}