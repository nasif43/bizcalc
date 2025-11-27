const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function fetchJson(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error: ${res.status} ${text}`);
  }
  return res.json();
}

export async function listRecords(collection: string, params: Record<string, string | number | undefined> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) search.set(k, String(v)); });
  const path = `/api/collections/${collection}/records?${search.toString()}`;
  const json = await fetchJson(path);
  return json.items || [];
}

export async function getRecord(collection: string, id: string, options: { expand?: string } = {}) {
  const params = options.expand ? `?expand=${encodeURIComponent(options.expand)}` : '';
  return fetchJson(`/api/collections/${collection}/records/${id}${params}`);
}

export async function createRecord(collection: string, data: any) {
  return fetchJson(`/api/collections/${collection}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateRecord(collection: string, id: string, data: any) {
  return fetchJson(`/api/collections/${collection}/records/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function uploadFileToRecord(collection: string, recordId: string, fieldName: string, file: File) {
  const path = `/api/collections/${collection}/records/${recordId}/files/${fieldName}`;
  const fd = new FormData();
  fd.append('file', file, file.name);
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', body: fd });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`File upload error: ${res.status} ${text}`);
  }
  return res.json();
}

export function getFileUrl(collection: string, recordId: string, filename: string) {
  return `${API_URL}/api/files/${collection}/${recordId}/${encodeURIComponent(filename)}`;
}

// High-level helpers (same names as previous pocketbase.ts to ease migration)
export async function getInventoryItems() { return listRecords('inventory_items', { sort: 'name' }); }
export async function getInventoryTransactions(itemId: string) { return listRecords('inventory_transactions', { filter: `item_id=\"${itemId}\"`, sort: '-created_at' }); }
export async function createInventoryItem(data: any) { return createRecord('inventory_items', data); }
export async function updateInventoryItem(id: string, data: any) { return updateRecord('inventory_items', id, data); }
export async function createInventoryTransaction(data: any) { return createRecord('inventory_transactions', data); }
export async function getContacts() { return listRecords('contacts', { sort: 'name' }); }
export async function getTransactions(filters: any = {}) {
  // build simple query params: expand=contact,items and filters applied as a filter param
  const params: any = { sort: '-created_at', expand: 'contact,items' };
  if (filters.perPage) params.perPage = filters.perPage;
  return listRecords('transactions', params);
}
export async function uploadToRecord(collection: string, recordId: string, fieldName: string, file: File) {
  return uploadFileToRecord(collection, recordId, fieldName, file);
}

export default {
  getInventoryItems,
  getInventoryTransactions,
  createInventoryItem,
  updateInventoryItem,
  createInventoryTransaction,
  getContacts,
  getTransactions,
  getRecord,
  createRecord,
  updateRecord,
  uploadToRecord,
  getFileUrl,
};
