// UI-only header for inventory list
import { Download, RefreshCw, Plus, Search } from 'lucide-react';

type Props = {
  search: string;
  onSearch: (v: string) => void;
  categories: string[];
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  stockFilter: 'all' | 'low' | 'out';
  onStockFilterChange: (v: 'all' | 'low' | 'out') => void;
  onAdd: () => void;
  onExport: () => void;
  onRefresh: () => void;
};

export function InventoryHeader({ search, onSearch, categories, categoryFilter, onCategoryChange, stockFilter, onStockFilterChange, onAdd, onExport, onRefresh }: Props) {
  return (
    <div className="bg-white p-4 shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex items-center">
        <h1 className="text-xl font-bold">Inventory Management</h1>
        <div className="ml-4 flex items-center">
          <button onClick={onAdd} className="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 flex items-center">
            <Plus size={18} className="mr-1" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-md w-full sm:w-64"
          />
        </div>

        <div className="flex gap-2">
          <select value={categoryFilter} onChange={(e) => onCategoryChange(e.target.value)} className="border rounded-md px-2 py-2">
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <select value={stockFilter} onChange={(e) => onStockFilterChange(e.target.value as any)} className="border rounded-md px-2 py-2">
            <option value="all">All Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>

          <button onClick={onExport} className="bg-gray-100 p-2 rounded-md hover:bg-gray-200" title="Export to CSV"><Download size={18} /></button>
          <button onClick={onRefresh} className="bg-gray-100 p-2 rounded-md hover:bg-gray-200" title="Refresh"><RefreshCw size={18} /></button>
        </div>
      </div>
    </div>
  );
}

export default InventoryHeader;
