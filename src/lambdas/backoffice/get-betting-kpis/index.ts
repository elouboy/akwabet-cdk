import { createResponse } from '../../../shared/utility';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

export const handler = async (event: any): Promise<any> => {
    console.log('Event: ', event);
    
    const dynamodb = new DynamoDB({ region: "us-east-1" });
    
    const { month, category } = event.body ? JSON.parse(event.body) : {};
    const monthStr = typeof month === 'string' ? month : String(month ?? '');
    const monthForBets = monthStr ? monthStr.charAt(0).toUpperCase() + monthStr.slice(1) : monthStr;
    
    if (!month) {
        return createResponse({
            statusCode: 400,
            body: { message: 'Month parameter is required' }
        });
    }
    
    try {
        // Query Bets table using GSI_MonthCategory
        const betsParams: any = {
            TableName: 'Bets',
            IndexName: 'GSI_MonthCategory',
            KeyConditionExpression: '#mois = :month',
            ExpressionAttributeNames: {
                '#mois': 'Mois'
            },
            ExpressionAttributeValues: {
                ':month': { S: monthForBets }
            }
        };

        // If category is provided, add it to the query
        if (category) {
            betsParams.KeyConditionExpression += ' AND #category = :category';
            betsParams.ExpressionAttributeNames['#category'] = 'Category';
            betsParams.ExpressionAttributeValues[':category'] = { S: category };
        }

        const betsResult = await dynamodb.query(betsParams);

        // Helper function to parse comma-separated numbers
        const parseAmount = (value: string): number => {
            if (!value) return 0;
            // Replace comma with dot for decimal parsing
            return parseFloat(value.replace(',', '.'));
        };

        // Calculate totals from Bets
        let mises = 0; // bets
        let gains = 0; // wins
        let profit = 0;
        let bonus = 0;

        if (betsResult.Items) {
            betsResult.Items.forEach((item: any) => {
                // "Bet ( All Valid Bets )" -> S (string with comma)
                if (item['Bet_All_Valid_Bets']?.S) {
                    mises += parseAmount(item['Bet_All_Valid_Bets'].S);
                }
                // "Win ( Bet Closed )" -> S (string with comma)
                if (item['Win_Bet_Closed']?.S) {
                    gains += parseAmount(item['Win_Bet_Closed'].S);
                }
                // "Profit" -> S (string with comma)
                if (item['Profit']?.S) {
                    profit += parseAmount(item['Profit'].S);
                }
                // "Bonus bet" -> S (string with comma)
                if (item['Bonus_bet']?.S) {
                    bonus += parseAmount(item['Bonus_bet'].S);
                }
            });
        }

        return createResponse({
            statusCode: 200,
            body: {
                mises,
                gains,
                profit,
                bonus
            }
        });

    } catch (error) {
        console.error('Error fetching betting KPIs:', error);
        return createResponse({
            statusCode: 500,
            body: { message: 'Failed to fetch betting KPIs' }
        });
    }
};