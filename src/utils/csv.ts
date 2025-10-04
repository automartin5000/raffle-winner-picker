interface CSVParseResult {
  headers: string[];
  data: Record<string, any>[];
}

interface ColumnMapping {
  name?: string;
  email?: string;
  tickets?: string;
  prize?: string;
}

export function parseCSV(csvContent: string): CSVParseResult {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], data: [] };

  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  // Parse data rows
  const data = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, any> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  }).filter(row => Object.values(row).some(value => value !== ''));

  return { headers, data };
}

export function mapCSVData(
  data: Record<string, any>[],
  mapping: ColumnMapping,
): Array<{ name: string; email?: string; tickets?: number; prize?: string; originalData: Record<string, any> }> {
  return data.map(row => {
    const result: any = {
      name: row[mapping.name || 'name'] || row[Object.keys(row)[0]] || 'Unknown',
      originalData: row,
    };

    if (mapping.email && row[mapping.email]) {
      result.email = row[mapping.email];
    }

    if (mapping.tickets && row[mapping.tickets]) {
      const tickets = parseInt(row[mapping.tickets]) || 1;
      result.tickets = tickets;
    }

    if (mapping.prize && row[mapping.prize]) {
      result.prize = row[mapping.prize];
    }

    return result;
  });
}

export function createEntryPool(entries: Array<{ name: string; tickets?: number }>): string[] {
  const pool: string[] = [];
  entries.forEach(entry => {
    const tickets = entry.tickets || 1;
    for (let i = 0; i < tickets; i++) {
      pool.push(entry.name);
    }
  });
  return pool;
}

export function extractPrizesFromEntries(entries: Array<{ name: string; prize?: string }>): string[] {
  const prizes = new Set<string>();
  entries.forEach(entry => {
    if (entry.prize && entry.prize.trim()) {
      prizes.add(entry.prize.trim());
    }
  });
  return Array.from(prizes).sort();
}

export function validatePrizeData(
  data: Record<string, any>[],
  mapping: ColumnMapping,
): { valid: boolean; error?: string; missingPrizeRows?: number[] } {
  // If no prize column is mapped, validation passes
  if (!mapping.prize) {
    return { valid: true };
  }

  // If prize column is mapped, ALL entries must have a prize value
  const missingPrizeRows: number[] = [];
  const prizeColumn = mapping.prize;
  
  data.forEach((row, index) => {
    const prizeValue = row[prizeColumn];
    if (prizeValue == null || prizeValue.toString().trim() === '') {
      missingPrizeRows.push(index + 2); // +2 because: +1 for 0-index, +1 for header row
    }
  });

  if (missingPrizeRows.length > 0) {
    const rowsList = missingPrizeRows.slice(0, 5).join(', ');
    const moreRows = missingPrizeRows.length > 5 ? ` and ${missingPrizeRows.length - 5} more` : '';
    return {
      valid: false,
      error: `Prize column is mapped, but ${missingPrizeRows.length} row(s) are missing prize values. Rows: ${rowsList}${moreRows}. All entries must specify a prize when using the Prize column.`,
      missingPrizeRows,
    };
  }

  return { valid: true };
}