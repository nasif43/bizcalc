import React, { useState, useEffect } from 'react';
import { getContacts, getTransactions } from '../lib/pocketbase';
import type { Transaction, Contact } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Calendar, Search, Filter, Image as ImageIcon, LayoutDashboard, List } from 'lucide-react';

export function Ledger() {
  const [transactions, setTransactions] = useState<(Transaction & { contact: Contact; items?: any[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [, setError] = useState('');
  const [view, setView] = useState<'list' | 'dashboard'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    type: 'all' as 'all' | 'inflow' | 'outflow',
    contactType: 'all' as 'all' | 'customer' | 'supplier',
    contactId: 'all',
  });
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    fetchContacts();
    fetchTransactions();
  }, [filters]);

  const fetchContacts = async () => {
    try {
      const data = await getContacts();
      setContacts(data || []);
    } catch (e) {
      console.error('Error fetching contacts:', e);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await getTransactions(filters);
      setTransactions(data || []);
      setError('');
    } catch (e) {
      console.error('Error fetching transactions:', e);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    return transactions.reduce(
      (acc, curr) => {
        if (curr.type === 'inflow') {
          acc.totalInflow += curr.amount;
          acc.totalDueInflow += curr.due_amount;
          acc.totalPaidInflow += curr.paid_amount;
        } else {
          acc.totalOutflow += curr.amount;
          acc.totalDueOutflow += curr.due_amount;
          acc.totalPaidOutflow += curr.paid_amount;
        }
        return acc;
      },
      { 
        totalInflow: 0, 
        totalOutflow: 0, 
        totalDueInflow: 0, 
        totalDueOutflow: 0,
        totalPaidInflow: 0,
        totalPaidOutflow: 0
      }
    );
  };

  const handleRowClick = (transactionId: string, event: React.MouseEvent) => {
    // Prevent expansion if clicking on a button or link
    if ((event.target as HTMLElement).tagName === 'BUTTON') return;
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const calculateTodaysTotals = () => {
    const today = new Date().toISOString().split('T')[0];
    const todaysTransactions = transactions.filter(
      t => t.created_at.split('T')[0] === today
    );

    return todaysTransactions.reduce(
      (acc, curr) => {
        if (curr.type === 'inflow') {
          acc.debit += curr.amount;
          acc.totalPaid += curr.paid_amount;
        } else {
          acc.credit += curr.amount;
          acc.totalPaid -= curr.paid_amount;
        }
        return acc;
      },
      { debit: 0, credit: 0, totalPaid: 0 }
    );
  };

  const totals = calculateTotals();
  const todaysTotals = calculateTodaysTotals();

  return (
    <div className="flex-1 bg-gray-50 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden">
            <img 
              src={selectedImage} 
              alt="Transaction attachment" 
              className="w-full h-full object-contain"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-lg"
            >
              <ImageIcon size={24} className="text-gray-600" />
            </button>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="bg-white p-4 shadow flex justify-between items-center">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="md:hidden mr-2 p-2 bg-gray-200 rounded hover:bg-gray-300"
          title={showFilters ? 'Hide Filters' : 'Show Filters'}
        >
          <Filter size={20} />
        </button>
        <div className={`overflow-hidden transition-all duration-300 flex-1 ${showFilters ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} md:max-h-none md:opacity-100`}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={16} className="inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={16} className="inline mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Filter size={16} className="inline mr-1" />
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="inflow">Inflow</option>
              <option value="outflow">Outflow</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Search size={16} className="inline mr-1" />
              Contact Type
            </label>
            <select
              value={filters.contactType}
              onChange={(e) => setFilters(prev => ({ ...prev, contactType: e.target.value as any }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="customer">Customers</option>
              <option value="supplier">Suppliers</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Search size={16} className="inline mr-1" />
              Contact
            </label>
            <select
              value={filters.contactId}
              onChange={(e) => setFilters(prev => ({ ...prev, contactId: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All</option>
              {contacts.map(contact => (
                <option key={contact.id} value={contact.id}>{contact.name}</option>
              ))}
            </select>
          </div>
        </div>
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={() => setView('list')}
            className={`p-2 rounded-md ${view === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            <List size={24} />
          </button>
          <button
            onClick={() => setView('dashboard')}
            className={`p-2 rounded-md ${view === 'dashboard' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            <LayoutDashboard size={24} />
          </button>
        </div>
      </div>
      
      {view === 'dashboard' ? (
        /* Today's Business Dashboard */
        <div className="flex-1 p-4 overflow-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Today's Business Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-green-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-green-800 mb-2">Total Debit</h3>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(todaysTotals.debit)}</p>
              </div>
              <div className="bg-red-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-red-800 mb-2">Total Credit</h3>
                <p className="text-3xl font-bold text-red-600">{formatCurrency(todaysTotals.credit)}</p>
              </div>
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">Net Cash Flow</h3>
                <p className="text-3xl font- bold text-blue-600">{formatCurrency(todaysTotals.totalPaid)}</p>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-4">Today's Transactions</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Due</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions
                      .filter(t => t.created_at.split('T')[0] === new Date().toISOString().split('T')[0])
                      .map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(transaction.created_at).toLocaleTimeString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              transaction.type === 'inflow' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.type === 'inflow' ? 'Sale' : 'Purchase'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.contact.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                            {formatCurrency(transaction.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                            {formatCurrency(transaction.paid_amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                            {formatCurrency(transaction.due_amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {transaction.image_url ? (
                              <button
                                onClick={() => setSelectedImage(transaction.image_url!)}
                                className="text-blue-500 hover:text-blue-700"
                              >
                                <ImageIcon size={20} />
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
                {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-800">Total Inflow</h3>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalInflow)}</p>
          <p className="text-sm text-green-700">Due: {formatCurrency(totals.totalDueInflow)}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-red-800">Total Outflow</h3>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.totalOutflow)}</p>
          <p className="text-sm text-red-700">Due: {formatCurrency(totals.totalDueOutflow)}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800">Net Flow</h3>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(totals.totalInflow - totals.totalOutflow)}
          </p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-800">Total Due</h3>
          <p className="text-2xl font-bold text-yellow-600">
            {formatCurrency(totals.totalDueInflow + totals.totalDueOutflow)}
          </p>
        </div>
      </div>
        
        <div className="flex-1 overflow-auto p-4" style={{ maxHeight: 'calc(100vh - 250px)' }}>
          <div className="min-w-full bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Due</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    <>
                      {transactions.map((transaction) => (
                        <React.Fragment key={transaction.id}>
                          <tr onClick={(e) => handleRowClick(transaction.id, e)} className="cursor-pointer hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(transaction.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                transaction.type === 'inflow' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {transaction.type === 'inflow' ? 'Sale' : 'Purchase'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {transaction.contact.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                              {formatCurrency(transaction.amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                              {formatCurrency(transaction.paid_amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                              {formatCurrency(transaction.due_amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {transaction.image_url ? (
                                <button
                                  onClick={() => setSelectedImage(transaction.image_url!)}
                                  className="text-blue-500 hover:text-blue-700"
                                >
                                  <ImageIcon size={20} />
                                </button>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                          {expandedRows.has(transaction.id) && (
                            <tr>
                              <td colSpan={7} className="bg-gray-50 p-4">
                                <div className="text-sm">
                                  <h4 className="font-semibold mb-2">Transaction Items</h4>
                                  {transaction.items && transaction.items.length > 0 ? (
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
                                        {transaction.items.map((item, index) => (
                                          <tr key={index}>
                                            <td className="px-4 py-2 text-sm text-gray-900">{item.item_name}</td>
                                            <td className="px-4 py-2 text-sm text-right text-gray-900">{item.quantity}</td>
                                            <td className="px-4 py-2 text-sm text-right text-gray-900">{formatCurrency(item.unit_price)}</td>
                                            <td className="px-4 py-2 text-sm text-right text-gray-900">{formatCurrency(item.total_price)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p className="text-gray-500">No items in this transaction.</p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {/* Totals Row */}
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan={3} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          Total
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatCurrency(totals.totalInflow + totals.totalOutflow)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatCurrency(totals.totalPaidInflow + totals.totalPaidOutflow)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatCurrency(totals.totalDueInflow + totals.totalDueOutflow)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-gray-900">
                          -
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}