import { useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, FileJson, FileType2, ClipboardPaste,
  Download, X, CheckCircle2, AlertTriangle, Loader2
} from 'lucide-react';

const ACCEPTED_EXTENSIONS = '.csv,.json,.xlsx';

const detectFormat = (text) => {
  const trimmed = (text || '').trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json';
  return 'csv';
};

export default function BulkUploadPanel({
  title = 'Bulk Upload',
  description = 'Upload a CSV, JSON or Excel (.xlsx) file — or paste the rows directly.',
  templateFilename = 'template.csv',
  templateContent = '',
  importFn,
  onImported,
  onClose,
}) {
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  const reset = () => {
    setFile(null);
    setPastedText('');
    setResult(null);
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = templateFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file && !pastedText.trim()) {
      setErrorMessage('Choose a file or paste the data before importing.');
      return;
    }
    setImporting(true);
    setErrorMessage('');
    setResult(null);
    try {
      const payload = file
        ? { file }
        : { text: pastedText, format: detectFormat(pastedText) };
      const response = await importFn(payload);
      const data = response?.data || {};
      setResult({
        created: data.created ?? data.imported ?? 0,
        updated: data.updated ?? 0,
        total: data.total ?? 0,
        errors: Array.isArray(data.errors) ? data.errors : [],
      });
      if (onImported) onImported(data);
    } catch (err) {
      const apiError =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        'Bulk import failed. Check the file format and try again.';
      setErrorMessage(typeof apiError === 'string' ? apiError : JSON.stringify(apiError));
    } finally {
      setImporting(false);
    }
  };

  const formatBadge = file
    ? file.name.toLowerCase().endsWith('.xlsx')
      ? { icon: FileType2, label: 'Excel', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
      : file.name.toLowerCase().endsWith('.json')
        ? { icon: FileJson, label: 'JSON', color: 'text-cobalt-700 bg-cobalt-50 border-cobalt-200' }
        : { icon: FileSpreadsheet, label: 'CSV', color: 'text-sky-700 bg-sky-50 border-sky-200' }
    : null;

  return (
    <div className="p-4 mb-4 bg-white border border-slate-200 shadow-sm rounded-xl">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Download size={14} />
            <span>Template</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 rounded-lg hover:text-slate-700 hover:bg-slate-100"
              aria-label="Close bulk upload"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* File upload */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) setFile(dropped);
          }}
          className="flex flex-col items-center justify-center gap-2 p-6 text-center border-2 border-dashed rounded-xl cursor-pointer border-slate-300 bg-slate-50/60 hover:border-cobalt-400 hover:bg-cobalt-50/30 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Upload size={22} className="text-slate-400" />
          {file ? (
            <>
              <p className="text-sm font-semibold text-slate-800 break-all">{file.name}</p>
              {formatBadge && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold border rounded-full ${formatBadge.color}`}>
                  <formatBadge.icon size={12} />
                  {formatBadge.label}
                </span>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700">Drop a file here or click to browse</p>
              <p className="text-[11px] text-slate-400">CSV, JSON or Excel (.xlsx)</p>
            </>
          )}
        </div>

        {/* Paste area */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-slate-600">
            <ClipboardPaste size={13} />
            <span>Or paste CSV / JSON rows</span>
          </div>
          <textarea
            rows={5}
            value={pastedText}
            onChange={(e) => {
              setPastedText(e.target.value);
              if (file) setFile(null);
            }}
            placeholder={'name,price,description\nFilter Coffee,15,Fresh filter coffee'}
            className="w-full px-3 py-2 font-mono text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cobalt-500/30 focus:border-cobalt-500 focus:outline-none resize-none"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 p-3 mt-4 text-xs text-red-800 border rounded-xl bg-red-50 border-red-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {result && (
        <div className="p-3 mt-4 border rounded-xl bg-emerald-50/70 border-emerald-200">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
            <CheckCircle2 size={16} />
            <span>
              Import complete — {result.created} created, {result.updated} updated
              {result.total ? ` out of ${result.total} rows` : ''}.
            </span>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-amber-800">
                {result.errors.length} row{result.errors.length > 1 ? 's' : ''} skipped:
              </p>
              <ul className="mt-1 space-y-0.5 max-h-36 overflow-y-auto list-disc list-inside">
                {result.errors.map((rowError, idx) => (
                  <li key={idx} className="text-[11px] text-amber-900">{rowError}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={reset}
          disabled={importing}
          className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={importing || (!file && !pastedText.trim())}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white rounded-xl bg-cobalt-600 hover:bg-cobalt-700 disabled:opacity-50 transition-colors"
        >
          {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          <span>{importing ? 'Importing…' : 'Import Data'}</span>
        </button>
      </div>
    </div>
  );
}
