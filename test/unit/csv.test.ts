/**
 * @jest-environment node
 */

import {
  parseCSV,
  mapCSVData,
  createEntryPool,
  extractPrizesFromEntries,
} from '../../src/utils/csv';

describe('CSV Utility Functions', () => {
  describe('parseCSV', () => {
    test('should parse simple CSV with headers and data', () => {
      const csvContent = `name,email,tickets
John Doe,john@example.com,3
Jane Smith,jane@example.com,1
Bob Wilson,bob@example.com,2`;

      const result = parseCSV(csvContent);

      expect(result.headers).toEqual(['name', 'email', 'tickets']);
      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        tickets: '3',
      });
      expect(result.data[1]).toEqual({
        name: 'Jane Smith',
        email: 'jane@example.com',
        tickets: '1',
      });
      expect(result.data[2]).toEqual({
        name: 'Bob Wilson',
        email: 'bob@example.com',
        tickets: '2',
      });
    });

    test('should handle quoted values', () => {
      const csvContent = `"name","email","tickets"
"John Doe","john@example.com","3"
"Jane Smith","jane@example.com","1"`;

      const result = parseCSV(csvContent);

      expect(result.headers).toEqual(['name', 'email', 'tickets']);
      expect(result.data[0]).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        tickets: '3',
      });
    });

    test('should handle mixed quoted and unquoted values', () => {
      const csvContent = `name,email,tickets
"John Doe",john@example.com,3
Jane Smith,"jane@example.com",1`;

      const result = parseCSV(csvContent);

      expect(result.headers).toEqual(['name', 'email', 'tickets']);
      expect(result.data[0]).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        tickets: '3',
      });
      expect(result.data[1]).toEqual({
        name: 'Jane Smith',
        email: 'jane@example.com',
        tickets: '1',
      });
    });

    test('should filter out empty rows', () => {
      const csvContent = `name,email,tickets
John Doe,john@example.com,3

Jane Smith,jane@example.com,1
,,`;

      const result = parseCSV(csvContent);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('John Doe');
      expect(result.data[1].name).toBe('Jane Smith');
    });

    test('should handle empty CSV content', () => {
      const result = parseCSV('');

      expect(result.headers).toEqual([]);
      expect(result.data).toEqual([]);
    });

    test('should handle CSV with only headers', () => {
      const csvContent = 'name,email,tickets';

      const result = parseCSV(csvContent);

      expect(result.headers).toEqual(['name', 'email', 'tickets']);
      expect(result.data).toEqual([]);
    });

    test('should handle missing values in rows', () => {
      const csvContent = `name,email,tickets
John Doe,john@example.com,3
Jane Smith,,1
Bob Wilson,bob@example.com,`;

      const result = parseCSV(csvContent);

      expect(result.data).toHaveLength(3);
      expect(result.data[1]).toEqual({
        name: 'Jane Smith',
        email: '',
        tickets: '1',
      });
      expect(result.data[2]).toEqual({
        name: 'Bob Wilson',
        email: 'bob@example.com',
        tickets: '',
      });
    });

    test('should handle whitespace around values', () => {
      const csvContent = `  name  ,  email  ,  tickets  
  John Doe  ,  john@example.com  ,  3  
  Jane Smith  ,  jane@example.com  ,  1  `;

      const result = parseCSV(csvContent);

      expect(result.headers).toEqual(['name', 'email', 'tickets']);
      expect(result.data[0]).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        tickets: '3',
      });
    });
  });

  describe('mapCSVData', () => {
    test('should map CSV data with column mapping', () => {
      const data = [
        { fullname: 'John Doe', emailaddr: 'john@example.com', numtickets: '3' },
        { fullname: 'Jane Smith', emailaddr: 'jane@example.com', numtickets: '1' },
      ];

      const mapping = {
        name: 'fullname',
        email: 'emailaddr',
        tickets: 'numtickets',
      };

      const result = mapCSVData(data, mapping);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        tickets: 3,
        originalData: { fullname: 'John Doe', emailaddr: 'john@example.com', numtickets: '3' },
      });
      expect(result[1]).toEqual({
        name: 'Jane Smith',
        email: 'jane@example.com',
        tickets: 1,
        originalData: { fullname: 'Jane Smith', emailaddr: 'jane@example.com', numtickets: '1' },
      });
    });

    test('should use default name mapping if not specified', () => {
      const data = [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Smith', email: 'jane@example.com' },
      ];

      const mapping = {};

      const result = mapCSVData(data, mapping);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('John Doe');
      expect(result[1].name).toBe('Jane Smith');
    });

    test('should fallback to first column if name mapping not found', () => {
      const data = [
        { participant: 'John Doe', contact: 'john@example.com' },
        { participant: 'Jane Smith', contact: 'jane@example.com' },
      ];

      const mapping = { name: 'nonexistent' };

      const result = mapCSVData(data, mapping);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('John Doe'); // Falls back to first column
      expect(result[1].name).toBe('Jane Smith');
    });

    test('should handle unknown participant names', () => {
      const data = [
        { something: '', other: 'data' },
      ];

      const mapping = {};

      const result = mapCSVData(data, mapping);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unknown');
    });

    test('should handle optional fields correctly', () => {
      const data = [
        { name: 'John Doe', email: 'john@example.com', tickets: '3', prize: 'Trophy' },
        { name: 'Jane Smith' }, // Missing optional fields
      ];

      const mapping = {
        name: 'name',
        email: 'email',
        tickets: 'tickets',
        prize: 'prize',
      };

      const result = mapCSVData(data, mapping);

      expect(result[0]).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        tickets: 3,
        prize: 'Trophy',
        originalData: { name: 'John Doe', email: 'john@example.com', tickets: '3', prize: 'Trophy' },
      });

      expect(result[1]).toEqual({
        name: 'Jane Smith',
        originalData: { name: 'Jane Smith' },
      });
      expect(result[1]).not.toHaveProperty('email');
      expect(result[1]).not.toHaveProperty('tickets');
      expect(result[1]).not.toHaveProperty('prize');
    });

    test('should handle invalid ticket numbers', () => {
      const data = [
        { name: 'John Doe', tickets: 'invalid' },
        { name: 'Jane Smith', tickets: '0' },
        { name: 'Bob Wilson', tickets: '-5' },
      ];

      const mapping = { tickets: 'tickets' };

      const result = mapCSVData(data, mapping);

      expect(result[0].tickets).toBe(1); // Invalid (NaN) becomes 1
      expect(result[1].tickets).toBe(1); // '0' string is truthy, parseInt('0') = 0, 0 || 1 = 1
      expect(result[2].tickets).toBe(-5); // -5 stays -5 (parseInt preserves negative)
    });
  });

  describe('createEntryPool', () => {
    test('should create entry pool with correct number of tickets per person', () => {
      const entries = [
        { name: 'John Doe', tickets: 3 },
        { name: 'Jane Smith', tickets: 1 },
        { name: 'Bob Wilson', tickets: 2 },
      ];

      const pool = createEntryPool(entries);

      expect(pool).toHaveLength(6);
      expect(pool.filter(name => name === 'John Doe')).toHaveLength(3);
      expect(pool.filter(name => name === 'Jane Smith')).toHaveLength(1);
      expect(pool.filter(name => name === 'Bob Wilson')).toHaveLength(2);
    });

    test('should default to 1 ticket if tickets property is missing', () => {
      const entries = [
        { name: 'John Doe' },
        { name: 'Jane Smith', tickets: 2 },
      ];

      const pool = createEntryPool(entries);

      expect(pool).toHaveLength(3);
      expect(pool.filter(name => name === 'John Doe')).toHaveLength(1);
      expect(pool.filter(name => name === 'Jane Smith')).toHaveLength(2);
    });

    test('should handle zero or negative tickets correctly', () => {
      const entries = [
        { name: 'John Doe', tickets: 0 },
        { name: 'Jane Smith', tickets: -1 },
        { name: 'Bob Wilson' }, // No tickets property - should default to 1
      ];

      const pool = createEntryPool(entries);

      // 0 || 1 = 1, so 0 tickets becomes 1 ticket
      // -1 || 1 = -1, but for loop with i < -1 creates 0 entries
      // undefined || 1 = 1, so 1 entry
      expect(pool).toHaveLength(2);
      expect(pool.filter(name => name === 'John Doe')).toHaveLength(1);
      expect(pool.filter(name => name === 'Jane Smith')).toHaveLength(0);
      expect(pool.filter(name => name === 'Bob Wilson')).toHaveLength(1);
    });

    test('should handle empty entries array', () => {
      const entries: Array<{ name: string; tickets?: number }> = [];

      const pool = createEntryPool(entries);

      expect(pool).toEqual([]);
    });

    test('should handle large number of tickets', () => {
      const entries = [
        { name: 'John Doe', tickets: 1000 },
      ];

      const pool = createEntryPool(entries);

      expect(pool).toHaveLength(1000);
      expect(pool.every(name => name === 'John Doe')).toBe(true);
    });
  });

  describe('extractPrizesFromEntries', () => {
    test('should extract unique prizes from entries', () => {
      const entries = [
        { name: 'John Doe', prize: 'Trophy' },
        { name: 'Jane Smith', prize: 'Medal' },
        { name: 'Bob Wilson', prize: 'Trophy' }, // Duplicate
        { name: 'Alice Brown', prize: 'Certificate' },
      ];

      const prizes = extractPrizesFromEntries(entries);

      expect(prizes).toEqual(['Certificate', 'Medal', 'Trophy']); // Sorted alphabetically
      expect(prizes).toHaveLength(3);
    });

    test('should handle entries without prizes', () => {
      const entries = [
        { name: 'John Doe', prize: 'Trophy' },
        { name: 'Jane Smith' }, // No prize
        { name: 'Bob Wilson', prize: 'Medal' },
      ];

      const prizes = extractPrizesFromEntries(entries);

      expect(prizes).toEqual(['Medal', 'Trophy']);
      expect(prizes).toHaveLength(2);
    });

    test('should handle empty prize strings', () => {
      const entries = [
        { name: 'John Doe', prize: 'Trophy' },
        { name: 'Jane Smith', prize: '' },
        { name: 'Bob Wilson', prize: '   ' }, // Whitespace only
        { name: 'Alice Brown', prize: 'Medal' },
      ];

      const prizes = extractPrizesFromEntries(entries);

      expect(prizes).toEqual(['Medal', 'Trophy']);
      expect(prizes).toHaveLength(2);
    });

    test('should trim whitespace from prizes', () => {
      const entries = [
        { name: 'John Doe', prize: '  Trophy  ' },
        { name: 'Jane Smith', prize: ' Medal ' },
      ];

      const prizes = extractPrizesFromEntries(entries);

      expect(prizes).toEqual(['Medal', 'Trophy']);
    });

    test('should handle empty entries array', () => {
      const entries: Array<{ name: string; prize?: string }> = [];

      const prizes = extractPrizesFromEntries(entries);

      expect(prizes).toEqual([]);
    });

    test('should handle duplicate prizes after trimming', () => {
      const entries = [
        { name: 'John Doe', prize: 'Trophy' },
        { name: 'Jane Smith', prize: ' Trophy ' },
        { name: 'Bob Wilson', prize: '  Trophy  ' },
      ];

      const prizes = extractPrizesFromEntries(entries);

      expect(prizes).toEqual(['Trophy']);
      expect(prizes).toHaveLength(1);
    });

    test('should sort prizes alphabetically', () => {
      const entries = [
        { name: 'John Doe', prize: 'Zebra Prize' },
        { name: 'Jane Smith', prize: 'Alpha Prize' },
        { name: 'Bob Wilson', prize: 'Beta Prize' },
      ];

      const prizes = extractPrizesFromEntries(entries);

      expect(prizes).toEqual(['Alpha Prize', 'Beta Prize', 'Zebra Prize']);
    });
  });
});