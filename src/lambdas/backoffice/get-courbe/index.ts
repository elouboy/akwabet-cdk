import { createResponse } from '../../../shared/utility';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

export const handler = async (event: any): Promise<any> => {
    console.log('Event: ', event);
    
    const dynamodb = new DynamoDB({ region: "us-east-1" });
    
    try {
        // Helper function to parse comma-separated numbers
        const parseAmount = (value: string): number => {
            if (!value) return 0;
            // Replace comma with dot for decimal parsing
            return parseFloat(value.replace(',', '.'));
        };

        // Group by month and calculate total mise for each month
        const monthlyData: { [key: string]: number } = {};
        
        // List of months to query (French month names)
        const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 
                       'juillet', 'aout', 'septembre', 'novembre', 'decembre'];
        
        // Query each month individually using the GSI - much faster than scanning
        const queryPromises = months.map(async (month) => {
            const queryParams = {
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

            const queryResult = await dynamodb.query(queryParams);
            
            let totalMise = 0;
            
            if (queryResult.Items) {
                queryResult.Items.forEach((item: any) => {
                    const mise = item['Bet ( All Valid Bets )']?.S;
                    if (mise) {
                        totalMise += parseAmount(mise);
                    }
                });
            }
            
            return { month, totalMise };
        });
        
        // Wait for all queries to complete
        const results = await Promise.all(queryPromises);
        
        // Populate the result object with non-zero values
        results.forEach(({ month, totalMise }) => {
            if (totalMise > 0) {
                monthlyData[month] = totalMise;
            }
        });

        return createResponse({
            statusCode: 200,
            body: monthlyData
        });

    } catch (error) {
        console.error('Error fetching courbe data:', error);
        return createResponse({
            statusCode: 500,
            body: { message: 'Failed to fetch courbe data' }
        });
    }
};
