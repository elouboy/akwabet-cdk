import { DynamoDB, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
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

        if (!event.body) {
            return createResponse({
                statusCode: 400,
                body: JSON.stringify({ message: 'Request body is required' })
            });
        }

        const { adminId } = event.pathParameters;
        const { name } = event.body ? JSON.parse(event.body) : null;

        if (!name) {
            return createResponse({
                statusCode: 400,
                body: JSON.stringify({ message: 'Name field is required' })
            });
        }

        // Update only the name field in the Admins table
        const updateParams = {
            TableName: 'Admins',
            Key: {
                adminId: { S: adminId }
            },
            UpdateExpression: 'SET #name = :name, updatedAt = :updatedAt',
            ExpressionAttributeNames: {
                '#name': 'name'
            },
            ExpressionAttributeValues: {
                ':name': { S: name },
                ':updatedAt': { S: new Date().toISOString() }
            },
            ReturnValues: 'ALL_NEW' as const
        };

        const result = await dynamoDb.send(new UpdateItemCommand(updateParams));

        if (!result.Attributes) {
            return createResponse({
                statusCode: 404,
                body: JSON.stringify({ message: 'Admin not found' })
            });
        }

        return createResponse({
            statusCode: 200,
            body: JSON.stringify({
                message: 'Admin name updated successfully',
                data: {
                    adminId: result.Attributes.adminId?.S,
                    email: result.Attributes.email?.S,
                    platform: result.Attributes.platform?.S,
                    name: result.Attributes.name?.S,
                    updatedAt: result.Attributes.updatedAt?.S
                }
            })
        });

    } catch (error: any) {
        console.error('Error updating admin name:', error);
        
        return createResponse({
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' })
        });
    }
};
