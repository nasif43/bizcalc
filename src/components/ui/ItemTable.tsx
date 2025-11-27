import React from 'react';
import { formatCurrency } from '../../lib/utils';

type ItemRow = {
  item_id?: string;
  item_name?: string;
  name?: string;
  sku?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
};

type ItemTableProps = {
  items: ItemRow[];
};

export function ItemTable({ items }: ItemTableProps) {
  return (
    <table className="min-w-full">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, idx) => (
          <tr key={it.item_id || it.item_name || idx}>
            <td className="px-4 py-2 text-sm text-gray-900">{it.item_name ?? it.name ?? 'Unnamed Item'}</td>
            <td className="px-4 py-2 text-sm text-right text-gray-900">{it.quantity ?? 0}</td>
            <td className="px-4 py-2 text-sm text-right text-gray-900">{formatCurrency(it.unit_price ?? 0)}</td>
            <td className="px-4 py-2 text-sm text-right text-gray-900">{formatCurrency(it.total_price ?? 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ItemTable;
