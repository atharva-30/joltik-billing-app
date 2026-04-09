import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Printer, History, FileText, Download, Save, X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { cn, formatCurrency, numberToWords } from './utils';
import { Bill, BillItem } from './types';

const INITIAL_ITEM: BillItem = {
  id: crypto.randomUUID(),
  description: '',
  qty: 1,
  perUnit: 0,
  amount: 0,
};

const INITIAL_BILL: Omit<Bill, 'id' | 'createdAt'> = {
  billNo: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  to: '',
  items: [{ ...INITIAL_ITEM }],
  total: 0,
  advance: 0,
  balanceDue: 0,
};

export default function App() {
  const [bill, setBill] = useState<Omit<Bill, 'id' | 'createdAt'>>(INITIAL_BILL);
  const [history, setHistory] = useState<Bill[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('bill_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Save history to localStorage
  const saveToHistory = (newBill: Bill) => {
    const updatedHistory = [newBill, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('bill_history', JSON.stringify(updatedHistory));
  };

  const deleteFromHistory = (id: string) => {
    const updatedHistory = history.filter((b) => b.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('bill_history', JSON.stringify(updatedHistory));
  };

  const calculateTotals = (items: BillItem[], advance: number) => {
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    return {
      total,
      balanceDue: total - advance,
    };
  };

  const handleItemChange = (id: string, field: keyof BillItem, value: string | number) => {
  const updatedItems = bill.items.map((item) => {
    if (item.id === id) {
      const updatedItem = { ...item, [field]: value };

      // Always recalculate amount (not only on qty/perUnit)
      let amount = Number(updatedItem.qty) * Number(updatedItem.perUnit);

      // 🔥 Detect discount row
      const isDiscount =
        typeof updatedItem.description === 'string' &&
        updatedItem.description.toLowerCase().includes('discount');

      if (isDiscount) {
        amount = -Math.abs(amount);
      }

      updatedItem.amount = amount;

      return updatedItem;
    }
    return item;
  });

  const { total, balanceDue } = calculateTotals(updatedItems, bill.advance);
  setBill({ ...bill, items: updatedItems, total, balanceDue });
};
  const addItem = () => {
    setBill({
      ...bill,
      items: [...bill.items, { ...INITIAL_ITEM, id: crypto.randomUUID() }],
    });
  };

  const removeItem = (id: string) => {
    if (bill.items.length === 1) return;
    const updatedItems = bill.items.filter((item) => item.id !== id);
    const { total, balanceDue } = calculateTotals(updatedItems, bill.advance);
    setBill({ ...bill, items: updatedItems, total, balanceDue });
  };

  const handleAdvanceChange = (value: number) => {
    const { total, balanceDue } = calculateTotals(bill.items, value);
    setBill({ ...bill, advance: value, total, balanceDue });
  };

  const handleSave = () => {
    const newBill: Bill = {
      ...bill,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    saveToHistory(newBill);
    setNotification({ message: 'Bill saved to history!', type: 'success' });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPDF(true);
    try {
      // Create a temporary container for high-quality capture
      const element = printRef.current;
      const originalStyle = element.style.cssText;
      
      // Force fixed dimensions for capture to prevent cropping/misalignment
      element.style.width = '794px'; // A4 width at 96 DPI
      element.style.height = '1123px'; // A4 height at 96 DPI
      
      const canvas = await toCanvas(element, {
        pixelRatio: 1.5, // Higher quality
        backgroundColor: '#ffffff',
      });
      
      // Restore original style
      element.style.cssText = originalStyle;

      const imgData = canvas.toDataURL('image/jpeg');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      const billNumber = bill.billNo
  ? bill.billNo.toString().trim().replace(/\s+/g, '')
  : 'Draft';

pdf.save(`Bill-${billNumber}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      setNotification({ message: 'Failed to generate PDF. Please try printing instead.', type: 'error' });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const loadBill = (savedBill: Bill) => {
    const { id, createdAt, ...billData } = savedBill;
    setBill(billData);
    setShowHistory(false);
  };

  const resetForm = () => {
    setBill(INITIAL_BILL);
  };

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-stone-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between shadow-sm no-print">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center overflow-hidden">
            <img 
              src="/Logo.png" 
              alt="Joltik Logo" 
              className="w-full h-full object-contain p-1"
              onError={(e) => {
                // Fallback if image not found
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<span class="text-white font-bold italic">J</span>';
              }}
            />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">JOLTIK REELOGRAPHY</h1>
            <p className="text-xs text-stone-500 font-medium">Bill & Estimate Generator</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openInNewTab}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-600"
            title="Open in New Tab (Recommended for Printing)"
          >
            <ExternalLink className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
            title="History"
          >
            <History className="w-5 h-5" />
          </button>
          <button
            onClick={resetForm}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
            title="New Bill"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto pt-2 px-4 md:px-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <section className="space-y-6 no-print">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Bill Details
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-500">Bill No.</label>
                <input
                  type="text"
                  value={bill.billNo}
                  onChange={(e) => setBill({ ...bill, billNo: e.target.value })}
                  placeholder="e.g. 001"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-black outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-500">Date</label>
                <input
                  type="date"
                  value={bill.date}
                  onChange={(e) => setBill({ ...bill, date: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-black outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500">To (Client Name)</label>
              <input
                type="text"
                value={bill.to}
                onChange={(e) => setBill({ ...bill, to: e.target.value })}
                placeholder="Client Name / Company"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-black outline-none transition-all"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-500">Items</label>
                <button
                  onClick={addItem}
                  className="text-xs font-bold flex items-center gap-1 text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-3 h-3" /> Add Item
                </button>
              </div>

              <div className="space-y-3">
                {bill.items.map((item, index) => (
                  <div key={item.id} className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3 relative group">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="absolute top-2 right-2 p-1 text-stone-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-stone-400">Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                        placeholder="Service description"
                        className="w-full bg-transparent border-b border-stone-200 focus:border-black outline-none py-1 transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-stone-400">Qty</label>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleItemChange(item.id, 'qty', Number(e.target.value))}
                          className="w-full bg-transparent border-b border-stone-200 focus:border-black outline-none py-1 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-stone-400">Per Unit</label>
                        <input
                          type="number"
                          value={item.perUnit}
                          onChange={(e) => handleItemChange(item.id, 'perUnit', Number(e.target.value))}
                          className="w-full bg-transparent border-b border-stone-200 focus:border-black outline-none py-1 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-stone-400">Amount</label>
                        <div className="py-1 font-bold">{formatCurrency(item.amount)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-stone-500">TOTAL</span>
                <span className="text-lg font-bold">{formatCurrency(bill.total)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-bold text-stone-500">ADVANCE</span>
                <input
                  type="number"
                  value={bill.advance}
                  onChange={(e) => handleAdvanceChange(Number(e.target.value))}
                  className="w-32 text-right px-2 py-1 bg-stone-50 border border-stone-200 rounded focus:ring-1 focus:ring-black outline-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-stone-500">BALANCE DUE</span>
                <span className="text-lg font-bold text-red-600">{formatCurrency(bill.balanceDue)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors"
                >
                  <Save className="w-5 h-5" />
                  Save to History
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Download className="w-5 h-5" />
                  {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
              <button
                onClick={handlePrint}
                className="w-full bg-white border-2 border-stone-900 text-stone-900 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-50 transition-colors"
              >
                <Printer className="w-5 h-5" />
                Print Bill (Browser)
              </button>
              <p className="text-[10px] text-center text-stone-400 font-medium">
                Tip: If "Print" doesn't work, use "Download PDF" or "Open in New Tab"
              </p>
            </div>
          </div>
        </section>

        {/* Preview Section */}
        <section className="relative">
          <div className="sticky top-16">
            <div className="bg-[#ffffff] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-sm overflow-hidden print-container mx-auto" ref={printRef} style={{ width: '794px' }}>
              {/* The Template Rendering */}
              <div className="p-[0.5in] aspect-[1/1.414] bg-[#ffffff] text-[#000000] flex flex-col border border-[#e7e5e4] print:border-0" style={{ width: '794px', height: '1123px' }}>
                {/* Header */}
                <div className="flex justify-between text-[10px] font-serif italic mb-2">
                  <span>|| Shree Ganeshay Namah ||</span>
                  <span>|| Shree Swami Samarth ||</span>
                </div>

                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 flex items-center justify-center overflow-hidden">
                      <img 
                        src="/Logo.png" 
                        alt="Joltik Logo" 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div>
                      <h1 className="text-4xl font-serif font-black tracking-tighter leading-none">JOLTIK</h1>
                      <p className="text-xl font-serif tracking-[0.2em] font-bold mt-1">REELOGRAPHY</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-serif font-bold">Atharva Raorane</p>
                    <p className="text-lg font-serif">7710988631</p>
                    <p className="text-sm font-serif text-[#57534e]">Dombivli, Mumbai</p>
                  </div>
                </div>

                <div className="bg-[#d6d3d1] text-center py-1 font-serif font-bold text-lg mb-2 border-y border-[#000000]">
                  BILL / ESTIMATE
                </div>

                <div className="flex justify-between mb-2 text-sm font-serif">
                  <div className="flex gap-2">
                    <span>No.:</span>
                    <span className="border-b border-[#000000] min-w-[100px] inline-block">{bill.billNo}</span>
                  </div>
                  <div className="flex gap-2">
                    <span>Date :</span>
                    <span className="border-b border-[#000000] min-w-[150px] inline-block">{bill.date ? format(new Date(bill.date), 'dd/MM/yyyy') : ''}</span>
                  </div>
                </div>

                <div className="flex gap-2 mb-6 text-sm font-serif">
                  <span>To,</span>
                  <span className="border-b border-[#000000] flex-1 inline-block">{bill.to}</span>
                </div>

                {/* Table */}
                <div className="flex-1 border border-[#000000] flex flex-col">
                  <div className="grid grid-cols-[1fr_60px_100px_120px] bg-[#d6d3d1] border-b border-[#000000] font-serif font-bold text-xs text-center uppercase">
                    <div className="border-r border-[#000000] py-2">Description</div>
                    <div className="border-r border-[#000000] py-2">Qty</div>
                    <div className="border-r border-[#000000] py-2">Per Unit</div>
                    <div className="py-2">Amount</div>
                  </div>
                  <div className="flex-1 relative">
                    {/* Vertical Lines */}
                    <div className="absolute inset-0 grid grid-cols-[1fr_60px_100px_120px] pointer-events-none">
                      <div className="border-r border-[#000000] h-full" />
                      <div className="border-r border-[#000000] h-full" />
                      <div className="border-r border-[#000000] h-full" />
                      <div className="h-full" />
                    </div>
                    
                    <div className="relative">
                      {bill.items.map((item) => (
                        <div key={item.id} className="grid grid-cols-[1fr_60px_100px_120px] text-sm font-serif border-b border-[#f5f5f4] last:border-0">
                          <div className="px-3 py-2 min-h-[40px]">{item.description}</div>
                          <div className="text-center py-2">{item.qty}</div>
                          <div className="text-center py-2">{item.perUnit || ''}</div>
                          <div className="text-right px-3 py-2">{item.amount ? item.amount.toFixed(2) : ''}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals Section */}
                  <div className="border-t border-[#000000]">
                    <div className="grid grid-cols-[1fr_120px]">
                      <div className="border-r border-[#000000] px-3 py-1 text-right font-serif font-bold bg-[#e7e5e4]">TOTAL</div>
                      <div className="text-right px-3 py-1 font-serif font-bold">{bill.total.toFixed(2)}</div>
                    </div>
                    <div className="grid grid-cols-[1fr_120px] border-t border-[#000000]">
                      <div className="border-r border-[#000000] px-3 py-1 text-right font-serif font-bold bg-[#e7e5e4]">ADVANCE</div>
                      <div className="text-right px-3 py-1 font-serif">{bill.advance.toFixed(2)}</div>
                    </div>
                    <div className="grid grid-cols-[1fr_120px] border-t border-[#000000]">
                      <div className="border-r border-[#000000] px-3 py-1 text-right font-serif font-bold bg-[#e7e5e4]">BAL. DUE</div>
                      <div className="text-right px-3 py-1 font-serif font-bold">{bill.balanceDue.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 space-y-4">
                  <div className="flex flex-col gap-1 text-sm font-serif">
                    <div className="flex gap-2">
                      <span className="font-bold">Rs.</span>
                      <div className="flex-1 border-b border-[#000000] italic min-h-[1.5em]">
                        {numberToWords(bill.total)}
                      </div>
                    </div>
                    <div className="border-b border-[#000000] min-h-[1.5em]" />
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-sm font-serif font-bold">Payment Method</p>
                      <p className="text-sm font-serif">Cash / UPI - 7710988631</p>
                      <p className="text-2xl font-serif italic mt-4">Thank You</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-serif font-bold">ATHARVA RAORANE</p>
                      <p className="text-xs font-serif">Cinematographer - Editor</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-stone-400 text-xs mt-4 no-print">
              Preview matches the printed layout
            </p>
          </div>
        </section>
      </main>

      {/* History Drawer */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/50 z-40 no-print"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl p-6 overflow-y-auto no-print"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <History className="w-6 h-6" />
                  Bill History
                </h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-stone-100 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-20 text-stone-400">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No saved bills yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((savedBill) => (
                    <div
                      key={savedBill.id}
                      className="p-4 bg-stone-50 rounded-2xl border border-stone-200 hover:border-black transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-lg">#{savedBill.billNo || 'N/A'}</p>
                          <p className="text-sm text-stone-500">{savedBill.to || 'Unnamed Client'}</p>
                        </div>
                        <p className="text-xs font-bold text-stone-400">
                          {format(savedBill.createdAt, 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <span className="font-bold">{formatCurrency(savedBill.total)}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteFromHistory(savedBill.id)}
                            className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => loadBill(savedBill)}
                            className="px-4 py-2 bg-stone-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-all"
                          >
                            Load Bill
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Global Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          main { display: block !important; padding: 0 !important; margin: 0 !important; max-width: none !important; }
          section { display: block !important; width: 100% !important; }
          .print-container { 
            box-shadow: none !important; 
            border: none !important; 
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 9999 !important;
          }
          .print-container > div {
            border: none !important;
            width: 100% !important;
            height: 100% !important;
            padding: 0.5in !important;
          }
        }
      `}} />

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-lg text-white font-bold text-sm no-print",
              notification.type === 'success' ? "bg-black" : "bg-red-600"
            )}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
