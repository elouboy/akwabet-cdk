import { DynamoDB, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { createResponse } from '@shared/utility';

const dynamoDb = new DynamoDB({ region: 'us-east-1' });

export const handler = async (event: any): Promise<any> => {
    try {
        if (!event.pathParameters || !event.pathParameters.adminId) {
            return createResponse({
                statusCode: 400,
                body: JSON.stringify({ message: 'Admin ID is required in path parameters' })
            });
        }

        const { adminId } = event.pathParameters;

        // Get the admin from the Admins table
        const adminParams = {
            TableName: 'Admins',
            Key: {
                adminId: { S: adminId }
            }
        };

        const adminResult = await dynamoDb.send(new GetItemCommand(adminParams));

        if (!adminResult.Item) {
            return createResponse({
                statusCode: 404,
                body: JSON.stringify({ message: 'Admin not found' })
            });
        }

        const name = adminResult.Item.name?.S;
        const email = adminResult.Item.email?.S;
        const platform = adminResult.Item.platform?.S;
    


        return createResponse({
            statusCode: 200,
            body: JSON.stringify({
                message: 'Admin retrieved successfully',
                data: {
                    adminId: adminId,
                    email: email,
                    platform: platform,
                    name: name,
                }
            })
        });

    } catch (error: any) {
        console.error('Error retrieving admin:', error);
        
        return createResponse({
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' })
        });
    }
};


