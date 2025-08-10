const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
    // Determine the appropriate CORS origin
    const requestOrigin = event.headers?.origin || event.headers?.Origin;
    const allowedOrigins = [process.env.ALLOWED_ORIGIN].filter(Boolean);
    
    // Only add localhost origins for non-production environments
    if (process.env.DEPLOY_ENV !== 'prod') {
        allowedOrigins.push(
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:5174'
        );
    }
    
    const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : (process.env.ALLOWED_ORIGIN || '*');
    
    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
    };

    try {
        // Handle preflight requests (HTTP API format)
        if (event.requestContext?.http?.method === 'OPTIONS') {
            console.log('Handling OPTIONS preflight request');
            console.log('Request origin:', requestOrigin);
            console.log('CORS origin:', corsOrigin);
            return { 
                statusCode: 204,
                headers: {
                    ...headers,
                    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Max-Age': '86400'
                },
                body: '' 
            };
        }

        // Extract user ID from HTTP API JWT authorizer context
        // HTTP API with JWT authorizer automatically validates the token
        // and provides user info in requestContext.authorizer.jwt.claims
        const claims = event.requestContext?.authorizer?.jwt?.claims;
        console.log('User claims:', claims);
        // Use email as primary identifier (consistent across OAuth providers), fallback to sub
        const userId = claims?.email || claims?.sub;
        if (!userId) {
            return { 
                statusCode: 401, 
                headers, 
                body: JSON.stringify({ error: 'Unauthorized - No user context' }) 
            };
        }

        const method = event.requestContext?.http?.method;
        const path = event.requestContext?.http?.path;

        if (method === 'POST' && path === '/runs') {
            // Save new raffle run
            const body = JSON.parse(event.body);
            const runId = randomUUID();
            const timestamp = new Date().toISOString();

            const item = {
                userId,
                runId,
                timestamp,
                entries: body.entries || [],
                winners: body.winners || [],
                totalEntries: body.totalEntries || 0,
            };

            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: item,
                // Ensure raffle runs are immutable - prevent overwriting existing runs
                ConditionExpression: 'attribute_not_exists(runId)',
            }));

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({ runId, timestamp }),
            };
        }

        if (method === 'GET' && path === '/runs') {
            // Get all runs for user
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: { ':userId': userId },
                ScanIndexForward: false, // Most recent first
                Limit: 50, // Limit to last 50 runs
            }));

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ runs: result.Items || [] }),
            };
        }

        if (method === 'GET' && path.startsWith('/runs/')) {
            // Get specific run
            const runId = event.pathParameters?.runId;
            const result = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { userId, runId },
            }));

            if (!result.Item) {
                return { 
                    statusCode: 404, 
                    headers, 
                    body: JSON.stringify({ error: 'Raffle run not found' }) 
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result.Item),
            };
        }

        return { 
            statusCode: 404, 
            headers, 
            body: JSON.stringify({ error: 'Endpoint not found' }) 
        };

    } catch (error) {
        console.error('Lambda error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }),
        };
    }
};