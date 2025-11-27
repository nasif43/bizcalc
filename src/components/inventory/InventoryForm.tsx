import React from 'react';
import { ChevronLeft } from 'lucide-react';
import type { InventoryItem } from '../../lib/types';

type Props = {
  isEdit: boolean;
  newItem: Partial<InventoryItem>;
  setNewItem: (v: Partial<InventoryItem>) => void;
  formErrors: Record<string, string>;
  imagePreview: string | null;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancel: () => void;
  onSubmit: () => void;
  generateSKU: () => string;
  loading: boolean;
};

export function InventoryForm({ isEdit, newItem, setNewItem, formErrors, imagePreview, onImageChange, onCancel, onSubmit, generateSKU, loading }: Props) {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white p-4 shadow flex items-center">
        <button onClick={onCancel} className="mr-4 text-gray-500 hover:text-gray-700"><ChevronLeft size={24} /></button>
        <h1 className="text-xl font-bold">{isEdit ? 'Edit Inventory Item' : 'Add New Inventory Item'}</h1>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Item Name <span className="text-red-500">*</span></label>
                <input type="text" value={newItem.name || ''} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${formErrors.name ? 'border-red-300' : 'border-gray-300'}`} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">SKU</label>
                <div className="mt-1 flex">
                  <input type="text" value={newItem.sku || ''} onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })} className={`block w-full rounded-l-md border-gray-300`} />
                  <button onClick={() => setNewItem({ ...newItem, sku: generateSKU() })} className="px-3 bg-gray-100 rounded-r-md">Gen</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity</label>
                <input type="number" value={newItem.quantity ?? 0} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Unit Price</label>
                <input type="number" step="0.01" value={newItem.unit_price ?? 0} onChange={(e) => setNewItem({ ...newItem, unit_price: Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Reorder Level</label>
                <input type="number" value={newItem.reorder_level ?? 0} onChange={(e) => setNewItem({ ...newItem, reorder_level: Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300" />
              </div>

            </div>

            {/* Right column */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <input type="text" value={newItem.category || ''} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea value={newItem.description || ''} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300" rows={6} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Image</label>
                <input type="file" accept="image/*" onChange={onImageChange} className="mt-1 block w-full" />
                {imagePreview && <img src={imagePreview} alt="Preview" className="mt-2 h-28 object-contain" />}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                <button onClick={onSubmit} disabled={loading} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{loading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Item')}</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default InventoryForm;
