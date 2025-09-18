const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
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
        'Content-Type': 'application/json',
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
                    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Max-Age': '86400'
                },
                body: '' 
            };
        }

        const method = event.requestContext?.http?.method;
        const path = event.requestContext?.http?.path;

        // Public endpoints (no authentication required)
        if (method === 'GET' && path.startsWith('/public/runs/')) {
            // Get public raffle run
            const runId = path.split('/')[3]; // /public/runs/{runId}
            
            if (!runId) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ error: 'Run ID is required' }) 
                };
            }

            // We need to scan for the run since we don't have the userId for public access
            // For better performance in production, consider adding a GSI on runId
            const result = await docClient.send(new ScanCommand({
                TableName: TABLE_NAME,
                FilterExpression: 'runId = :runId AND isPublic = :isPublic',
                ExpressionAttributeValues: { 
                    ':runId': runId,
                    ':isPublic': true
                },
                Limit: 1,
            }));

            if (!result.Items || result.Items.length === 0) {
                return { 
                    statusCode: 404, 
                    headers, 
                    body: JSON.stringify({ error: 'Public raffle run not found' }) 
                };
            }

            const raffleRun = result.Items[0];
            
            // Remove sensitive user information for public view
            const publicRaffleRun = {
                runId: raffleRun.runId,
                timestamp: raffleRun.timestamp,
                winners: raffleRun.winners || [],
                totalEntries: raffleRun.totalEntries || 0,
                // Don't include entries (privacy) or userId
            };

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(publicRaffleRun),
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
                isPublic: false, // Default to private
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

        if (method === 'PATCH' && path.startsWith('/runs/')) {
            // Update raffle run (currently only supports toggling public status)
            const runId = path.split('/')[2]; // /runs/{runId}
            
            if (!runId) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ error: 'Run ID is required' }) 
                };
            }

            const body = JSON.parse(event.body);
            
            // Only allow updating isPublic field for now
            if (!body.hasOwnProperty('isPublic')) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ error: 'Only isPublic field can be updated' }) 
                };
            }

            const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
            
            try {
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { userId, runId },
                    UpdateExpression: 'SET isPublic = :isPublic',
                    ExpressionAttributeValues: { ':isPublic': body.isPublic },
                    ConditionExpression: 'attribute_exists(runId)', // Ensure the run exists
                }));

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ message: 'Raffle visibility updated successfully' }),
                };
            } catch (error) {
                if (error.name === 'ConditionalCheckFailedException') {
                    return { 
                        statusCode: 404, 
                        headers, 
                        body: JSON.stringify({ error: 'Raffle run not found' }) 
                    };
                }
                throw error; // Re-throw other errors
            }
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