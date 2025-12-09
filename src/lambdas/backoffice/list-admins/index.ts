import { DynamoDB, ScanCommand } from '@aws-sdk/client-dynamodb';
import { createResponse } from '@shared/utility';

const dynamoDb = new DynamoDB({ region: 'us-east-1' });

export const handler = async (event: any): Promise<any> => {
    try {
        const params = {
            TableName: 'Admins'
        };

        const result = await dynamoDb.send(new ScanCommand(params));

        return createResponse({
            statusCode: 200,
            body: JSON.stringify({
                message: 'Admins retrieved successfully',
                data: result.Items?.map(item => ({
                    adminId: item.adminId?.S,
                    email: item.email?.S,
                    name: item.name?.S,
                    platform: item.platform?.S,
                    createdAt: item.createdAt?.S
                })) || []
            })
        });
    } catch (error) {
        console.error('Error listing admins:', error);
        return createResponse({
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' })
        });
    }
};
