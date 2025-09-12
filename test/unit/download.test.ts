/**
 * @jest-environment jsdom
 */

import { downloadCSV } from '../../src/utils/download';

describe('Download Utility Functions', () => {
  // Mock DOM methods
  beforeEach(() => {
    // Reset DOM mocks
    document.body.innerHTML = '';

    // Mock createElement
    const mockLink = {
      setAttribute: jest.fn(),
      click: jest.fn(),
    };

    jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
    jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('downloadCSV', () => {
    test('should create and trigger download with default filename', () => {
      const data = [
        ['Name', 'Email', 'Tickets'],
        ['John Doe', 'john@example.com', '3'],
        ['Jane Smith', 'jane@example.com', '1'],
      ];

      downloadCSV(data);

      expect(document.createElement).toHaveBeenCalledWith('a');

      const mockLink = (document.createElement as jest.Mock).mock.results[0].value;

      // Check that href was set with CSV content
      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'href',
        expect.stringContaining('data:text/csv;charset=utf-8,'),
      );
      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'href',
        expect.stringContaining('Name,Email,Tickets'),
      );
      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'href',
        expect.stringContaining('John%20Doe,john@example.com,3'),
      );

      // Check default filename
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'winners.csv');

      // Check that link was added to DOM, clicked, and removed
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(mockLink.click).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
    });

    test('should use custom filename when provided', () => {
      const data = [
        ['Winner', 'Prize'],
        ['John Doe', 'Trophy'],
      ];
      const customFilename = 'raffle-results.csv';

      downloadCSV(data, customFilename);

      const mockLink = (document.createElement as jest.Mock).mock.results[0].value;

      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', customFilename);
    });

    test('should handle empty data array', () => {
      const data: string[][] = [];

      downloadCSV(data);

      const mockLink = (document.createElement as jest.Mock).mock.results[0].value;

      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'href',
        'data:text/csv;charset=utf-8,',
      );
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'winners.csv');
      expect(mockLink.click).toHaveBeenCalled();
    });

    test('should handle single row of data', () => {
      const data = [['Name', 'Email', 'Score']];

      downloadCSV(data);

      const mockLink = (document.createElement as jest.Mock).mock.results[0].value;

      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'href',
        'data:text/csv;charset=utf-8,Name,Email,Score',
      );
    });

    test('should properly encode special characters', () => {
      const data = [
        ['Name', 'Comment'],
        ['John Doe', 'Great job! 100% success'],
        ['Jane Smith', 'Needs improvement & more practice'],
      ];

      downloadCSV(data);

      const mockLink = (document.createElement as jest.Mock).mock.results[0].value;

      // Should be URL encoded
      const expectedHref = mockLink.setAttribute.mock.calls.find(
        (call: any) => call[0] === 'href',
      )?.[1];

      expect(expectedHref).toContain('Great%20job!%20100%25%20success');
      expect(expectedHref).toContain('Needs%20improvement%20&%20more%20practice');
    });

    test('should handle data with empty cells', () => {
      const data = [
        ['Name', 'Email', 'Phone'],
        ['John Doe', 'john@example.com', ''],
        ['Jane Smith', '', '555-1234'],
      ];

      downloadCSV(data);

      const mockLink = (document.createElement as jest.Mock).mock.results[0].value;

      const expectedHref = mockLink.setAttribute.mock.calls.find(
        (call: any) => call[0] === 'href',
      )?.[1];

      expect(expectedHref).toContain('John%20Doe,john@example.com,');
      expect(expectedHref).toContain('Jane%20Smith,,555-1234');
    });

    test('should handle data with commas in values', () => {
      const data = [
        ['Name', 'Address'],
        ['John Doe', '123 Main St, Anytown, ST'],
        ['Jane Smith', '456 Oak Ave, Another City, ST'],
      ];

      downloadCSV(data);

      const mockLink = (document.createElement as jest.Mock).mock.results[0].value;

      const expectedHref = mockLink.setAttribute.mock.calls.find(
        (call: any) => call[0] === 'href',
      )?.[1];

      // Note: This utility doesn't handle CSV escaping, so commas will be preserved as-is
      // This might be a limitation, but we test the current behavior
      expect(expectedHref).toContain('123%20Main%20St,%20Anytown,%20ST');
    });

    test('should handle large datasets', () => {
      // Create a large dataset
      const data = [['ID', 'Name']];
      for (let i = 1; i <= 1000; i++) {
        data.push([i.toString(), `User ${i}`]);
      }

      downloadCSV(data);

      const mockLink = (document.createElement as jest.Mock).mock.results[0].value;

      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'winners.csv');
      expect(mockLink.click).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
    });

    test('should handle edge case with various data types converted to strings', () => {
      // TypeScript should enforce string[][], but test runtime behavior
      const data = [
        ['Name', 'Score', 'Active'],
        ['John Doe', '95.5', 'true'],
        ['Jane Smith', '87', 'false'],
      ];

      downloadCSV(data);

      const mockLink = (document.createElement as jest.Mock).mock.results[0].value;

      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'winners.csv');
      expect(mockLink.click).toHaveBeenCalled();
    });
  });
});