import React, { useRef, useState } from 'react';
import { X, Printer, Edit3 } from 'lucide-react';
import { sanitizeHtml } from '../../utils/sanitize';
import { getBusinessInfo, getLabelSettings, setLabelSettings } from '../../utils/settings';
import { dbService } from '../../services/supabase';
import { LABEL_SIZES, labelRenderWidth, labelPadding, printLabels } from '../../utils/labelPrint';
import ShippingLabel, { LABEL_TEMPLATES, labelData } from './ShippingLabel';
import A4SheetPreview from './A4SheetPreview';
import { generateA4LabelSheet } from '../../utils/a4LabelSheet';

// Box presets
const BOX_PRESETS = [
  { label: 'Weekly Box', dimensions: '21.6 x 14.0 x 10.2 cm', weight: 0.25 },
  { label: 'Monthly Box', dimensions: '26.7 x 20.3 x 21.6 cm', weight: 1.0 },
  { label: 'Custom', dimensions: '', weight: 0 },
];

export default function LabelPrinter({ order, onClose, onPrinted }) {
  const printRef = useRef(null);
  const [settings, setSettingsState] = useState(getLabelSettings);
  const [editing, setEditing] = useState(false);
  const labelSize = settings.size;
  // Paper size is a quick switch here too, saved for every device.
  const setLabelSize = (size) => { const next = { ...settings, size }; setSettingsState(next); setLabelSettings(next); };

  const items = order.items || [];
  const hasMonthly = items.some(i => (i.pack_type || i.packType || '').toLowerCase().includes('month'));
  const defaults = labelData(order);
  const businessInfo = getBusinessInfo();

  // Editable state — changes apply to this print only
  const [boxType, setBoxType] = useState(hasMonthly ? 1 : 0);
  const [customDimensions, setCustomDimensions] = useState('');
  const [weight, setWeight] = useState(defaults.weight);
  const [courier, setCourier] = useState(defaults.courier);
  const [contents, setContents] = useState(defaults.contents);
  const [shipDate, setShipDate] = useState(order.dispatch_date || order.order_date || new Date().toISOString().split('T')[0]);

  const trackingNumber = order.tracking_number || '';
  const dimensions = boxType === 2 ? customDimensions : BOX_PRESETS[boxType].dimensions;

  const isA4 = labelSize === 'a4';

  const handlePrint = () => {
    // A4 uses the same cut-out sheet PDF as bulk and Quick Order printing.
    if (isA4) generateA4LabelSheet([order]);
    else printLabels({
      title: `Shipping Label - ${order.order_number}`,
      html: `<div class="label-page" style="padding:${labelPadding(labelSize)}">${sanitizeHtml(printRef.current.innerHTML)}</div>`,
      size: labelSize,
    });
    // Stamp so the Sales Orders list can show this order's label as printed.
    if (order.id) {
      dbService.updateSalesOrder({ id: order.id, label_printed_at: new Date().toISOString() })
        .then(() => { if (onPrinted) onPrinted(); })
        .catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3 z-10">
          <h2 className="text-xl font-bold text-gray-900">Shipping Label</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {Object.entries(LABEL_SIZES).map(([key, size]) => (
                <button key={key} onClick={() => setLabelSize(key)} className={`px-3 py-1.5 text-sm font-medium transition ${labelSize === key ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{key === 'a4' ? 'A4 Paper' : `${size.name} Thermal`}</button>
              ))}
            </div>
            <button onClick={() => setEditing(!editing)} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition ${editing ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <Edit3 className="w-4 h-4" />
              {editing ? 'Done' : 'Edit'}
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
          </div>
        </div>

        {/* Edit Panel */}
        {editing && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 space-y-3">
            <p className="text-xs text-amber-700 font-medium">✏️ Edit label fields below. Changes apply to this print only.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Box Type</label>
                <select value={boxType} onChange={(e) => setBoxType(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {BOX_PRESETS.map((b, i) => (
                    <option key={i} value={i}>{b.label}{b.dimensions ? ` (${b.dimensions})` : ''}</option>
                  ))}
                </select>
              </div>
              {boxType === 2 && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Custom Dimensions</label>
                  <input type="text" value={customDimensions} onChange={e => setCustomDimensions(e.target.value)}
                    placeholder="e.g. 30 x 20 x 15 cm" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Weight (KG)</label>
                <input type="text" value={weight} onChange={e => setWeight(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Courier</label>
                <input type="text" value={courier} onChange={e => setCourier(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Shipping Date</label>
                <input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Contents</label>
                <textarea value={contents} onChange={e => setContents(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* Label Preview */}
        <div className="p-6 bg-blue-50 flex flex-col items-center gap-2">
          {isA4 ? (
            <>
              <A4SheetPreview orders={[order]} perSheet={settings.a4PerSheet} withQr={settings.a4Qr} business={businessInfo} />
              <p className="text-xs text-gray-600 text-center max-w-sm">
                Downloads an A4 PDF ({settings.a4PerSheet} labels per sheet, this order in the first spot).
                {!settings.a4Qr && ' No QR code on A4 labels; turn it on in Settings → Shipping Label.'}
              </p>
            </>
          ) : (
            <div ref={printRef} style={{ width: `${labelRenderWidth(labelSize)}px` }}>
              <ShippingLabel
                order={order}
                settings={settings}
                paper={labelSize}
                business={businessInfo}
                overrides={{ weight, dimensions, courier, shipDate, contents }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 flex flex-wrap gap-3 justify-between items-center">
          <div className="text-xs text-gray-500">
            {trackingNumber ? `Tracking: ${trackingNumber}` : `Order: ${order.order_number}`}
            {' · '}
            <span>Layout: {LABEL_TEMPLATES[settings.template]?.name || 'Compact'} (change in Settings → Shipping Label)</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">Cancel</button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
              <Printer className="w-4 h-4" /> Print Label
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
