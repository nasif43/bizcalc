// UI-only adjust modal
import { Package, X } from 'lucide-react';
import type { InventoryItem } from '../../lib/types';

type Props = {
  open: boolean;
  item: InventoryItem | null;
  quantity: number;
  notes: string;
  onClose: () => void;
  onChangeQuantity: (q: number) => void;
  onChangeNotes: (n: string) => void;
  onSave: () => void;
  loading: boolean;
};

export function AdjustModal({ open, item, quantity, notes, onClose, onChangeQuantity, onChangeNotes, onSave, loading }: Props) {
  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Adjust Stock</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Item</label>
            <div className="mt-1 flex items-center">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="h-10 w-10 rounded-full object-cover mr-3" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3"><Package size={20} className="text-gray-500" /></div>
              )}
              <span className="font-medium">{item.name}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Current Stock</label>
            <div className="mt-1 text-lg font-semibold">{item.quantity}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Adjustment</label>
            <div className="mt-1 flex items-center">
              <button onClick={() => onChangeQuantity(quantity - 1)} className="bg-gray-200 p-2 rounded-l-md">-</button>
              <input type="number" value={quantity} onChange={(e) => onChangeQuantity(parseInt(e.target.value || '0'))} className="text-center border-t border-b p-2 w-20" />
              <button onClick={() => onChangeQuantity(quantity + 1)} className="bg-gray-200 p-2 rounded-r-md">+</button>
            </div>
            <p className="mt-1 text-sm text-gray-500">{quantity > 0 ? 'Adding' : quantity < 0 ? 'Removing' : 'No change'} {Math.abs(quantity)} units</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">New Stock Level</label>
            <div className="mt-1 text-lg font-semibold">{item.quantity + quantity}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
            <textarea value={notes} onChange={(e) => onChangeNotes(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" rows={2} />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
            <button onClick={onSave} disabled={loading} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{loading ? 'Processing...' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdjustModal;
