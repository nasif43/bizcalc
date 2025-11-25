import { useState } from 'react';
import { Calculator } from './components/Calculator';
import { Ledger } from './components/Ledger';
import { Inventory } from './components/Inventory';
import { Calculator as CalcIcon, BookOpen, Package } from 'lucide-react';
import { cn } from './lib/utils';

function App() {
  const [currentPage, setCurrentPage] = useState<'calculator' | 'ledger' | 'inventory'>('calculator');

  return (
    <div className="fixed inset-0 flex flex-col">
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {currentPage === 'calculator' ? <Calculator /> : 
         currentPage === 'ledger' ? <Ledger /> : 
         <Inventory />}
      </div>
      
      {/* Bottom Navigation Bar */}
      <nav className="h-16 bg-white border-t border-gray-200 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setCurrentPage('calculator')}
          className={cn(
            "flex flex-col items-center justify-center w-full h-full transition-colors",
            currentPage === 'calculator' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <CalcIcon size={24} />
          <span className="text-sm mt-1 font-medium">Calculator</span>
        </button>
        <button
          onClick={() => setCurrentPage('ledger')}
          className={cn(
            "flex flex-col items-center justify-center w-full h-full transition-colors",
            currentPage === 'ledger' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <BookOpen size={24} />
          <span className="text-sm mt-1 font-medium">Ledger</span>
        </button>
        <button
          onClick={() => setCurrentPage('inventory')}
          className={cn(
            "flex flex-col items-center justify-center w-full h-full transition-colors",
            currentPage === 'inventory' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Package size={24} />
          <span className="text-sm mt-1 font-medium">Inventory</span>
        </button>
      </nav>
    </div>
  );
}

export default App;