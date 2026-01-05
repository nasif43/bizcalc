import React, { useState, useEffect } from 'react';
import { Plus, X, Upload } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { I18nProvider, useTranslation } from '../i18n';
import LanguageToggle from './LanguageToggle';
import type { Contact } from '../lib/supabase';
import { getContacts, createRecord, updateRecord, storageFrom, getRecord, getFileUrl } from '../lib/pocketbase';
import { ItemSelection, SelectedItem } from './ItemSelection';

type TransactionType = 'inflow' | 'outflow';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function Calculator() {
  const variantClasses = {
    number: "bg-gradient-to-b from-gray-50 to-gray-100 hover:from-white hover:to-gray-50 text-gray-800 shadow-sm",
    operator: "bg-gradient-to-b from-gray-300 to-gray-400 hover:from-gray-200 hover:to-gray-300 text-gray-800 shadow-sm",
    equals: "bg-gradient-to-b from-orange-400 to-orange-500 hover:from-orange-300 hover:to-orange-400 text-white shadow-sm",
    function: "bg-gradient-to-b from-gray-400 to-gray-500 hover:from-gray-300 hover:to-gray-400 text-gray-800 shadow-sm"
  };

  const buttonStyle: React.CSSProperties = {
    boxShadow: '0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.4)',
    border: '1px solid rgba(0,0,0,0.15)',
    fontFamily: `'Orbitron', sans-serif`
  };
  const [display, setDisplay] = useState('0');
  const [transactionType, setTransactionType] = useState<TransactionType>('inflow');
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', nid: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [currentOperator, setCurrentOperator] = useState<string | null>(null);
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  useEffect(() => {
    fetchContacts();
  }, [transactionType]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const data = await getContacts();
      const filtered = (data || []).filter((c: any) => c.type === (transactionType === 'inflow' ? 'customer' : 'supplier'));
      setContacts(filtered);
      setError('');
    } catch (e) {
      console.error('Error fetching contacts:', e);
      setError('Failed to load contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num);
      setWaitingForOperand(false);
    } else {
      setDisplay(prev => prev === '0' ? num : prev + num);
    }
  };

  const handleOperator = (op: string) => {
    const currentValue = parseFloat(display);
    
    if (previousValue === null) {
      setPreviousValue(currentValue);
    } else if (currentOperator) {
      const result = calculate();
      setPreviousValue(result);
    }
    
    setCurrentOperator(op);
    setWaitingForOperand(true);
  };

  const handlePercentage = () => {
    const value = parseFloat(display);
    if (!isNaN(value)) {
      setDisplay((value / 100).toString());
    }
  };

  const calculate = () => {
    if (previousValue === null || currentOperator === null) {
      return parseFloat(display);
    }

    const currentValue = parseFloat(display);
    let result = 0;

    switch (currentOperator) {
      case '+':
        result = previousValue + currentValue;
        break;
      case '-':
        result = previousValue - currentValue;
        break;
      case '*':
        result = previousValue * currentValue;
        break;
      case '/':
        result = previousValue / currentValue;
        break;
      default:
        return currentValue;
    }

    setDisplay(result.toString());
    setPreviousValue(null);
    setCurrentOperator(null);
    setWaitingForOperand(true);
    return result;
  };

  const handleEquals = () => {
    if (previousValue !== null && currentOperator !== null) {
      calculate();
    }
  };

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setCurrentOperator(null);
    setWaitingForOperand(false);
  };

  const clearEntry = () => {
    setDisplay('0');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        setError('Image size must be less than 5MB');
        return;
      }
      
      // Check file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setError('Only JPG, PNG, GIF, and WebP images are allowed');
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleSubmit = async () => {
    if (!selectedContact) {
      setError('Please select a contact');
      return;
    }

    const amount = parseFloat(display);
    const paid = parseFloat(paidAmount);

    if (isNaN(amount) || isNaN(paid)) {
      setError('Invalid amounts');
      return;
    }

    try {
      setLoading(true);
      setError(''); // Clear any previous errors
  let imageUrl = null;

      // image will be attached to the created transaction record after creation
      if (selectedImage) {
        // noop here; upload happens after record creation
      }
      // Insert the transaction (without image)
      const created = await createRecord('transactions', {
        type: transactionType,
        amount,
        paid_amount: paid,
        due_amount: amount - paid,
        contact_id: selectedContact.id,
        items: selectedItems.map(item => ({
          item_id: item.id,
          quantity: item.quantity,
          unit_price: (item as any).unit_price ?? (item as any).unitPrice ?? (item as any).price ?? 0,
        })),
      });

      const createdId = created?.id;
      if (!createdId) throw new Error('Failed to create transaction');

      // If there is an image, attach it to the transaction record
      if (selectedImage && createdId) {
        const uploadResp = await storageFrom('transactions').upload(createdId, selectedImage);
        let filename: string | undefined = uploadResp?.filename;
        if (!filename) {
          const rec = await getRecord('transactions', createdId);
          filename = rec?.image_filename;
        }
        if (filename) {
          imageUrl = getFileUrl('transactions', createdId, filename);
          await updateRecord('transactions', createdId, { image_url: imageUrl });
        }
      }

      // Reset form
      setShowTransactionForm(false);
      clear();
      setPaidAmount('');
      setSelectedContact(null);
      setSelectedImage(null);
      setImagePreview(null);
      setError('');
    } catch (e) {
      console.error('Error saving transaction:', e);
      setError(e instanceof Error ? e.message : 'Failed to save transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewContact = async () => {
    if (!newContact.name || !newContact.phone) {
      setError('Name and phone are required');
      return;
    }

    try {
      setLoading(true);
      const created = await createRecord('contacts', {
        name: newContact.name,
        phone: newContact.phone,
        nid: newContact.nid || null,
        type: transactionType === 'inflow' ? 'customer' : 'supplier'
      });

      await fetchContacts();
      setSelectedContact(created as Contact);
      setShowNewContactForm(false);
      setNewContact({ name: '', phone: '', nid: '' });
      setError('');
    } catch (e) {
      console.error('Error creating contact:', e);
      setError('Failed to create contact. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTransactionType = () => {
    setTransactionType(prev => prev === 'inflow' ? 'outflow' : 'inflow');
    setSelectedContact(null);
  };

  const handleItemsChange = (items: SelectedItem[]) => {
    setSelectedItems(items);
  };

  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 flex justify-end">
        <LanguageToggle />
      </div>
      <div className="flex flex-col h-full">
        {/* Calculator Display - Reduced by 10% from 40vh to 36vh */}
        <div
          onClick={toggleTransactionType}
          className={cn(
            "h-[36vh] flex flex-col justify-end p-6 transition-colors",
            transactionType === 'inflow' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          )}
        >
          <div className="text-sm mb-2">{transactionType === 'inflow' ? t('sale') : t('purchase')}</div>
          <div className="text-5xl font-bold text-right break-all" style={{ fontFamily: `'Orbitron', sans-serif` }}>{display}</div>
          {currentOperator && (
            <div className="text-sm mt-2 text-right opacity-75" style={{ fontFamily: `'Orbitron', sans-serif` }}>
              {previousValue} {currentOperator}
            </div>
          )}
        </div>

        {/* Calculator Buttons - 5x5 Grid */}
        <div className="flex-1 grid grid-cols-5 gap-1 p-4 bg-gray-100">
          {/* Row 1 */}
          <button onClick={() => handleNumber('7')} className={cn('rounded-lg text-xl font-medium', variantClasses.number)} style={buttonStyle}>7</button>
          <button onClick={() => handleNumber('8')} className={cn('rounded-lg text-xl font-medium', variantClasses.number)} style={buttonStyle}>8</button>
          <button onClick={() => handleNumber('9')} className={cn('rounded-lg text-xl font-medium', variantClasses.number)} style={buttonStyle}>9</button>
          <button onClick={clear} className={cn('rounded-lg text-xl font-medium', variantClasses.function)} style={buttonStyle}>C</button>
          <button onClick={clearEntry} className={cn('rounded-lg text-xl font-medium', variantClasses.function)} style={buttonStyle}>CE</button>

          {/* Row 2 */}
          <button onClick={() => handleNumber('4')} className={cn('rounded-lg text-xl font-medium', variantClasses.number)} style={buttonStyle}>4</button>
          <button onClick={() => handleNumber('5')} className={cn('rounded-lg text-xl font-medium', variantClasses.number)} style={buttonStyle}>5</button>
          <button onClick={() => handleNumber('6')} className={cn('rounded-lg text-xl font-medium', variantClasses.number)} style={buttonStyle}>6</button>
          <button onClick={handlePercentage} className={cn('rounded-lg text-xl font-medium', variantClasses.function)} style={buttonStyle}>%</button>
          <button onClick={() => handleOperator('*')} className={cn('rounded-lg text-xl font-medium', variantClasses.operator)} style={buttonStyle}>×</button>

          {/* Row 3 */}
          <button onClick={() => handleNumber('1')} className={cn('rounded-lg text-xl font-medium', variantClasses.number)} style={buttonStyle}>1</button>
          <button onClick={() => handleNumber('2')} className={cn('rounded-lg text-xl font-medium', variantClasses.number)} style={buttonStyle}>2</button>
          <button onClick={() => handleNumber('3')} className={cn('rounded-lg text-xl font-medium', variantClasses.number)} style={buttonStyle}>3</button>
          <button onClick={() => handleOperator('-')} className={cn('rounded-lg text-xl font-medium', variantClasses.operator)} style={buttonStyle}>−</button>
          <button onClick={() => handleOperator('/')} className={cn('rounded-lg text-xl font-medium', variantClasses.operator)} style={buttonStyle}>÷</button>

          {/* Row 4 */}
          <button onClick={() => handleNumber('0')} className={cn('rounded-lg text-xl font-medium', variantClasses.number)} style={buttonStyle}>0</button>
          <button onClick={() => handleNumber('00')} className={cn('rounded-lg text-xl font-medium', variantClasses.number)} style={buttonStyle}>00</button>
          <button onClick={() => handleNumber('.')} className={cn('rounded-lg text-xl font-medium', variantClasses.number)} style={buttonStyle}>.</button>
          <button onClick={() => handleOperator('+')} className={cn('rounded-lg text-xl font-medium', variantClasses.operator)} style={buttonStyle}>+</button>
          <button onClick={handleEquals} className={cn('rounded-lg text-xl font-medium', variantClasses.equals)} style={buttonStyle}>=</button>

          {/* Row 5 - Submit button (slimmer and extended) */}
          <div className="col-span-5 mt-1">
            <button
              onClick={() => setShowTransactionForm(true)}
              className="w-full bg-green-500 text-white rounded-lg shadow hover:bg-green-600 active:bg-green-700 text-xl font-medium h-10"
            >
              {t('submit')}
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Form Modal */}
      {showTransactionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{t('transactionDetails')}</h2>
              <button
                onClick={() => setShowTransactionForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('transactionType')}
                </label>
                <div className="mt-1 text-lg font-semibold">
                  {transactionType === 'inflow' ? t('sale') : t('purchase')}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('amount')}
                </label>
                <div className="mt-1 text-lg font-semibold">
                  {formatCurrency(parseFloat(display))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('paidAmount')}
                </label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('dueAmount')}
                </label>
                <div className="mt-1 text-lg font-semibold">
                  {formatCurrency(parseFloat(display) - (parseFloat(paidAmount) || 0))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {transactionType === 'inflow' ? t('customer') : t('supplier')}
                </label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={selectedContact?.id || ''}
                    onChange={(e) => {
                      const contact = contacts.find(c => c.id === e.target.value);
                      setSelectedContact(contact || null);
                    }}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">{t('select')}</option>
                    {contacts.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowNewContactForm(true)}
                    className="bg-blue-500 text-white p-2 rounded-md"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              </div>
              <div>
                  <ItemSelection onItemsChange={handleItemsChange} initialItems={selectedItems} transactionType={transactionType} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('attachmentOptional')}
                </label>
                <div className="mt-1 flex items-center gap-4">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="h-full object-contain" />
                      ) : (
                        <div className="text-center">
                          <Upload className="mx-auto h-12 w-12 text-gray-400" />
                          <span className="mt-2 block text-sm font-medium text-gray-600">
                            {t('clickToUpload')}
                          </span>
                          <span className="mt-1 text-xs text-gray-500">
                            {t('supports')}
                          </span>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  {imagePreview && (
                    <button
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePreview(null);
                      }}
                      className="p-2 text-red-500 hover:text-red-700"
                    >
                      <X size={24} />
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? t('processing') : t('submitTransaction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Contact Form Modal */}
      {showNewContactForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{transactionType === 'inflow' ? t('newCustomer') : t('newSupplier')}</h2>
              <button
                onClick={() => setShowNewContactForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('nameRequired') ?? 'Name *'}
                </label>
                <input
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('phoneRequired') ?? 'Phone *'}
                </label>
                <input
                  type="tel"
                  value={newContact.phone}
                  onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('nidOptional') ?? 'NID (Optional)'}
                </label>
                <input
                  type="text"
                  value={newContact.nid}
                  onChange={(e) => setNewContact(prev => ({ ...prev, nid: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}

              <button
                onClick={handleNewContact}
                disabled={loading}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? t('creating') : t('createContact')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}