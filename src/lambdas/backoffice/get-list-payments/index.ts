import { createResponse } from '../../../shared/utility';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

export const handler = async (event: any): Promise<any> => {
    console.log('Event: ', event);
    
    const dynamodb = new DynamoDB({ region: "us-east-1" });
    
    const { month, type, page = '1', lastEvaluatedKey } = event.body ? JSON.parse(event.body) : {};
    
    if (!month) {
        return createResponse({
            statusCode: 400,
            body: { message: 'Month parameter is required' }
        });
    }
    
    try {
        const pageNumber = parseInt(page, 10) || 1;
        const limit = 10;
        
        // Helper function to convert DynamoDB item to plain object
        const convertItem = (item: any) => {
            const convertedItem: any = {};
            Object.keys(item).forEach((key) => {
                if (item[key].S) convertedItem[key] = item[key].S;
                else if (item[key].N) convertedItem[key] = parseFloat(item[key].N);
                else if (item[key].BOOL !== undefined) convertedItem[key] = item[key].BOOL;
                else convertedItem[key] = item[key];
            });
            return convertedItem;
        };

        const queryParams: any = {
            TableName: 'Payments',
            IndexName: 'GSI_MonthType',
            ExpressionAttributeNames: {
                '#month': 'month'
            },
            ExpressionAttributeValues: {
                ':month': { S: month }
            },
            Limit: limit
        };

        // If type is provided, filter by type (depot or retrait)
        if (type) {
            queryParams.KeyConditionExpression = '#month = :month AND #type = :type';
            queryParams.ExpressionAttributeNames['#type'] = 'type';
            queryParams.ExpressionAttributeValues[':type'] = { S: type };
        } else {
            queryParams.KeyConditionExpression = '#month = :month';
        }

        // Handle pagination token if provided
        if (lastEvaluatedKey) {
            queryParams.ExclusiveStartKey = lastEvaluatedKey;
        }

        const queryResult = await dynamodb.query(queryParams);

        // Convert DynamoDB items to plain objects
        const items = queryResult.Items 
            ? queryResult.Items.map((item) => convertItem(item))
            : [];

        return createResponse({
            statusCode: 200,
            body: {
                items,
                currentPage: pageNumber,
                pageSize: limit,
                hasMore: !!queryResult.LastEvaluatedKey,
                lastEvaluatedKey: queryResult.LastEvaluatedKey,
                totalItems: items.length
            }
        });

    } catch (error) {
        console.error('Error fetching list of payments:', error);
        return createResponse({
            statusCode: 500,
            body: { message: 'Failed to fetch list of payments' }
        });
    }
};
