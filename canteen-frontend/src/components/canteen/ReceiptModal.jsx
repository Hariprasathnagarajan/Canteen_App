import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Download, CheckCircle2, Clock, Sparkles, Building2, ShieldCheck, FileText } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ReceiptModal({ order, isOpen, onClose, api }) {
  const [receiptDetails, setReceiptDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef(null);
  const printAreaRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Fetch official verified receipt from backend API when available
  const fetchReceipt = useCallback(async () => {
    if (!order?.id) return;
    setLoading(true);
    try {
      if (api?.getOrderReceipt) {
        const res = await api.getOrderReceipt(order.id);
        if (res?.data) {
          setReceiptDetails(res.data);
          return;
        }
      }
    } catch (err) {
      // Fallback gracefully to client-side order object
      console.warn('Using client-side order details for receipt:', err);
    } finally {
      setLoading(false);
    }
  }, [order?.id, api]);

  useEffect(() => {
    if (isOpen && order) {
      fetchReceipt();
    }
  }, [isOpen, order, fetchReceipt]);

  if (!isOpen || !order) return null;

  const data = receiptDetails || {
    receipt_number: `VDART-RCPT-${String(order.id).padStart(5, '0')}`,
    order_id: order.id,
    created_at: order.created_at,
    status: order.status,
    total_tokens: order.total_tokens,
    user: {
      username: order.user_details?.username || order.user?.username || 'Employee',
      name: order.user_details?.first_name 
        ? `${order.user_details.first_name} ${order.user_details.last_name || ''}`.trim()
        : (order.user_details?.username || 'VDart Personnel'),
      user_id: order.user_details?.user_id || order.user_id || '—',
      work_shift: order.user?.work_shift || 'day',
    },
    items: (order.order_items || []).map((li, idx) => ({
      id: idx,
      name: li.menu_item?.name || 'Canteen Item',
      quantity: li.quantity,
      tokens_per_item: li.tokens_per_item || (li.tokens_per_item * li.quantity) / (li.quantity || 1),
      total_tokens: (li.tokens_per_item || 0) * (li.quantity || 1),
      category: li.menu_item?.category || 'meal',
    })),
    cafe_info: {
      name: 'VDart Cafe',
      tagline: 'Corporate Canteen & Refreshment Hub',
      location: 'VDart Technologies Global Tech Center',
      canteen_code: 'VDART-HQ-01',
    },
    verification_code: `VDC-${String(order.id).padStart(5, '0')}`,
  };

  const formattedDate = new Date(data.created_at).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = new Date(data.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const totalItemsCount = (data.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadText = () => {
    try {
      const receiptContent = `
======================================================
                 VDART CAFE
         Corporate Canteen & Refreshment Hub
           VDart Technologies Global HQ
======================================================
RECEIPT #: ${data.receipt_number}
DATE:      ${formattedDate} ${formattedTime}
ORDER ID:  #${data.order_id}
STATUS:    ${(data.status || 'COMPLETED').toUpperCase()}
CUSTOMER:  ${data.user?.name || data.user?.username} (${data.user?.user_id || 'N/A'})
SHIFT:     ${(data.user?.work_shift || 'Day').toUpperCase()} SHIFT
------------------------------------------------------
ITEM                          QTY   RATE      TOTAL
------------------------------------------------------
${(data.items || []).map((it) => {
  const name = it.name.padEnd(28, ' ').substring(0, 28);
  const qty = String(it.quantity).padStart(3, ' ');
  const rate = `${it.tokens_per_item || 0} tk`.padStart(6, ' ');
  const tot = `${it.total_tokens || 0} tk`.padStart(7, ' ');
  return `${name} ${qty} ${rate} ${tot}`;
}).join('\n')}
------------------------------------------------------
TOTAL ITEMS:        ${totalItemsCount}
TOTAL TOKENS CHARGED: ${data.total_tokens} tokens
PAYMENT METHOD:     Shift Allowance (Company Subsidized)
------------------------------------------------------
VERIFICATION CODE:  ${data.verification_code}
======================================================
       Thank you for dining with VDart Cafe!
   Please retain this digital voucher for your records.
======================================================
`;
      const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `VDart_Cafe_Receipt_${data.order_id}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Digital receipt downloaded successfully!');
    } catch (err) {
      toast.error('Failed to download receipt');
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
      >
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative max-h-[92vh] w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-900 px-5 py-3.5 text-white print:hidden">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cobalt-600/30 text-cobalt-300">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <h3 id="receipt-title" className="text-sm font-bold text-white">Digital Token Receipt</h3>
                <p className="text-[10px] text-slate-400">Official VDart Cafe Voucher</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close receipt modal"
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cobalt-500 focus-visible:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Printable Thermal Receipt Card */}
          <div 
            ref={printAreaRef}
            className="overflow-y-auto p-6 space-y-4 font-sans bg-cobalt-50/10 print:p-0 print:bg-white text-ink text-xs sm:text-sm"
          >
            {/* Top Zig-zag / Perforated visual */}
            <div className="border-t-2 border-dashed border-slate-300 pt-2" />
 
             {/* Brand Header */}
             <div className="text-center space-y-1">
               <div className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-cobalt-300 tracking-wider">
                <Building2 className="h-3 w-3" /> VDART CAFE
              </div>
              <h2 className="text-base font-extrabold tracking-tight text-ink uppercase">Token Dining Voucher</h2>
              <p className="text-[11px] text-ink-mute">VDart Technologies Global Tech Hub</p>
              <p className="font-mono-tokens text-[11px] text-cobalt-700 font-semibold">{data.receipt_number}</p>
            </div>

            {/* Meta Info Grid */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-1.5 text-xs shadow-2xs">
               <div className="flex justify-between">
                 <span className="text-ink-mute">Order ID:</span>
                 <span className="font-mono-tokens font-bold text-ink">#{data.order_id}</span>
               </div>
               <div className="flex flex-wrap justify-between gap-x-2">
                 <span className="text-ink-mute">Date & Time:</span>
                 <span className="font-mono-tokens text-slate-800">{formattedDate} · {formattedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-mute">Employee:</span>
                <span className="font-semibold text-ink">
                  {data.user?.name || data.user?.username} {data.user?.user_id ? `(${data.user.user_id})` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-mute">Shift & Station:</span>
                 <span className="capitalize font-medium text-slate-700">{data.user?.work_shift || 'Day'} Shift · Counter 1</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                <span className="text-ink-mute">Order Status:</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  data.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : data.status === 'approved'
                    ? 'bg-cobalt-100 text-cobalt-900 border border-cobalt-300'
                    : data.status === 'declined'
                    ? 'bg-red-100 text-red-900 border border-red-300'
                    : 'bg-cobalt-100 text-cobalt-900 border border-cobalt-300'
                }`}>
                  <CheckCircle2 className="h-3 w-3" /> {data.status}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="bg-slate-100/80 px-3 py-2 text-[11px] font-bold text-ink-mute uppercase tracking-wider grid grid-cols-12 gap-1 border-b border-slate-200">
                <span className="col-span-6">Item</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Rate</span>
                <span className="col-span-2 text-right">Total</span>
              </div>
              <div className="divide-y divide-slate-100 px-3 py-1">
                {(data.items || []).map((li, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1 py-2 text-xs items-center">
                    <div className="col-span-6 pr-1">
                      <p className="font-semibold text-ink truncate">{li.name}</p>
                      <span className="text-[10px] text-ink-mute capitalize">{li.category || 'meal'}</span>
                    </div>
                    <span className="col-span-2 text-center font-mono-tokens font-semibold text-slate-700">
                      ×{li.quantity}
                    </span>
                    <span className="col-span-2 text-right font-mono-tokens text-slate-600">
                      {li.tokens_per_item} tk
                    </span>
                    <span className="col-span-2 text-right font-mono-tokens font-bold text-ink">
                      {li.total_tokens} tk
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Receipt Totals Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-1.5 text-xs shadow-2xs">
              <div className="flex justify-between text-ink-mute">
                <span>Total Items Ordered:</span>
                <span className="font-mono-tokens font-bold text-ink">{totalItemsCount}</span>
              </div>
              <div className="flex justify-between text-ink-mute">
                <span>Payment Mode:</span>
                <span className="font-medium text-slate-700">Monthly Shift Quota</span>
              </div>
              <div className="flex justify-between text-ink-mute">
                <span>Corporate Subsidy:</span>
                <span className="font-medium text-emerald-700">100% Employer Funded</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t-2 border-dashed border-slate-200">
                <span className="font-bold text-ink uppercase text-xs">Total Tokens Charged:</span>
                <span className="font-mono-tokens text-base font-extrabold text-cobalt-700">
                  {data.total_tokens} tokens
                </span>
              </div>
            </div>

            {/* Audit Verification / Barcode Graphic */}
            <div className="text-center pt-2 space-y-1.5">
              <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="h-3 w-3" /> Record Copy · Internal Use
              </div>
              {/* Simulated barcode bars */}
              <div className="flex items-center justify-center gap-[2px] h-9 py-1 px-4 bg-white rounded-lg border border-slate-200 max-w-[280px] mx-auto">
                {[3, 1, 4, 1, 2, 5, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2, 5, 1, 2, 4, 2, 1, 3, 2, 4, 1, 2].map((w, i) => (
                  <div key={i} className={`h-full bg-slate-900 rounded-[0.5px]`} style={{ width: `${w * 1.5}px` }} />
                ))}
              </div>
              <p className="font-mono-tokens text-[10px] text-ink-mute tracking-widest">{data.verification_code}</p>
            </div>

            {/* Bottom Zig-zag / Perforated visual */}
            <div className="border-b-2 border-dashed border-slate-300 pb-2" />
          </div>

          {/* Action Footer Bar */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-white p-4 print:hidden gap-2">
            <button
              onClick={handleDownloadText}
              className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-ink hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-cobalt-500"
            >
              <Download className="h-4 w-4 text-ink-mute" />
              <span>Download Slip</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="btn-tactile rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-ink-mute hover:text-ink transition-colors focus-visible:ring-2 focus-visible:ring-cobalt-500"
              >
                Close
              </button>
              <button
                onClick={handlePrint}
                className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-cobalt-600 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-cobalt-500"
              >
                <Printer className="h-4 w-4 text-cobalt-300" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
