import { CognitoIdentityProvider, AdminGetUserCommandInput } from '@aws-sdk/client-cognito-identity-provider';
import { createResponse } from '@shared/utility';

export const handler = async (event: any): Promise<any> => {

  const email = event.pathParameters?.email;

    if (!email) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Email is required' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    const cognito = new CognitoIdentityProvider({ region: 'us-east-1' });

    const params: AdminGetUserCommandInput = {
        UserPoolId: 'us-east-1_jOx4Azwve',
        Username: email,
    };

    try {
        const response = await cognito.adminGetUser(params);
        const isConfirmed = response.UserStatus === 'CONFIRMED';

        return createResponse({
            statusCode: 200,
            body: JSON.stringify({
                email: email,
                isConfirmed: isConfirmed,
                status: response.UserStatus,
            }),
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        if (error.name === 'UserNotFoundException') {
            return createResponse({
                statusCode: 404,
                body: JSON.stringify({ message: 'User not found' }),
                headers: { 'Content-Type': 'application/json' },
            });
        }
        console.error('Error verifying admin account:', error);
        return createResponse({
            statusCode: 500,
            body: JSON.stringify({ message: 'Error verifying admin account' }),
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
