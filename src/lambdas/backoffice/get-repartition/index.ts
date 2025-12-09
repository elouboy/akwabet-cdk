import { createResponse } from '../../../shared/utility';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

export const handler = async (event: any): Promise<any> => {
    console.log('Event: ', event);
    
    const dynamodb = new DynamoDB({ region: "us-east-1" });
    
    const { month } = event.body ? JSON.parse(event.body) : {};
    
    if (!month) {
        return createResponse({
            statusCode: 400,
            body: { message: 'Month parameter is required' }
        });
    }
    
    try {
        // Helper function to parse comma-separated numbers
        const parseAmount = (value: string): number => {
            if (!value) return 0;
            // Replace comma with dot for decimal parsing
            return parseFloat(value.replace(',', '.'));
        };

        // Query the GSI_MonthCategory for all categories in the given month (with pagination)
        let lastEvaluatedKey = null;
        const categoryTotals: { [key: string]: number } = {};
        let totalMise = 0;

        do {
            const queryParams: any = {
                TableName: 'Bets',
                IndexName: 'GSI_MonthCategory',
                KeyConditionExpression: '#mois = :month',
                ExpressionAttributeNames: {
                    '#mois': 'Mois'
                },
                ExpressionAttributeValues: {
                    ':month': { S: month }
                }
            };

            if (lastEvaluatedKey) {
                queryParams.ExclusiveStartKey = lastEvaluatedKey;
            }

            const queryResult = await dynamodb.query(queryParams);

            if (queryResult.Items) {
                queryResult.Items.forEach((item: any) => {
                    const category = item['Category']?.S;
                    const mise = item['Bet_All_Valid_Bets']?.S;

                    if (category && mise) {
                        const miseValue = parseAmount(mise);
                        
                        // Sum up the mise for each category
                        categoryTotals[category] = (categoryTotals[category] || 0) + miseValue;
                        totalMise += miseValue;
                    }
                });
            }

            lastEvaluatedKey = queryResult.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        // Calculate percentages for each category
        const percentages: { [key: string]: number } = {};
        
        Object.keys(categoryTotals).forEach((category) => {
            percentages[category] = totalMise > 0 
                ? parseFloat((categoryTotals[category] / totalMise * 100).toFixed(2))
                : 0;
        });

        return createResponse({
            statusCode: 200,
            body: percentages
        });

    } catch (error) {
        console.error('Error fetching repartition data:', error);
        return createResponse({
            statusCode: 500,
            body: { message: 'Failed to fetch repartition data' }
        });
    }
};
