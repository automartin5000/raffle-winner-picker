export function parseCSV(content: string): string[] {
  const lines = content.trim().split('\n');
  return lines.map(line => line.split(',')[0]);
}