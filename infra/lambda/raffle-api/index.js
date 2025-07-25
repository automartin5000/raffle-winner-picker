const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    };

    try {
        // Handle preflight requests
        if (event.httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers, body: '' };
        }

        // Extract user ID from Auth0 JWT (simplified - use proper JWT verification in production)
        const authHeader = event.headers.Authorization || event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { 
                statusCode: 401, 
                headers, 
                body: JSON.stringify({ error: 'Unauthorized - Missing or invalid token' }) 
            };
        }
        
        // In production, verify JWT properly with Auth0 public key
        // For now, just decode the payload (THIS IS NOT SECURE FOR PRODUCTION)
        try {
            const token = authHeader.substring(7);
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            var userId = payload.sub;
        } catch (error) {
            return { 
                statusCode: 401, 
                headers, 
                body: JSON.stringify({ error: 'Invalid token format' }) 
            };
        }

        const method = event.httpMethod;
        const path = event.resource;

        if (method === 'POST' && path === '/raffle-runs') {
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
            }));

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({ runId, timestamp }),
            };
        }

        if (method === 'GET' && path === '/raffle-runs') {
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

        if (method === 'GET' && path === '/raffle-runs/{runId}') {
            // Get specific run
            const runId = event.pathParameters.runId;
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