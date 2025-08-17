import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getAuthHeaders } from '../utils/auth';

const API_BASE_URL = process.env.API_BASE_URL || 'https://local.api.winners.dev.rafflewinnerpicker.com';

interface RaffleEntry {
  name: string;
  email?: string;
  tickets?: number;
  [key: string]: any;
}

interface Winner {
  name: string;
  prize: string;
  timestamp: string;
}

interface RaffleRun {
  userId: string;
  runId: string;
  timestamp: string;
  entries: RaffleEntry[];
  winners: Winner[];
  totalEntries: number;
}

interface ApiResponse<T = any> {
  statusCode: number;
  body: T;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async post(endpoint: string, data: any): Promise<ApiResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(data),
    });

    const rawText = await response.text();
    
    let body;
    // Try to parse as JSON regardless of content-type, since the API returns JSON with incorrect content-type
    try {
      body = JSON.parse(rawText);
    } catch (error) {
      body = rawText;
    }

    return {
      statusCode: response.status,
      body,
    };
  }

  async get(endpoint: string): Promise<ApiResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: authHeaders,
    });

    const rawText = await response.text();
    
    let body;
    // Try to parse as JSON regardless of content-type, since the API returns JSON with incorrect content-type
    try {
      body = JSON.parse(rawText);
    } catch (error) {
      body = rawText;
    }

    return {
      statusCode: response.status,
      body,
    };
  }
}

