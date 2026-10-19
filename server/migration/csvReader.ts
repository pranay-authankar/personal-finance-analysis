import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { ParsedCsvDataset } from './types.ts';

export const CSV_TABLE_FILES = [
  'family_members',
  'assets',
  'fds',
  'post_office',
  'bullions',
  'properties',
  'rents',
  'asset_sales',
  'payments',
  'documents',
  'contributions'
] as const;

export type CsvTableName = (typeof CSV_TABLE_FILES)[number];

/**
 * Parses a standard RFC 4180 CSV string into rows of string values.
 * Handles quoted fields, embedded commas, and escaped double quotes ("").
 */
export function parseCsvContent(content: string): Record<string, string>[] {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuote = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      insideQuote = !insideQuote;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !insideQuote) {
      if (char === '\r' && content[i + 1] === '\n') {
        i++; // skip \n in CRLF
      }
      if (currentLine.trim().length > 0) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }

  if (currentLine.trim().length > 0) {
    lines.push(currentLine);
  }

  if (lines.length === 0) return [];

  // Parse header
  const headers = parseCsvLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const row: Record<string, string> = {};

    for (let h = 0; h < headers.length; h++) {
      const headerKey = headers[h].trim();
      const val = values[h] !== undefined ? values[h].trim() : '';
      row[headerKey] = val;
    }

    records.push(row);
  }

  return records;
}

/**
 * Splits a single CSV row into individual cell strings.
 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let insideQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (insideQuote && line[i + 1] === '"') {
        cell += '"';
        i++; // skip escaped quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells;
}

/**
 * Reads all 11 CSV files in strictly read-only mode from the specified directory.
 * Returns parsed rows and SHA-256 hashes of the files without altering any disk data.
 */
export function readAllCsvTables(sourceDir: string): ParsedCsvDataset {
  const dataset: ParsedCsvDataset = {
    family_members: [],
    assets: [],
    fds: [],
    post_office: [],
    bullions: [],
    properties: [],
    rents: [],
    asset_sales: [],
    payments: [],
    documents: [],
    contributions: [],
    fileHashes: {}
  };

  for (const tableName of CSV_TABLE_FILES) {
    const filePath = path.join(sourceDir, `${tableName}.csv`);

    if (fs.existsSync(filePath)) {
      // Read strictly in read-only mode
      const rawBytes = fs.readFileSync(filePath);
      const sha256 = crypto.createHash('sha256').update(rawBytes).digest('hex');
      dataset.fileHashes[tableName] = sha256;

      const content = rawBytes.toString('utf8');
      dataset[tableName] = parseCsvContent(content);
    } else {
      dataset[tableName] = [];
      dataset.fileHashes[tableName] = '';
    }
  }

  return dataset;
}
