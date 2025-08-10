import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.API_BASE_URL || 'https://local.api.winners.dev.rafflewinnerpicker.com';

interface RaffleRun {
  runId: string;
  timestamp: string;
  participantsCount: number;
  winnersCount: number;
  winners: Array<{
    name: string;
    email: string;
    position: number;
  }>;
  status: 'completed' | 'failed';
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
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return {
      statusCode: response.status,
      body: response.headers.get('content-type')?.includes('application/json') 
        ? await response.json()
        : await response.text(),
    };
  }

  async get(endpoint: string): Promise<ApiResponse> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    return {
      statusCode: response.status,
      body: response.headers.get('content-type')?.includes('application/json') 
        ? await response.json()
        : await response.text(),
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
    it('should create a new raffle run successfully', async () => {
      const raffleData = {
        participants: [
          { name: 'John Doe', email: 'john@example.com' },
          { name: 'Jane Smith', email: 'jane@example.com' },
          { name: 'Bob Johnson', email: 'bob@example.com' },
          { name: 'Alice Brown', email: 'alice@example.com' },
        ],
        winnersCount: 2,
      };

      const response = await apiClient.post('/runs', raffleData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('winners');
      expect(response.body.winners).toHaveLength(2);
      expect(response.body.participantsCount).toBe(4);
      expect(response.body.winnersCount).toBe(2);
      expect(response.body.status).toBe('completed');

      createdRunIds.push(response.body.runId);

      response.body.winners.forEach((winner: any, index: number) => {
        expect(winner).toHaveProperty('name');
        expect(winner).toHaveProperty('email');
        expect(winner).toHaveProperty('position');
        expect(winner.position).toBe(index + 1);
        expect(raffleData.participants.some(p => p.name === winner.name && p.email === winner.email)).toBeTruthy();
      });
    });

    it('should handle edge case with single participant and single winner', async () => {
      const raffleData = {
        participants: [
          { name: 'Solo Participant', email: 'solo@example.com' },
        ],
        winnersCount: 1,
      };

      const response = await apiClient.post('/runs', raffleData);

      expect(response.statusCode).toBe(200);
      expect(response.body.winners).toHaveLength(1);
      expect(response.body.winners[0].name).toBe('Solo Participant');
      expect(response.body.winners[0].position).toBe(1);

      createdRunIds.push(response.body.runId);
    });

    it('should return error when requesting more winners than participants', async () => {
      const raffleData = {
        participants: [
          { name: 'John Doe', email: 'john@example.com' },
          { name: 'Jane Smith', email: 'jane@example.com' },
        ],
        winnersCount: 5,
      };

      const response = await apiClient.post('/runs', raffleData);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/more winners than participants/i);
    });

    it('should return error for invalid participant format', async () => {
      const raffleData = {
        participants: [
          { name: 'John Doe' }, // Missing email
          { email: 'jane@example.com' }, // Missing name
        ],
        winnersCount: 1,
      };

      const response = await apiClient.post('/runs', raffleData);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return error for zero or negative winners count', async () => {
      const raffleData = {
        participants: [
          { name: 'John Doe', email: 'john@example.com' },
        ],
        winnersCount: 0,
      };

      const response = await apiClient.post('/runs', raffleData);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return error for empty participants list', async () => {
      const raffleData = {
        participants: [],
        winnersCount: 1,
      };

      const response = await apiClient.post('/runs', raffleData);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle large participant list', async () => {
      const participants = Array.from({ length: 1000 }, (_, i) => ({
        name: `Participant ${i + 1}`,
        email: `participant${i + 1}@example.com`,
      }));

      const raffleData = {
        participants,
        winnersCount: 10,
      };

      const response = await apiClient.post('/runs', raffleData);

      expect(response.statusCode).toBe(200);
      expect(response.body.winners).toHaveLength(10);
      expect(response.body.participantsCount).toBe(1000);

      createdRunIds.push(response.body.runId);
    }, 30000); // Increased timeout for large dataset

    it('should ensure winner selection is random', async () => {
      const participants = [
        { name: 'Person A', email: 'a@example.com' },
        { name: 'Person B', email: 'b@example.com' },
        { name: 'Person C', email: 'c@example.com' },
        { name: 'Person D', email: 'd@example.com' },
        { name: 'Person E', email: 'e@example.com' },
      ];

      const raffleData = {
        participants,
        winnersCount: 2,
      };

      const results: string[][] = [];
      
      for (let i = 0; i < 10; i++) {
        const response = await apiClient.post('/runs', raffleData);
        expect(response.statusCode).toBe(200);
        
        const winnerNames = response.body.winners.map((w: any) => w.name).sort();
        results.push(winnerNames);
        createdRunIds.push(response.body.runId);
      }

      const uniqueResults = new Set(results.map(r => r.join(',')));
      expect(uniqueResults.size).toBeGreaterThan(1);
    }, 30000);
  });

  describe('GET /runs', () => {
    it('should retrieve list of raffle runs', async () => {
      const response = await apiClient.get('/runs');

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
      
      if (response.body.length > 0) {
        const run = response.body[0];
        expect(run).toHaveProperty('runId');
        expect(run).toHaveProperty('timestamp');
        expect(run).toHaveProperty('participantsCount');
        expect(run).toHaveProperty('winnersCount');
        expect(run).toHaveProperty('status');
      }
    });

    it('should return runs in descending order by timestamp', async () => {
      await apiClient.post('/runs', {
        participants: [
          { name: 'Test User 1', email: 'test1@example.com' },
          { name: 'Test User 2', email: 'test2@example.com' },
        ],
        winnersCount: 1,
      });

      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

      await apiClient.post('/runs', {
        participants: [
          { name: 'Test User 3', email: 'test3@example.com' },
          { name: 'Test User 4', email: 'test4@example.com' },
        ],
        winnersCount: 1,
      });

      const response = await apiClient.get('/runs');
      
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(2);

      for (let i = 1; i < response.body.length; i++) {
        const current = new Date(response.body[i].timestamp);
        const previous = new Date(response.body[i - 1].timestamp);
        expect(current.getTime()).toBeLessThanOrEqual(previous.getTime());
      }
    });

    it('should support pagination with limit parameter', async () => {
      const response = await apiClient.get('/runs?limit=5');

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /runs/{runId}', () => {
    let testRunId: string;

    beforeAll(async () => {
      const response = await apiClient.post('/runs', {
        participants: [
          { name: 'Detailed Test User 1', email: 'detailed1@example.com' },
          { name: 'Detailed Test User 2', email: 'detailed2@example.com' },
          { name: 'Detailed Test User 3', email: 'detailed3@example.com' },
        ],
        winnersCount: 2,
      });
      testRunId = response.body.runId;
      createdRunIds.push(testRunId);
    });

    it('should retrieve specific raffle run details', async () => {
      const response = await apiClient.get(`/runs/${testRunId}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('runId', testRunId);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('participantsCount', 3);
      expect(response.body).toHaveProperty('winnersCount', 2);
      expect(response.body).toHaveProperty('winners');
      expect(response.body.winners).toHaveLength(2);
      expect(response.body).toHaveProperty('status', 'completed');

      response.body.winners.forEach((winner: any, index: number) => {
        expect(winner).toHaveProperty('name');
        expect(winner).toHaveProperty('email');
        expect(winner).toHaveProperty('position', index + 1);
      });
    });

    it('should return 404 for non-existent run ID', async () => {
      const response = await apiClient.get('/runs/non-existent-id');

      expect(response.statusCode).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/not found/i);
    });

    it('should return 400 for invalid run ID format', async () => {
      const response = await apiClient.get('/runs/invalid-uuid-format');

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('API Error Handling', () => {
    it('should return 400 for malformed JSON', async () => {
      const response = await fetch(`${API_BASE_URL}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{"invalid": json}', // Malformed JSON
      });

      expect(response.status).toBe(400);
    });

    it('should return 405 for unsupported HTTP methods', async () => {
      const response = await fetch(`${API_BASE_URL}/runs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(405);
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

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
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
          participants: [
            { name: `Concurrent User ${i}-1`, email: `concurrent${i}-1@example.com` },
            { name: `Concurrent User ${i}-2`, email: `concurrent${i}-2@example.com` },
          ],
          winnersCount: 1,
        })
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.statusCode).toBe(200);
        expect(result.body).toHaveProperty('runId');
        createdRunIds.push(result.body.runId);
      });

      const runIds = results.map(r => r.body.runId);
      const uniqueRunIds = new Set(runIds);
      expect(uniqueRunIds.size).toBe(runIds.length);
    });
  });
});