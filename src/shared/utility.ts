import { APIGatewayProxyResult } from 'aws-lambda';

interface ResponseOptions {
  statusCode: number;
  body: string | object;
  headers?: { [header: string]: string | number | boolean };
}

export function createResponse(options: ResponseOptions): APIGatewayProxyResult {
  const { statusCode, body, headers = {} } = options;

  // Ensure Content-Type is set if not provided
  if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Add CORS header
  headers['Access-Control-Allow-Origin'] = '*';

  return {
    statusCode,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers,
  };
}