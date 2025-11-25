const PB_URL = import.meta.env.VITE_PB_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function fetchJson(path: string, options: RequestInit = {}) {
  const res = await fetch(`${PB_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PocketBase API error: ${res.status} ${text}`);
  }
  return res.json();
}

type ListOptions = {
  expand?: string;
  filter?: string;
  sort?: string;
  perPage?: number;
};

export async function listRecords(collection: string, options: ListOptions = {}) {
  const { expand, filter, sort, perPage = 200 } = options;
  const params = new URLSearchParams();
  params.set('perPage', String(perPage));
  if (expand) params.set('expand', String(expand));
  if (filter) params.set('filter', String(filter));
  if (sort) params.set('sort', String(sort));
  const path = `/api/collections/${collection}/records?${params.toString()}`;
  const json = await fetchJson(path);
  // PocketBase returns { items: [...], page, perPage, totalItems }
  return json.items || [];
}

export async function getRecord(collection: string, id: string, options: { expand?: string } = {}) {
  const { expand } = options;
  const params = expand ? `?expand=${encodeURIComponent(String(expand))}` : '';
  return fetchJson(`/api/collections/${collection}/records/${id}${params}`);
}

export async function createRecord(collection: string, data: any) {
  const path = `/api/collections/${collection}/records`;
  return fetchJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateRecord(collection: string, id: string, data: any) {
  const path = `/api/collections/${collection}/records/${id}`;
  return fetchJson(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// Upload a single file to an existing record's file field
export async function uploadFileToRecord(collection: string, recordId: string, fieldName: string, file: File) {
  const path = `/api/collections/${collection}/records/${recordId}/files/${fieldName}`;
  const fd = new FormData();
  fd.append('file', file, file.name);

  const res = await fetch(`${PB_URL}${path}`, { method: 'POST', body: fd });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`File upload error: ${res.status} ${text}`);
  }
  return res.json();
}

export function getFileUrl(collection: string, recordId: string, filename: string) {
  return `${PB_URL}/api/files/${collection}/${recordId}/${encodeURIComponent(filename)}`;
}

// High level helpers used by the app
export async function getInventoryItems() {
  return listRecords('inventory_items', { sort: 'name' });
}

export async function getInventoryTransactions(itemId: string) {
  return listRecords('inventory_transactions', { filter: `item_id=\"${itemId}\"`, sort: '-created_at' });
}

export async function createInventoryItem(data: any) {
  return createRecord('inventory_items', data);
}

export async function updateInventoryItem(id: string, data: any) {
  return updateRecord('inventory_items', id, data);
}

export async function createInventoryTransaction(data: any) {
  return createRecord('inventory_transactions', data);
}

export async function getContacts() {
  return listRecords('contacts', { sort: 'name' });
}

export async function getTransactions({ startDate, endDate, type, contactId, contactType }: any) {
  // Build filter - PocketBase filter syntax is similar to SQL WHERE clauses
  const filters: string[] = [];
  if (startDate) filters.push(`created_at >= \"${startDate}\"`);
  if (endDate) filters.push(`created_at <= \"${endDate}\"`);
  if (type && type !== 'all') filters.push(`type = \"${type}\"`);
  if (contactId && contactId !== 'all') filters.push(`contact_id = \"${contactId}\"`);
  if (contactType && contactType !== 'all') filters.push(`contact.type = \"${contactType}\"`);

  const filter = filters.length ? filters.join(' && ') : undefined;
  // expand contact relation
  return listRecords('transactions', { filter, sort: '-created_at', expand: 'contact,items' });
}

// Minimal storage-like interface to mimic supabase.storage.from(...)
export function storageFrom(bucket: string) {
  return {
    // For PocketBase we attach files to records on the target collection.
    // This helper attempts to keep a similar call shape used in the app.
    async upload(recordId: string, file: File) {
      // field name in inventory_items we'll assume is 'image'
      const fieldName = 'image';
      return uploadFileToRecord(bucket, recordId, fieldName, file);
    },
    getPublicUrl(recordId: string, filename: string) {
      return getFileUrl(bucket, recordId, filename);
    }
  };
}

export default {
  PB_URL,
  getInventoryItems,
  getInventoryTransactions,
  createInventoryItem,
  updateInventoryItem,
  createInventoryTransaction,
  getContacts,
  getTransactions,
  storageFrom,
};
