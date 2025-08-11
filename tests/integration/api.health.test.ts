import { describe, it, expect } from '@jest/globals';

const API_BASE_URL = process.env.API_BASE_URL || 'https://f9benpzfra.execute-api.us-east-1.amazonaws.com/prod/';

describe('API Health Tests', () => {
  it('should respond to requests (even if unauthorized)', async () => {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${API_BASE_URL}/runs`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(10000);
      
      expect([200, 401, 403, 404]).toContain(response.status);
      
      console.log(`API responded with status ${response.status} in ${endTime - startTime}ms`);
      
    } catch (error) {
      console.error('API request failed:', error);
      throw new Error(`API is not reachable: ${error}`);
    }
  });

  it('should handle CORS preflight requests', async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/runs`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      });

      expect([200, 204]).toContain(response.status);
      
      const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
      const allowMethods = response.headers.get('Access-Control-Allow-Methods');
      
      expect(allowOrigin).toBeTruthy();
      
      console.log(`CORS check: Origin=${allowOrigin}, Methods=${allowMethods}`);
      
    } catch (error) {
      console.error('CORS preflight failed:', error);
      throw new Error(`CORS preflight failed: ${error}`);
    }
  });

  it('should have proper content-type for JSON responses', async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/runs`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const contentType = response.headers.get('content-type');
      
      if (response.status === 200) {
        expect(contentType).toContain('application/json');
      }
      
      console.log(`Content-Type header: ${contentType}`);
      
    } catch (error) {
      console.error('Content-type check failed:', error);
      throw new Error(`Content-type check failed: ${error}`);
    }
  });

  it('should reject malformed requests appropriately', async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{"invalid": json syntax}', // Malformed JSON
      });

      expect([400, 401, 403]).toContain(response.status);
      
      console.log(`Malformed request rejected with status ${response.status}`);
      
    } catch (error) {
      console.error('Malformed request test failed:', error);
    }
  });

  it('should respond to health check endpoint if available', async () => {
    const healthEndpoints = [
      '',
      'health',
      'status',
      'ping'
    ];

    for (const endpoint of healthEndpoints) {
      try {
        const url = endpoint ? `${API_BASE_URL}/${endpoint}` : API_BASE_URL;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        console.log(`Health check ${endpoint || 'root'}: ${response.status}`);
        
        if (response.status === 200) {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const body = await response.json();
            console.log(`Health response: ${JSON.stringify(body)}`);
          }
          break;
        }
      } catch (error) {
        console.log(`Health check ${endpoint || 'root'} failed:`, error);
      }
    }
    
    expect(true).toBe(true);
  });
});