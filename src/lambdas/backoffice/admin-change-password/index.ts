import { CognitoIdentityProvider, AdminSetUserPasswordCommandInput, AdminGetUserCommandInput, AdminUpdateUserAttributesCommandInput } from '@aws-sdk/client-cognito-identity-provider';
import { createResponse } from '@shared/utility';
const cognito = new CognitoIdentityProvider({ region: 'us-east-1' });
export const handler: any = async (event: any) => {
  try {
    const { email, newPassword } = event.body ? JSON.parse(event.body) : null;
    if (!email || !newPassword) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Email and new password are required' }),
      };
    }
    // Get the user's current status
    const getUserParams: AdminGetUserCommandInput = {
      UserPoolId: 'us-east-1_jOx4Azwve',
      Username: email,
    };
    const userInfo = await cognito.adminGetUser(getUserParams);
    const userStatus = userInfo.UserStatus;
    // Check if the user has FORCE_CHANGE_PASSWORD status
    if (userStatus !== 'FORCE_CHANGE_PASSWORD') {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'User is not in FORCE_CHANGE_PASSWORD status' }),
      };
    }
    // Change password parameters
    const params: AdminSetUserPasswordCommandInput = {
      Password: newPassword,
      Permanent: true,
      Username: email,
      UserPoolId: 'us-east-1_jOx4Azwve',
    };
    // Change the password
    await cognito.adminSetUserPassword(params);
    // Update user attributes to set email_verified to true
    const updateParams: AdminUpdateUserAttributesCommandInput = {
      UserPoolId: 'us-east-1_7M1Okv9XY',
      Username: email,
      UserAttributes: [
        {
          Name: 'email_verified',
          Value: 'true',
        },
      ],
    };
    await cognito.adminUpdateUserAttributes(updateParams);
    return createResponse({
      statusCode: 200,
      body: JSON.stringify({ message: 'Password changed successfully' }),
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return createResponse({
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    });
  }
};



