/**
 * Multi-base Airtable client. Symphony reads and writes across six bases.
 * The official airtable.js library is keyed per-base, so we maintain a cache
 * of base instances keyed by base ID.
 */

import Airtable from 'airtable';
import type { Base } from 'airtable';
import { logger } from '../logging/structured.js';

let apiKey: string | null = null;
const baseCache = new Map<string, Base>();

export function configureAirtable(key: string): void {
  apiKey = key;
  Airtable.configure({ apiKey: key });
}

export function getBase(baseId: string): Base {
  if (!apiKey) {
    throw new Error('Airtable not configured. Call configureAirtable() first.');
  }
  if (!baseCache.has(baseId)) {
    baseCache.set(baseId, Airtable.base(baseId));
  }
  return baseCache.get(baseId)!;
}

/**
 * Fetch a single record by ID from any base/table.
 */
export async function fetchRecord(
  baseId: string,
  tableId: string,
  recordId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const base = getBase(baseId);
    const record = await base(tableId).find(recordId);
    return record.fields as Record<string, unknown>;
  } catch (err) {
    logger.error({ err, baseId, tableId, recordId }, 'Failed to fetch record');
    return null;
  }
}

/**
 * Create a new record in any base/table. Returns the created record ID.
 */
export async function createRecord(
  baseId: string,
  tableId: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const base = getBase(baseId);
  const records = await base(tableId).create([{ fields: fields as never }]);
  if (!records[0]) {
    throw new Error('Airtable create returned no records');
  }
  return records[0].id;
}

/**
 * Update an existing record in any base/table.
 */
export async function updateRecord(
  baseId: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const base = getBase(baseId);
  await base(tableId).update([{ id: recordId, fields: fields as never }]);
}