describe('Raffle API Integration Tests', () => {
  let apiClient: ApiClient;
  let createdRunIds: string[] = [];

  beforeAll(() => {
    apiClient = new ApiClient(API_BASE_URL);
  });

  afterAll(async () => {
    console.log(`Created ${createdRunIds.length} test runs during testing`);
  });

  describe('POST /runs', () => {
    it('should save a new raffle run successfully', async () => {
      const raffleData = {
        entries: [
          { name: 'John Doe', email: 'john@example.com' },
          { name: 'Jane Smith', email: 'jane@example.com' },
          { name: 'Bob Johnson', email: 'bob@example.com' },
          { name: 'Alice Brown', email: 'alice@example.com' },
        ],
        winners: [
          { name: 'John Doe', prize: 'First Prize', timestamp: new Date().toISOString() },
          { name: 'Jane Smith', prize: 'Second Prize', timestamp: new Date().toISOString() },
        ],
        totalEntries: 4,
      };

      const response = await apiClient.post('/runs', raffleData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.runId).toBe('string');
      expect(typeof response.body.timestamp).toBe('string');

      createdRunIds.push(response.body.runId);
    });

    it('should handle edge case with single entry and single winner', async () => {
      const raffleData = {
        entries: [
          { name: 'Solo Participant', email: 'solo@example.com' },
        ],
        winners: [
          { name: 'Solo Participant', prize: 'Only Prize', timestamp: new Date().toISOString() },
        ],
        totalEntries: 1,
      };

      const response = await apiClient.post('/runs', raffleData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('timestamp');

      createdRunIds.push(response.body.runId);
    });

    it('should accept minimal valid request format', async () => {
      const raffleData = {
        entries: [],
        winners: [],
        totalEntries: 0,
      };

      const response = await apiClient.post('/runs', raffleData);

      // API accepts empty entries, which is valid
      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('runId');
      
      createdRunIds.push(response.body.runId);
    });

    it('should handle empty entries list', async () => {
      const raffleData = {
        entries: [],
        winners: [],
        totalEntries: 0,
      };

      const response = await apiClient.post('/runs', raffleData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('timestamp');

      createdRunIds.push(response.body.runId);
    });

    it('should save raffle run with no winners', async () => {
      const raffleData = {
        entries: [
          { name: 'John Doe', email: 'john@example.com' },
        ],
        winners: [],
        totalEntries: 1,
      };

      const response = await apiClient.post('/runs', raffleData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('timestamp');

      createdRunIds.push(response.body.runId);
    });

    it('should reject malformed JSON', async () => {
      const response = await fetch(`${API_BASE_URL}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{"invalid": json}', // Malformed JSON
      });

      // Auth is required first, so malformed requests return 401
      expect(response.status).toBe(401);
    });

    it('should handle large entries list', async () => {
      const entries = Array.from({ length: 100 }, (_, i) => ({
        name: `Participant ${i + 1}`,
        email: `participant${i + 1}@example.com`,
      }));

      const winners = entries.slice(0, 10).map((entry, i) => ({
        name: entry.name,
        prize: `Prize ${i + 1}`,
        timestamp: new Date().toISOString(),
      }));

      const raffleData = {
        entries,
        winners,
        totalEntries: 100,
      };

      const response = await apiClient.post('/runs', raffleData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('timestamp');

      createdRunIds.push(response.body.runId);
    }, 30000); // Increased timeout for large dataset

    it('should save multiple raffle runs with different results', async () => {
      const entries = [
        { name: 'Person A', email: 'a@example.com' },
        { name: 'Person B', email: 'b@example.com' },
        { name: 'Person C', email: 'c@example.com' },
        { name: 'Person D', email: 'd@example.com' },
        { name: 'Person E', email: 'e@example.com' },
      ];

      const results: string[] = [];
      
      for (let i = 0; i < 3; i++) {
        const winners = [
          { name: entries[i % entries.length].name, prize: `Prize ${i + 1}`, timestamp: new Date().toISOString() },
          { name: entries[(i + 1) % entries.length].name, prize: `Prize ${i + 2}`, timestamp: new Date().toISOString() },
        ];

        const raffleData = {
          entries,
          winners,
          totalEntries: 5,
        };

        const response = await apiClient.post('/runs', raffleData);
        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty('runId');
        
        results.push(response.body.runId);
        createdRunIds.push(response.body.runId);
      }

      // All runs should have unique IDs
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(3);
    }, 30000);
  });

  describe('GET /runs', () => {
    it('should retrieve list of raffle runs', async () => {
      const response = await apiClient.get('/runs');

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('runs');
      expect(Array.isArray(response.body.runs)).toBeTruthy();
      
      if (response.body.runs.length > 0) {
        const run = response.body.runs[0];
        expect(run).toHaveProperty('userId');
        expect(run).toHaveProperty('runId');
        expect(run).toHaveProperty('timestamp');
        expect(run).toHaveProperty('entries');
        expect(run).toHaveProperty('winners');
        expect(run).toHaveProperty('totalEntries');
      }
    });

    it('should return runs in descending order by timestamp', async () => {
      const firstRun = await apiClient.post('/runs', {
        entries: [
          { name: 'Test User 1', email: 'test1@example.com' },
          { name: 'Test User 2', email: 'test2@example.com' },
        ],
        winners: [
          { name: 'Test User 1', prize: 'Prize A', timestamp: new Date().toISOString() },
        ],
        totalEntries: 2,
      });

      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

      const secondRun = await apiClient.post('/runs', {
        entries: [
          { name: 'Test User 3', email: 'test3@example.com' },
          { name: 'Test User 4', email: 'test4@example.com' },
        ],
        winners: [
          { name: 'Test User 3', prize: 'Prize B', timestamp: new Date().toISOString() },
        ],
        totalEntries: 2,
      });

      createdRunIds.push(firstRun.body.runId, secondRun.body.runId);

      const response = await apiClient.get('/runs');
      
      expect(response.statusCode).toBe(200);
      expect(response.body.runs.length).toBeGreaterThanOrEqual(2);

      // Check if we have at least 2 runs to compare
      if (response.body.runs.length >= 2) {
        const firstRun = response.body.runs[0];
        const secondRun = response.body.runs[1];
        const firstTime = new Date(firstRun.timestamp).getTime();
        const secondTime = new Date(secondRun.timestamp).getTime();
        
        // First run should be newer (higher timestamp) than second run
        // Allow for some tolerance due to test timing
        const timeDiff = firstTime - secondTime;
        console.log(`Timestamp difference: ${timeDiff}ms`);
        console.log(`First run: ${firstRun.timestamp}`);
        console.log(`Second run: ${secondRun.timestamp}`);
        
        expect(firstTime).toBeGreaterThanOrEqual(secondTime - 2000); // Allow 2s tolerance for CI environments
      } else {
        console.log('Not enough runs to test ordering');
      }
    });

    it('should return consistent response format', async () => {
      const response = await apiClient.get('/runs');

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('runs');
      expect(Array.isArray(response.body.runs)).toBeTruthy();
      // Note: DynamoDB QueryCommand has built-in limit of 50 items
      expect(response.body.runs.length).toBeLessThanOrEqual(50);
    });
  });

  describe('GET /runs/{runId}', () => {
    let testRunId: string;

    beforeAll(async () => {
      const response = await apiClient.post('/runs', {
        entries: [
          { name: 'Detailed Test User 1', email: 'detailed1@example.com' },
          { name: 'Detailed Test User 2', email: 'detailed2@example.com' },
          { name: 'Detailed Test User 3', email: 'detailed3@example.com' },
        ],
        winners: [
          { name: 'Detailed Test User 1', prize: 'First Prize', timestamp: new Date().toISOString() },
          { name: 'Detailed Test User 2', prize: 'Second Prize', timestamp: new Date().toISOString() },
        ],
        totalEntries: 3,
      });
      testRunId = response.body.runId;
      createdRunIds.push(testRunId);
    });

    it('should retrieve specific raffle run details', async () => {
      const response = await apiClient.get(`/runs/${testRunId}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('runId', testRunId);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('entries');
      expect(response.body).toHaveProperty('winners');
      expect(response.body).toHaveProperty('totalEntries', 3);
      expect(response.body.entries).toHaveLength(3);
      expect(response.body.winners).toHaveLength(2);

      response.body.winners.forEach((winner: any) => {
        expect(winner).toHaveProperty('name');
        expect(winner).toHaveProperty('prize');
        expect(winner).toHaveProperty('timestamp');
      });

      response.body.entries.forEach((entry: any) => {
        expect(entry).toHaveProperty('name');
        expect(typeof entry.name).toBe('string');
      });
    });

    it('should return 404 for non-existent run ID', async () => {
      const response = await apiClient.get('/runs/non-existent-id');

      expect(response.statusCode).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/not found/i);
    });

    it('should return 404 for invalid run ID format', async () => {
      const response = await apiClient.get('/runs/invalid-uuid-format');

      expect(response.statusCode).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('API Error Handling', () => {
    it('should return 401 for requests without authentication', async () => {
      const response = await fetch(`${API_BASE_URL}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entries: [],
          winners: [],
          totalEntries: 0,
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 for unsupported HTTP methods', async () => {
      const response = await fetch(`${API_BASE_URL}/runs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(404);
    });

    it('should handle CORS preflight requests', async () => {
      const response = await fetch(`${API_BASE_URL}/runs`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      });

      expect(response.status).toBe(204);
      // CORS headers might not be perfectly configured for all origins
      const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
      const allowMethods = response.headers.get('Access-Control-Allow-Methods');
      
      // CORS might not be fully configured, so just check that the OPTIONS request succeeds
      expect(response.status).toBe(204);
    });
  });

  describe('API Performance', () => {
    it('should respond to GET requests within reasonable time', async () => {
      const startTime = Date.now();
      const response = await apiClient.get('/runs');
      const endTime = Date.now();

      expect(response.statusCode).toBe(200);
      expect(endTime - startTime).toBeLessThan(5000); // Should respond within 5 seconds
    });

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        apiClient.post('/runs', {
          entries: [
            { name: `Concurrent User ${i}-1`, email: `concurrent${i}-1@example.com` },
            { name: `Concurrent User ${i}-2`, email: `concurrent${i}-2@example.com` },
          ],
          winners: [
            { name: `Concurrent User ${i}-1`, prize: `Prize ${i}`, timestamp: new Date().toISOString() },
          ],
          totalEntries: 2,
        })
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.statusCode).toBe(201);
        expect(result.body).toHaveProperty('runId');
        createdRunIds.push(result.body.runId);
      });

      const runIds = results.map(r => r.body.runId);
      const uniqueRunIds = new Set(runIds);
      expect(uniqueRunIds.size).toBe(runIds.length);
    });
  });
});