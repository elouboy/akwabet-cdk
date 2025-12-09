import { CognitoIdentityProvider, AdminSetUserPasswordCommandInput, AdminGetUserCommandInput } from '@aws-sdk/client-cognito-identity-provider';
import { createResponse } from '@shared/utility';

const cognito = new CognitoIdentityProvider({ region: 'us-east-1' });

export const handler = async (event: any): Promise<any> => {
    console.log('Event: ', event);

    try {
        const { email, newPassword } = event.body ? JSON.parse(event.body) : null;

        if (!email || !newPassword) {
            return createResponse({
                statusCode: 400,
                body: JSON.stringify({ message: 'Email and new password are required' }),
            });
        }

        // Get the user's current status
        const getUserParams: AdminGetUserCommandInput = {
            UserPoolId: 'us-east-1_jOx4Azwve',
            Username: email,
        };
        const userInfo = await cognito.adminGetUser(getUserParams);
        const userStatus = userInfo.UserStatus;

        // Check if the user exists and is in a valid status
        if (!userStatus || userStatus !== 'CONFIRMED') {
            return createResponse({
                statusCode: 400,
                body: JSON.stringify({ message: 'User not found or not in a confirmed status' }),
            });
        }

        // Set the new password
        const params: AdminSetUserPasswordCommandInput = {
            Password: newPassword,
            Permanent: true,
            Username: email,
            UserPoolId: 'us-east-1_jOx4Azwve',
        };

        await cognito.adminSetUserPassword(params);

        return createResponse({
            statusCode: 200,
            body: JSON.stringify({ message: 'Password has been successfully updated' }),
        });
    } catch (error) {
        console.error('Error in password update process:', error);
        return createResponse({
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' }),
        });
    }
};