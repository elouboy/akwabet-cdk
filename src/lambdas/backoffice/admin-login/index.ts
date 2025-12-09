import { CognitoIdentityProvider, AdminInitiateAuthCommandInput } from '@aws-sdk/client-cognito-identity-provider';
import { JwtPayload, jwtDecode } from "jwt-decode";
import { createResponse } from '@shared/utility';
import { DynamoDB, GetItemCommand, AttributeValue } from '@aws-sdk/client-dynamodb';
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

        const { email, password } = event.body ? JSON.parse(event.body) : null;
        const userPoolId = "us-east-1_jOx4Azwve";
        const clientId = "46uklhoqqdab6t6f9a3b7q6ke9";

        if (!email || !password) {
            return createResponse({
                statusCode: 400,
                body: JSON.stringify({ message: 'email and password are required fields' })
            });
        }

        const cognito = new CognitoIdentityProvider({ region: "us-east-1" });

        const params: AdminInitiateAuthCommandInput = {
            AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
            UserPoolId: userPoolId,
            ClientId: clientId,
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password
            }
        };

        const response = await cognito.adminInitiateAuth(params);
        const idToken = response.AuthenticationResult?.IdToken;
        
        // Decode the ID token to get the username
        let username = email;
        if (idToken) {
            const decodedToken = jwtDecode<JwtPayload & { 'cognito:username'?: string }>(idToken);
            username = decodedToken['cognito:username'] || email;
        }

        // Get the admin from the Admins table
        const param = {
            TableName: 'Admins',
            Key: {
                adminId: { S: username }
            }
        };
        const result = await dynamoDb.getItem(param);

        if (!result.Item) {
            return createResponse({
                statusCode: 401,
                body: JSON.stringify({ message: 'Admin not found' })
            });
        }

        const name = result.Item.name?.S;
        const platform = result.Item.platform?.S;

        return createResponse({
            statusCode: 200,
            body: JSON.stringify({
                message: 'Login successful',
                data: {
                    id: username,
                    token: idToken,
                    platform: platform,
                    name: name
                }
            })
        });
    } catch (error) {
        console.error('Login error:', error);
        return createResponse({
            statusCode: 401,
            body: JSON.stringify({ message: 'Login failed' })
        });
    }
};
