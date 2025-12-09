import { createResponse } from '../../../shared/utility';
import { DynamoDB, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

export const handler = async (event: any): Promise<any> => {
    console.log('Event: ', event);
    
    const dynamodb = new DynamoDB({ region: "us-east-1" });
    const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }), {
        marshallOptions: { removeUndefinedValues: true },
    });
    
    const { month, category } = event.body ? JSON.parse(event.body) : {};
    const categoryValue = typeof category === 'string' ? category.trim() : undefined;
    const hasCategory = !!categoryValue;
    const monthStr = typeof month === 'string' ? month : String(month ?? '');
    const monthForBets = monthStr ? monthStr.charAt(0).toUpperCase() + monthStr.slice(1) : monthStr;
    const monthForPayments = monthStr ? monthStr.charAt(0).toLowerCase() + monthStr.slice(1) : monthStr;
    
    if (!month) {
        return createResponse({
            statusCode: 400,
            body: { message: 'Month parameter is required' }
        });
    }
    
    try {
        // Helper to paginate queries (DocumentClient)
        const queryAll = async (params: any) => {
            let items: any[] = [];
            let ExclusiveStartKey: any = undefined;
            do {
                const res = await ddbDoc.send(new QueryCommand({ ...params, ExclusiveStartKey }));
                if (res.Items) items = items.concat(res.Items);
                ExclusiveStartKey = res.LastEvaluatedKey;
            } while (ExclusiveStartKey);
            return items;
        };

        // Query Bets table using low-level DynamoDB API (AttributeValue .S), category optional
        const betsParams: any = {
            TableName: 'Bets',
            IndexName: 'GSI_MonthCategory',
            KeyConditionExpression: '#mois = :month',
            ExpressionAttributeNames: {
                '#mois': 'Mois',
            },
            ExpressionAttributeValues: {
                ':month': { S: monthForBets },
            },
        };

        if (hasCategory) {
            betsParams.KeyConditionExpression += ' AND #category = :category';
            betsParams.ExpressionAttributeNames['#category'] = 'Category';
            betsParams.ExpressionAttributeValues[':category'] = { S: categoryValue };
        }

        const betsResult = await dynamodb.query(betsParams);

        // Query Payments table once and filter in code (DocumentClient)

        const paymentsItems = await queryAll({
            TableName: 'Payments',
            IndexName: 'GSI_MonthType',
            KeyConditionExpression: '#month = :m',
            FilterExpression: '#statut = :success',
            ExpressionAttributeNames: {
                '#month': 'month',
                '#statut': 'statut',
                '#type': 'type',
            },
            ExpressionAttributeValues: {
                ':m': monthForPayments,
                ':success': 'SUCCEEDED',
            },
            ProjectionExpression: 'amount, #type',
        });

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
                if (item['Bet_All_Valid_Bets']?.S) {
                    mises += parseAmount(item['Bet_All_Valid_Bets'].S);
                }
                if (item['Win_Bet_Closed']?.S) {
                    gains += parseAmount(item['Win_Bet_Closed'].S);
                }
                if (item['Profit']?.S) {
                    profit += parseAmount(item['Profit'].S);
                }
                if (item['Bonus_bet']?.S) {
                    bonus += parseAmount(item['Bonus_bet'].S);
                }
            });
        }

        // Calculate totals from Payments items
        let depot = 0; // total deposits
        let retrait = 0; // total withdrawals
        const toNum = (v: any) => {
            const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
            return Number.isFinite(n) ? n : 0;
        };
        for (const it of paymentsItems) {
            const amt = toNum(it.amount);
            if (it.type === 'depot') depot += amt;
            else if (it.type === 'retrait') retrait += amt;
        }

        return createResponse({
            statusCode: 200,
            body: {
                mises,
                gains,
                profit,
                depot,
                retrait,
                bonus
            }
        });

    } catch (error) {
        console.error('Error fetching KPIs:', error);
        return createResponse({
            statusCode: 500,
            body: { message: 'Failed to fetch KPIs' }
        });
    }
};