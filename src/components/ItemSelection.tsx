import { useState, useEffect, useRef } from 'react';
import { getInventoryItems } from '../lib/pocketbase';
import type { InventoryItem } from '../lib/supabase';
import { Search, Trash2, AlertTriangle } from 'lucide-react';

export type SelectedItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  available_stock: number;
};

type ItemSelectionProps = {
  onItemsChange: (items: SelectedItem[]) => void;
  initialItems?: SelectedItem[];
  transactionType?: 'inflow' | 'outflow';
};

export function ItemSelection({ onItemsChange, initialItems = [], transactionType = 'inflow' }: ItemSelectionProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>(initialItems);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchItems();
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  useEffect(() => {
    onItemsChange(selectedItems);
  }, [selectedItems, onItemsChange]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await getInventoryItems();
      setItems(data || []);
      setError('');
    } catch (e) {
      console.error('Error fetching inventory items:', e);
      setError('Failed to load items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (item: InventoryItem) => {
    // Check if item is already selected
    if (selectedItems.some(selected => selected.id === item.id)) {
      return;
    }
    
    setSelectedItems([...selectedItems, {
      id: item.id,
      name: item.name,
      sku: item.sku,
      quantity: 1,
      available_stock: item.quantity
    }]);
    
    setSearchTerm('');
    setShowDropdown(false);
    
    // Focus back on search input for quick addition of multiple items
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(item => item.id !== itemId));
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setSelectedItems(selectedItems.map(item => {
      if (item.id === itemId) {
        return { ...item, quantity };
      }
      return item;
    }));
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 p-3 rounded-md flex items-center text-red-800">
          <AlertTriangle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      {/* Item search and selection */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search items by name or SKU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="pl-10 pr-4 py-2 border rounded-l-md w-full"
            />
          </div>
        </div>
        
        {showDropdown && (
          <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg max-h-60 overflow-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading items...</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchTerm ? 'No items match your search' : 'No items available'}
              </div>
            ) : (
              <ul className="py-1">
                {filteredItems.map(item => (
                  <li 
                    key={item.id}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                    onClick={() => handleAddItem(item)}
                  >
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-500">SKU: {item.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm ${item.quantity === 0 ? 'text-red-600' : item.quantity <= item.reorder_level ? 'text-yellow-600' : 'text-green-600'}`}>
                        Stock: {item.quantity}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      
      {/* Selected items */}
      {selectedItems.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {selectedItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-gray-500">SKU: {item.sku}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => handleQuantityChange(item.id, Math.max(1, item.quantity - 1))}
                        className="bg-gray-200 px-2 py-1 rounded-l-md"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          if (!isNaN(value) && value >= 1) {
                            handleQuantityChange(item.id, value);
                          }
                        }}
                        className={`w-16 text-center border-t border-b py-1 ${
                          (transactionType === 'inflow' && item.quantity > item.available_stock) ? 'bg-red-50 text-red-700' : ''
                        }`}
                      />
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        className="bg-gray-200 px-2 py-1 rounded-r-md"
                      >
                        +
                      </button>
                    </div>
                    {transactionType === 'inflow' && item.quantity > item.available_stock && (
                      <div className="text-xs text-red-600 text-center mt-1">
                        Exceeds available stock ({item.available_stock})
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}