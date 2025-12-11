import { DynamoDB, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { AdminCreateUserCommandInput, CognitoIdentityProvider, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { createResponse } from '@shared/utility';
import { platform } from 'os';


const dynamoDb = new DynamoDB({ region: 'us-east-1' });

export const handler = async (event: any): Promise<any> => {
    try {
        if (!event.body) {
            return createResponse({
                statusCode: 400,
                body: JSON.stringify({ message: 'Request body is required' })
            });
        }

        const { email, password, platform, name } = event.body ? JSON.parse(event.body) : null;

        if (!email || !password || !platform || !name) {
            return createResponse({
                statusCode: 400,
                body: JSON.stringify({ message: 'email, password, platform and name are required fields' })
            });
        }

        const cognito = new CognitoIdentityProvider({ region: 'us-east-1' });

        // Check if user already exists in Cognito
        const command = new ListUsersCommand({
            UserPoolId: "us-east-1_jOx4Azwve",
            Filter: `email = "${email}"`,
        });

        const result = await cognito.send(command);
        if (result.Users?.length) {
            return createResponse({
                statusCode: 400,
                body: JSON.stringify({ message: 'User already exists' })
            });
        }

        // Create user in Cognito
        const params: AdminCreateUserCommandInput = {
            UserPoolId: 'us-east-1_jOx4Azwve',
            Username: email,
            TemporaryPassword: password,
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'email_verified', Value: 'true' },
            ],
            DesiredDeliveryMediums: ['EMAIL'],
            ForceAliasCreation: false,
            MessageAction: 'SUPPRESS',
        };

        const cognitoResult = await cognito.adminCreateUser(params);
        const idCognito = cognitoResult.User?.Username;

        if (!idCognito) {
            throw new Error('Failed to get user ID from Cognito');
        }

        //Add the admin to DynamoDB
        const param = {
            TableName: 'Admins',
            Item: {
                adminId: { S: idCognito },
                email: { S: email },
                platform: { S: platform },
                name: { S: name },
            },
        };

        await dynamoDb.putItem(param);

        return createResponse({
            statusCode: 201,
            body: JSON.stringify({
                message: 'Admin account created successfully',
                data: {
                    adminId: idCognito,
                    email: email,
                    platform: platform,
                    name: name
                }
            })
        });

    } catch (error) {
        console.error('Error creating admin account:', error);
        return createResponse({
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' })
        });
    }
};
