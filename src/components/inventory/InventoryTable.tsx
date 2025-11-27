// UI-only inventory table
import { formatCurrency } from '../../lib/utils';
import { Package, Edit, RefreshCw, History } from 'lucide-react';
import type { InventoryItem } from '../../lib/types';

type Props = {
  paginatedItems: InventoryItem[];
  handleSort: (f: any) => void;
  formatDate: (d: string) => string;
  onAdjust: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onViewHistory: (item: InventoryItem) => void;
};

export function InventoryTable({ paginatedItems, handleSort, formatDate, onAdjust, onEdit, onViewHistory }: Props) {
  return (
    <div className="min-w-full bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('name')}>
              <div className="flex items-center">Name</div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('sku')}>
              <div className="flex items-center">SKU</div>
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('quantity')}>
              <div className="flex items-center justify-end">Quantity</div>
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('unit_price')}>
              <div className="flex items-center justify-end">Unit Price</div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('category')}>
              <div className="flex items-center">Category</div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('updated_at')}>
              <div className="flex items-center">Last Updated</div>
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {paginatedItems.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-10 w-10 rounded-full object-cover mr-3" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                      <Package size={20} className="text-gray-500" />
                    </div>
                  )}
                  <div className="font-medium text-gray-900">{item.name}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.sku}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                <span className={
                  item.quantity === 0 ? 'text-red-600' : item.quantity <= item.reorder_level ? 'text-yellow-600' : 'text-green-600'
                }>
                  {item.quantity}
                </span>
                {item.quantity <= item.reorder_level && item.quantity > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Low</span>
                )}
                {item.quantity === 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Out</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatCurrency(item.unit_price)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.category || '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(item.updated_at)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <button onClick={() => onAdjust(item)} className="text-blue-600 hover:text-blue-900" title="Adjust Stock"><RefreshCw size={18} /></button>
                  <button onClick={() => onEdit(item)} className="text-indigo-600 hover:text-indigo-900" title="Edit Item"><Edit size={18} /></button>
                  <button onClick={() => onViewHistory(item)} className="text-green-600 hover:text-green-900" title="View History"><History size={18} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default InventoryTable;
