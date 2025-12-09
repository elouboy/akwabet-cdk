// lambda/src/handlers/payments-kpis.ts
import { createResponse } from '../../../shared/utility';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = 'Payments';
const INDEX_NAME = 'GSI_MonthType'; // PK: month, (SK: type) -> optionnelle dans la KeyCondition

// Helper: boucle de pagination jusqu'à épuisement
async function queryAll(params: any) {
  let items: any[] = [];
  let ExclusiveStartKey: any = undefined;

  do {
    const res = await ddb.send(new QueryCommand({ ...params, ExclusiveStartKey }));
    if (res.Items) items = items.concat(res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}

// Convertit proprement number|string|undefined -> number
const toNum = (v: any) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
};

export const handler = async (event: any): Promise<any> => {
  try {
    const { month } = event.body ? JSON.parse(event.body) : {};
    const monthStr = typeof month === 'string' ? month : String(month ?? '');
    const monthForPayments = monthStr ? monthStr.charAt(0).toLowerCase() + monthStr.slice(1) : monthStr;
    if (!month) {
      return createResponse({
        statusCode: 400,
        body: { message: 'Month parameter is required' },
      });
    }

    // 🔎 Une seule Query sur le GSI avec:
    // - KeyCondition sur month
    // - FilterExpression pour ne garder que statut = 'SUCCEEDED'
    // - Projection des champs nécessaires pour minimiser le débit
    const items = await queryAll({
      TableName: TABLE_NAME,
      IndexName: INDEX_NAME,
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
      ProjectionExpression: 'amount, fees, #type',
    });

    // 🧮 Agrégations: on sépare depot/retrait côté code
    let depot = 0;
    let retrait = 0;
    let totalFees = 0;
    let countDepot = 0;
    let countRetrait = 0;

    for (const it of items) {
      const amt = toNum(it.amount);
      const fee = toNum(it.fees);
      totalFees += fee;

      if (it.type === 'depot') {
        depot += amt;
        countDepot += 1;
      } else if (it.type === 'retrait') {
        retrait += amt;
        countRetrait += 1;
      }
    }

    return createResponse({
      statusCode: 200,
      body: {
        month,
        depot,
        retrait,
        totalFees,
        counts: {
          depot: countDepot,
          retrait: countRetrait,
          total: items.length,
        },
        // Astuce debug: enlève en prod si inutile
        // sample: items.slice(0, 3),
      },
    });
  } catch (err) {
    console.error('Error fetching payment KPIs:', err);
    return createResponse({
      statusCode: 500,
      body: { message: 'Failed to fetch payment KPIs' },
    });
  }
};
