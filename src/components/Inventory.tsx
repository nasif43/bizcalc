import { useState, useEffect } from 'react';
import {
  getInventoryItems,
  getInventoryTransactions,
  createInventoryItem,
  updateInventoryItem,
  createInventoryTransaction,
  storageFrom,
  getRecord,
  getFileUrl,
} from '../lib/pocketbase';
import type { InventoryItem, InventoryTransaction } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  Package, Search, Plus, Edit, History, 
  ArrowUpDown, Download, RefreshCw,
  AlertTriangle, Check, X, ChevronLeft, ChevronRight, Loader
} from 'lucide-react';

type InventoryView = 'list' | 'create' | 'edit' | 'history';
type SortDirection = 'asc' | 'desc';
type SortField = 'name' | 'sku' | 'quantity' | 'unit_price' | 'reorder_level' | 'category' | 'updated_at';

export function Inventory() {
  // Main state
  const [view, setView] = useState<InventoryView>('list');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemTransactions, setItemTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState('');
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  
  // Form state
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: '',
    sku: '',
    quantity: 0,
    unit_price: 0,
    reorder_level: 0,
    category: '',
    description: ''
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Table state
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  
  // Stock adjustment state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustmentItem, setAdjustmentItem] = useState<InventoryItem | null>(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<number>(0);
  const [adjustmentNotes, setAdjustmentNotes] = useState('');

  // Derived state
  const categories = [...new Set(items.map(item => item.category).filter(Boolean))];
  const filteredItems = items.filter(item => {
    const matchesSearch = search === '' || 
      item.name.toLowerCase().includes(search.toLowerCase()) || 
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    
    const matchesStock = 
      stockFilter === 'all' || 
      (stockFilter === 'low' && item.quantity <= item.reorder_level && item.quantity > 0) ||
      (stockFilter === 'out' && item.quantity === 0);
    
    return matchesSearch && matchesCategory && matchesStock;
  });
  
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortField === 'name') {
      return sortDirection === 'asc' 
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    } else if (sortField === 'sku') {
      return sortDirection === 'asc'
        ? a.sku.localeCompare(b.sku)
        : b.sku.localeCompare(a.sku);
    } else if (sortField === 'quantity' || sortField === 'unit_price' || sortField === 'reorder_level') {
      return sortDirection === 'asc'
        ? a[sortField] - b[sortField]
        : b[sortField] - a[sortField];
    } else if (sortField === 'category') {
      const catA = a.category || '';
      const catB = b.category || '';
      return sortDirection === 'asc'
        ? catA.localeCompare(catB)
        : catB.localeCompare(catA);
    } else if (sortField === 'updated_at') {
      return sortDirection === 'asc'
        ? new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    return 0;
  });
  
  const paginatedItems = sortedItems.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  
  const totalPages = Math.ceil(filteredItems.length / rowsPerPage);

  // Effects
  useEffect(() => {
    fetchInventoryItems();
  }, []);
  
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Data fetching functions
  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      const data = await getInventoryItems();
      setItems(data || []);
      setError('');
    } catch (e) {
      console.error('Error fetching inventory items:', e);
      setError('Failed to load inventory items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchItemTransactions = async (itemId: string) => {
    try {
      setLoading(true);
      const data = await getInventoryTransactions(itemId);
      setItemTransactions(data || []);
      setError('');
    } catch (e) {
      console.error('Error fetching item transactions:', e);
      setError('Failed to load transaction history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Form handling functions
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!newItem.name || newItem.name.length < 3 || newItem.name.length > 50) {
      errors.name = 'Name must be between 3 and 50 characters';
    }
    
    if (!newItem.sku) {
      errors.sku = 'SKU is required';
    }
    
    if (newItem.quantity === undefined || newItem.quantity < 0) {
      errors.quantity = 'Quantity must be 0 or greater';
    }
    
    if (newItem.unit_price === undefined || newItem.unit_price < 0.01) {
      errors.unit_price = 'Unit price must be at least 0.01';
    }
    
    if (newItem.reorder_level === undefined || newItem.reorder_level < 0) {
      errors.reorder_level = 'Reorder level must be 0 or greater';
    }
    
    if (newItem.description && newItem.description.length > 500) {
      errors.description = 'Description must be 500 characters or less';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        setFormErrors(prev => ({
          ...prev,
          image: 'Only JPG and PNG images are allowed'
        }));
        return;
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setFormErrors(prev => ({
          ...prev,
          image: 'Image size must be less than 5MB'
        }));
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Clear any previous image errors
      const { image, ...restErrors } = formErrors;
      setFormErrors(restErrors);
    }
  };

  const generateSKU = () => {
    // Generate a SKU based on category and random numbers
    const category = newItem.category || 'ITEM';
    const prefix = category.substring(0, 3).toUpperCase();
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}${randomNum}`;
  };

  const handleCreateItem = async () => {
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      // Create the inventory item first (without image)
      const itemPayload: any = {
        name: newItem.name,
        sku: newItem.sku || generateSKU(),
        quantity: newItem.quantity || 0,
        unit_price: newItem.unit_price || 0,
        reorder_level: newItem.reorder_level || 0,
        category: newItem.category || null,
        description: newItem.description || null,
      };

      const created = await createInventoryItem(itemPayload);
      const createdId = created?.id;
      if (!createdId) throw new Error('Failed to create inventory item');

      // Upload image if selected and attach to the created record
      let imageUrl = null;
      if (selectedImage) {
        // upload to the inventory_items collection, file field 'image'
        const uploadResp = await storageFrom('inventory_items').upload(createdId, selectedImage);
        // uploadResp may include the updated record or file info; attempt to resolve filename
        let filename: string | undefined = uploadResp?.image?.[0];
        if (!filename) {
          const rec = await getRecord('inventory_items', createdId);
          filename = rec?.image?.[0];
        }
        if (filename) {
          imageUrl = getFileUrl('inventory_items', createdId, filename);
          // update record with image_url for compatibility with UI
          await updateInventoryItem(createdId, { image_url: imageUrl });
        }
      }

      // Create initial transaction record
      if (newItem.quantity && newItem.quantity > 0) {
        await createInventoryTransaction({
          item_id: createdId,
          quantity_change: newItem.quantity,
          previous_quantity: 0,
          new_quantity: newItem.quantity,
          transaction_type: 'initial',
          notes: 'Initial inventory'
        });
      }
      
      // Reset form and show success message
      setNewItem({
        name: '',
        sku: '',
        quantity: 0,
        unit_price: 0,
        reorder_level: 0,
        category: '',
        description: ''
      });
      setSelectedImage(null);
      setImagePreview(null);
      setFormErrors({});
      setView('list');
      setNotification({
        type: 'success',
        message: 'Item created successfully'
      });
      
      // Refresh inventory list
      fetchInventoryItems();
      
    } catch (e) {
      console.error('Error creating inventory item:', e);
      setNotification({
        type: 'error',
        message: e instanceof Error ? e.message : 'Failed to create item'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedItem || !validateForm()) return;
    
    try {
      setLoading(true);
      
      // Upload new image if selected
      let imageUrl = selectedItem.image_url;
      if (selectedImage) {
        const uploadResp = await storageFrom('inventory_items').upload(selectedItem.id, selectedImage);
        let filename: string | undefined = uploadResp?.image?.[0];
        if (!filename) {
          const rec = await getRecord('inventory_items', selectedItem.id);
          filename = rec?.image?.[0];
        }
        if (filename) {
          imageUrl = getFileUrl('inventory_items', selectedItem.id, filename);
        }
      }
      
      // Check if quantity changed
      const quantityChanged = newItem.quantity !== selectedItem.quantity;
      const oldQuantity = selectedItem.quantity;
      const newQuantity = newItem.quantity || 0;
      
      // Update the inventory item
      await updateInventoryItem(selectedItem.id, {
        name: newItem.name,
        sku: newItem.sku,
        quantity: newItem.quantity,
        unit_price: newItem.unit_price,
        reorder_level: newItem.reorder_level,
        category: newItem.category || null,
        description: newItem.description || null,
        image_url: imageUrl
      });
      
      // Create transaction record if quantity changed
      if (quantityChanged) {
        await createInventoryTransaction({
          item_id: selectedItem.id,
          quantity_change: newQuantity - oldQuantity,
          previous_quantity: oldQuantity,
          new_quantity: newQuantity,
          transaction_type: 'adjustment',
          notes: 'Manual adjustment'
        });
      }
      
      // Reset form and show success message
      setSelectedItem(null);
      setNewItem({
        name: '',
        sku: '',
        quantity: 0,
        unit_price: 0,
        reorder_level: 0,
        category: '',
        description: ''
      });
      setSelectedImage(null);
      setImagePreview(null);
      setFormErrors({});
      setView('list');
      setNotification({
        type: 'success',
        message: 'Item updated successfully'
      });
      
      // Refresh inventory list
      fetchInventoryItems();
      
    } catch (e) {
      console.error('Error updating inventory item:', e);
      setNotification({
        type: 'error',
        message: e instanceof Error ? e.message : 'Failed to update item'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustStock = async () => {
    if (!adjustmentItem || adjustmentQuantity === 0) return;
    
    try {
      setLoading(true);
      
      const previousQuantity = adjustmentItem.quantity;
      const newQuantity = previousQuantity + adjustmentQuantity;
      
      if (newQuantity < 0) {
        throw new Error('Cannot reduce stock below zero');
      }
      
      // Update item quantity
      await updateInventoryItem(adjustmentItem.id, { quantity: newQuantity });

      // Create transaction record
      await createInventoryTransaction({
        item_id: adjustmentItem.id,
        quantity_change: adjustmentQuantity,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        transaction_type: adjustmentQuantity > 0 ? 'restock' : 'adjustment',
        notes: adjustmentNotes || (adjustmentQuantity > 0 ? 'Restock' : 'Reduction')
      });
      
      // Reset adjustment state
      setAdjustmentItem(null);
      setAdjustmentQuantity(0);
      setAdjustmentNotes('');
      setShowAdjustModal(false);
      setNotification({
        type: 'success',
        message: 'Stock adjusted successfully'
      });
      
      // Refresh inventory list
      fetchInventoryItems();
      
    } catch (e) {
      console.error('Error adjusting stock:', e);
      setNotification({
        type: 'error',
        message: e instanceof Error ? e.message : 'Failed to adjust stock'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setNewItem({
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unit_price,
      reorder_level: item.reorder_level,
      category: item.category || '',
      description: item.description || ''
    });
    setImagePreview(item.image_url || null);
    setView('edit');
  };

  const handleViewHistory = (item: InventoryItem) => {
    setSelectedItem(item);
    fetchItemTransactions(item.id);
    setView('history');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const exportCSV = () => {
    // Create CSV content
    const headers = ['Name', 'SKU', 'Quantity', 'Unit Price', 'Reorder Level', 'Category', 'Last Updated'];
    const rows = filteredItems.map(item => [
      item.name,
      item.sku,
      item.quantity.toString(),
      item.unit_price.toString(),
      item.reorder_level.toString(),
      item.category || '',
      new Date(item.updated_at).toLocaleString()
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render functions
  const renderInventoryList = () => {
    return (
      <div className="flex flex-col h-full">
        {/* Header with actions */}
        <div className="bg-white p-4 shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center">
            <h1 className="text-xl font-bold">Inventory Management</h1>
            <div className="ml-4 flex items-center">
              <button
                onClick={() => {
                  setNewItem({
                    name: '',
                    sku: '',
                    quantity: 0,
                    unit_price: 0,
                    reorder_level: 0,
                    category: '',
                    description: ''
                  });
                  setSelectedImage(null);
                  setImagePreview(null);
                  setFormErrors({});
                  setView('create');
                }}
                className="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 flex items-center"
              >
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
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-md w-full sm:w-64"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border rounded-md px-2 py-2"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as 'all' | 'low' | 'out')}
                className="border rounded-md px-2 py-2"
              >
                <option value="all">All Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
              
              <button
                onClick={exportCSV}
                className="bg-gray-100 p-2 rounded-md hover:bg-gray-200"
                title="Export to CSV"
              >
                <Download size={18} />
              </button>
              
              <button
                onClick={fetchInventoryItems}
                className="bg-gray-100 p-2 rounded-md hover:bg-gray-200"
                title="Refresh"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Notification */}
        {notification && (
          <div className={`p-3 ${notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} flex items-center justify-between`}>
            <div className="flex items-center">
              {notification.type === 'success' ? <Check size={18} className="mr-2" /> : <AlertTriangle size={18} className="mr-2" />}
              {notification.message}
            </div>
            <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
        )}
        
        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader size={24} className="animate-spin mr-2" />
              <span>Loading inventory...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Package size={48} className="mb-4" />
              {search || categoryFilter !== 'all' || stockFilter !== 'all' ? (
                <p>No items match your search criteria</p>
              ) : (
                <>
                  <p className="text-xl mb-2">No inventory items found</p>
                  <p>Click "Add Item" to create your first inventory item</p>
                </>
              )}
            </div>
          ) : (
            <div className="min-w-full bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Name
                        {sortField === 'name' && (
                          <ArrowUpDown size={14} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('sku')}
                    >
                      <div className="flex items-center">
                        SKU
                        {sortField === 'sku' && (
                          <ArrowUpDown size={14} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('quantity')}
                    >
                      <div className="flex items-center justify-end">
                        Quantity
                        {sortField === 'quantity' && (
                          <ArrowUpDown size={14} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('unit_price')}
                    >
                      <div className="flex items-center justify-end">
                        Unit Price
                        {sortField === 'unit_price' && (
                          <ArrowUpDown size={14} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center">
                        Category
                        {sortField === 'category' && (
                          <ArrowUpDown size={14} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('updated_at')}
                    >
                      <div className="flex items-center">
                        Last Updated
                        {sortField === 'updated_at' && (
                          <ArrowUpDown size={14} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {item.image_url ? (
                            <img 
                              src={item.image_url} 
                              alt={item.name} 
                              className="h-10 w-10 rounded-full object-cover mr-3"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                              <Package size={20} className="text-gray-500" />
                            </div>
                          )}
                          <div className="font-medium text-gray-900">{item.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        <span className={
                          item.quantity === 0 ? 'text-red-600' :
                          item.quantity <= item.reorder_level ? 'text-yellow-600' :
                          'text-green-600'
                        }>
                          {item.quantity}
                        </span>
                        {item.quantity <= item.reorder_level && item.quantity > 0 && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Low
                          </span>
                        )}
                        {item.quantity === 0 && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Out
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.category || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(item.updated_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => {
                              setAdjustmentItem(item);
                              setAdjustmentQuantity(0);
                              setAdjustmentNotes('');
                              setShowAdjustModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="Adjust Stock"
                          >
                            <RefreshCw size={18} />
                          </button>
                          <button
                            onClick={() => handleEditItem(item)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit Item"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleViewHistory(item)}
                            className="text-green-600 hover:text-green-900"
                            title="View History"
                          >
                            <History size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {filteredItems.length > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(currentPage - 1) * rowsPerPage + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * rowsPerPage, filteredItems.length)}
                  </span>{' '}
                  of <span className="font-medium">{filteredItems.length}</span> results
                </p>
              </div>
              <div>
                <div className="flex items-center">
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="mr-4 border-gray-300 rounded-md text-sm"
                  >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                  
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="sr-only">Previous</span>
                      <ChevronLeft size={18} />
                    </button>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNum
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="sr-only">Next</span>
                      <ChevronRight size={18} />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Stock Adjustment Modal */}
        {showAdjustModal && adjustmentItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Adjust Stock</h2>
                <button
                  onClick={() => setShowAdjustModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Item
                  </label>
                  <div className="mt-1 flex items-center">
                    {adjustmentItem.image_url ? (
                      <img 
                        src={adjustmentItem.image_url} 
                        alt={adjustmentItem.name} 
                        className="h-10 w-10 rounded-full object-cover mr-3"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                        <Package size={20} className="text-gray-500" />
                      </div>
                    )}
                    <span className="font-medium">{adjustmentItem.name}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Current Stock
                  </label>
                  <div className="mt-1 text-lg font-semibold">
                    {adjustmentItem.quantity}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Adjustment
                  </label>
                  <div className="mt-1 flex items-center">
                    <button
                      onClick={() => setAdjustmentQuantity(prev => prev - 1)}
                      className="bg-gray-200 p-2 rounded-l-md"
                      disabled={adjustmentItem.quantity + adjustmentQuantity - 1 < 0}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={adjustmentQuantity}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && adjustmentItem.quantity + value >= 0) {
                          setAdjustmentQuantity(value);
                        }
                      }}
                      className="text-center border-t border-b p-2 w-20"
                    />
                    <button
                      onClick={() => setAdjustmentQuantity(prev => prev + 1)}
                      className="bg-gray-200 p-2 rounded-r-md"
                    >
                      +
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {adjustmentQuantity > 0 ? 'Adding' : adjustmentQuantity < 0 ? 'Removing' : 'No change'} {Math.abs(adjustmentQuantity)} units
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    New Stock Level
                  </label>
                  <div className="mt-1 text-lg font-semibold">
                    {adjustmentItem.quantity + adjustmentQuantity}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={adjustmentNotes}
                    onChange={(e) => setAdjustmentNotes(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowAdjustModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdjustStock}
                    disabled={adjustmentQuantity === 0 || loading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCreateForm = () => {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        {/* Header */}
        <div className="bg-white p-4 shadow flex items-center">
          <button
            onClick={() => setView('list')}
            className="mr-4 text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Add New Inventory Item</h1>
        </div>
        
        {/* Form */}
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newItem.name || ''}
                    onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                    className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      formErrors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter item name"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    SKU <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <input
                      type="text"
                      value={newItem.sku || ''}
                      onChange={(e) => setNewItem(prev => ({ ...prev, sku: e.target.value }))}
                      className={`block w-full rounded-l-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                        formErrors.sku ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter SKU"
                    />
                    <button
                      type="button"
                      onClick={() => setNewItem(prev => ({ ...prev, sku: generateSKU() }))}
                      className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-md hover:bg-gray-100"
                    >
                      Generate
                    </button>
                  </div>
                  {formErrors.sku && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.sku}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newItem.category || ''}
                    onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter category"
                    list="categories"
                  />
                  <datalist id="categories">
                    {categories.map(category => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={newItem.description || ''}
                    onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      formErrors.description ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter item description"
                  />
                  {formErrors.description && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    {(newItem.description?.length || 0)}/500 characters
                  </p>
                </div>
              </div>
              
              {/* Right column */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Initial Quantity
                  </label>
                  <input
                    type="number"
                    value={newItem.quantity || 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        setNewItem(prev => ({ ...prev, quantity: value }));
                      }
                    }}
                    min="0"
                    className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      formErrors.quantity ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.quantity && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.quantity}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Unit Price
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      value={newItem.unit_price || 0}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0) {
                          setNewItem(prev => ({ ...prev, unit_price: value }));
                        }
                      }}
                      min="0"
                      step="0.01"
                      className={`pl-7 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                        formErrors.unit_price ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {formErrors.unit_price && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.unit_price}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    value={newItem.reorder_level || 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        setNewItem(prev => ({ ...prev, reorder_level: value }));
                      }
                    }}
                    min="0"
                    className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      formErrors.reorder_level ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.reorder_level && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.reorder_level}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    You'll be notified when stock falls below this level
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Item Image
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    {imagePreview ? (
                      <div className="text-center">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="mx-auto h-32 object-contain mb-2" 
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImage(null);
                            setImagePreview(null);
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1 text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                          aria-hidden="true"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="flex text-sm text-gray-600">
                          <label
                            htmlFor="file-upload"
                            className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                          >
                            <span>Upload a file</span>
                            <input
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              className="sr-only"
                              accept="image/jpeg,image/png"
                              onChange={handleImageChange}
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                      </div>
                    )}
                  </div>
                  {formErrors.image && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.image}</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Form actions */}
            <div className="mt-8 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setView('list')}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateItem}
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center">
                    <Loader size={16} className="animate-spin mr-2" />
                    Creating...
                  </span>
                ) : (
                  'Create Item'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEditForm = () => {
    if (!selectedItem) return null;
    
    return (
      <div className="flex flex-col h-full bg-gray-50">
        {/* Header */}
        <div className="bg-white p-4 shadow flex items-center">
          <button
            onClick={() => setView('list')}
            className="mr-4 text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Edit Inventory Item</h1>
        </div>
        
        {/* Form */}
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newItem.name || ''}
                    onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                    className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      formErrors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter item name"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newItem.sku || ''}
                    onChange={(e) => setNewItem(prev => ({ ...prev, sku: e.target.value }))}
                    className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      formErrors.sku ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter SKU"
                  />
                  {formErrors.sku && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.sku}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newItem.category || ''}
                    onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter category"
                    list="categories"
                  />
                  <datalist id="categories">
                    {categories.map(category => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={newItem.description || ''}
                    onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      formErrors.description ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter item description"
                  />
                  {formErrors.description && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    {(newItem.description?.length || 0)}/500 characters
                  </p>
                </div>
              </div>
              
              {/* Right column */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={newItem.quantity || 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        setNewItem(prev => ({ ...prev, quantity: value }));
                      }
                    }}
                    min="0"
                    className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      formErrors.quantity ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.quantity && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.quantity}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Unit Price
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      value={newItem.unit_price || 0}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0) {
                          setNewItem(prev => ({ ...prev, unit_price: value }));
                        }
                      }}
                      min="0"
                      step="0.01"
                      className={`pl-7 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                        formErrors.unit_price ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {formErrors.unit_price && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.unit_price}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    value={newItem.reorder_level || 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        setNewItem(prev => ({ ...prev, reorder_level: value }));
                      }
                    }}
                    min="0"
                    className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      formErrors.reorder_level ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.reorder_level && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.reorder_level}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    You'll be notified when stock falls below this level
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Item Image
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    {imagePreview ? (
                      <div className="text-center">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="mx-auto h-32 object-contain mb-2" 
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImage(null);
                            setImagePreview(null);
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1 text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                          aria-hidden="true"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="flex text-sm text-gray-600">
                          <label
                            htmlFor="file-upload"
                            className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                          >
                            <span>Upload a file</span>
                            <input
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              className="sr-only"
                              accept="image/jpeg,image/png"
                              onChange={handleImageChange}
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                      </div>
                    )}
                  </div>
                  {formErrors.image && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.image}</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Form actions */}
            <div className="mt-8 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setView('list')}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateItem}
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center">
                    <Loader size={16} className="animate-spin mr-2" />
                    Updating...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryView = () => {
    if (!selectedItem) return null;
    
    return (
      <div className="flex flex-col h-full bg-gray-50">
        {/* Header */}
        <div className="bg-white p-4 shadow flex items-center">
          <button
            onClick={() => setView('list')}
            className="mr-4 text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Stock History</h1>
        </div>
        
        {/* Item details */}
        <div className="bg-white border-b p-4">
          <div className="flex items-center">
            {selectedItem.image_url ? (
              <img 
                src={selectedItem.image_url} 
                alt={selectedItem.name} 
                className="h-16 w-16 rounded-full object-cover mr-4"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center mr-4">
                <Package size={24} className="text-gray-500" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">{selectedItem.name}</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1 text-sm text-gray-500">
                <div>SKU: <span className="font-medium">{selectedItem.sku}</span></div>
                <div>Current Stock: <span className="font-medium">{selectedItem.quantity}</span></div>
                <div>Unit Price: <span className="font-medium">{formatCurrency(selectedItem.unit_price)}</span></div>
                <div>Reorder Level: <span className="font-medium">{selectedItem.reorder_level}</span></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Transaction history */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader size={24} className="animate-spin mr-2" />
              <span>Loading history...</span>
            </div>
          ) : itemTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <History size={48} className="mb-4" />
              <p>No transaction history found for this item</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Change
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Previous
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      New
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {itemTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(transaction.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          transaction.transaction_type === 'initial' ? 'bg-blue-100 text-blue-800' :
                          transaction.transaction_type === 'restock' ? 'bg-green-100 text-green-800' :
                          transaction.transaction_type === 'adjustment' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {transaction.transaction_type.charAt(0).toUpperCase() + transaction.transaction_type.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        <span className={transaction.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}>
                          {transaction.quantity_change > 0 ? '+' : ''}{transaction.quantity_change}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {transaction.previous_quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {transaction.new_quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {view === 'list' && renderInventoryList()}
      {view === 'create' && renderCreateForm()}
      {view === 'edit' && renderEditForm()}
      {view === 'history' && renderHistoryView()}
    </div>
  );
}