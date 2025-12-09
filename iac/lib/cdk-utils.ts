import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class CdkUtils {

    public static AKWABET : string = 'akwabet';

    public static getEnvironment(scope: Construct): string {
        return CdkUtils.getVariableFromScope(scope, 'environment', 'dev').toLowerCase();
    }

    private static getVariableFromScope(scope: Construct, variablename: string, defaultValue: string): string {
        // Traverse up the construct tree to find the Stack
        let current: Construct | undefined = scope;
        while (current && !(current instanceof cdk.Stack)) {
            current = current.node.scope as Construct;
        }

        // If we found a Stack, try to get the environment from props
        if (current && current instanceof cdk.Stack) {
            const variableValue = current.node.tryGetContext(variablename);
            if (variableValue) {
                return ((String)(variableValue));
            }
        }
        // If not found, return a default value
        return defaultValue;
    }

    public static formatId(scope: Construct, id: string): string {
        const environment = this.getEnvironment(scope);
        return `${id}-${environment}`.substring(0, 52);
    }

    // Create SSM Parameters
    public static createSsmParameter(scope: Construct, name: string, value: string) : ssm.StringParameter {
        return new ssm.StringParameter(scope, `SSMParam${name}`, {
          parameterName: `/${CdkUtils.AKWABET}/${this.getEnvironment(scope)}/${name}`,
          stringValue: value,
        });
    }

    public static getRegion(scope: Construct): string {
        return CdkUtils.getVariableFromScope(scope, 'aws_region', '').toLowerCase();
    }
}