import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { computeCostImpact, inr, inr0, back } from '../utils/costImpact';

// Raw Purchases → Cost Impact: what one box of each product costs today at
// your latest bill prices, what it cost 3 and 6 months ago, what you actually
// sold it for (last 90 days, without GST), what is left per box, and which
// raw materials moved the cost. Courier is not included (it is per order).

export default function CostImpact({ skus = [], ingredients = [], orders = [] }) {
  const [open, setOpen] = useState(null);
  const dates = useMemo(() => ({ now: new Date().toISOString().slice(0, 10), m3: back(3), m6: back(6) }), []);

  const rows = useMemo(() => computeCostImpact({ skus, ingredients, orders, dates }), [skus, ingredients, orders, dates]);

  if (rows.length === 0) {
    return <div className="bg-white rounded-lg border p-8 text-center text-gray-500">No product has a recipe yet. Add recipes in SKUs.</div>;
  }

  const tone = (d) => (Math.abs(d) < 0.5 ? 'text-gray-400' : d > 0 ? 'text-red-600' : 'text-green-700');
  const sign = (d) => (Math.abs(d) < 0.5 ? '—' : `${d > 0 ? '+' : '−'}${inr(Math.abs(d))}`);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        What one box costs at your latest bill prices (raw materials + packing + labour), against what you actually sold it for in the last 90 days without GST.
        Courier is not included. Red = cost went up.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b bg-gray-50">
              <th className="text-left py-2 px-3 font-medium">Product (one box)</th>
              <th className="text-right py-2 px-3 font-medium">Cost now</th>
              <th className="text-right py-2 px-3 font-medium">vs 3 months ago</th>
              <th className="text-right py-2 px-3 font-medium">vs 6 months ago</th>
              <th className="text-right py-2 px-3 font-medium">Sold at</th>
              <th className="text-right py-2 px-3 font-medium">Left per box</th>
              <th className="py-2 px-1"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => {
              const isOpen = open === r.sku.id;
              return (
                <React.Fragment key={r.sku.id}>
                  <tr className="cursor-pointer hover:bg-gray-50" onClick={() => setOpen(isOpen ? null : r.sku.id)}>
                    <td className="py-2 px-3 font-medium text-gray-900">{String(r.sku.name || '').trim()}</td>
                    <td className="py-2 px-3 text-right font-semibold">{inr(r.boxNow)}</td>
                    <td className={`py-2 px-3 text-right ${tone(r.boxNow - r.box3)}`}>{sign(r.boxNow - r.box3)}</td>
                    <td className={`py-2 px-3 text-right ${tone(r.boxNow - r.box6)}`}>{sign(r.boxNow - r.box6)}</td>
                    <td className="py-2 px-3 text-right">{inr0(r.price)}<span className="block text-[10px] text-gray-400">{r.priceFrom || 'no sales'}</span></td>
                    <td className="py-2 px-3 text-right">
                      {r.left != null ? (
                        <span className={`font-semibold ${r.margin >= 30 ? 'text-green-700' : r.margin >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                          {inr0(r.left)} <span className="text-xs font-normal">({r.margin.toFixed(0)}%)</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2 px-1">{isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50 px-3 py-3">
                        <div className="grid grid-cols-3 gap-2 text-xs mb-3 max-w-lg">
                          <div className="bg-white rounded p-2 border"><span className="text-gray-500">Raw materials</span><p className="font-semibold">{inr(r.ingNow)}</p></div>
                          <div className="bg-white rounded p-2 border"><span className="text-gray-500">Packing + labour</span><p className="font-semibold">{inr(r.pack)}</p></div>
                          <div className="bg-white rounded p-2 border"><span className="text-gray-500">Box</span><p className="font-semibold">{inr(r.boxNow)}</p></div>
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 border-b">
                              <th className="text-left py-1 pr-2 font-medium">Raw material</th>
                              <th className="text-right py-1 px-2 font-medium">g per box</th>
                              <th className="text-right py-1 px-2 font-medium">₹/kg now</th>
                              <th className="text-right py-1 px-2 font-medium">₹/kg 3 months ago</th>
                              <th className="text-right py-1 px-2 font-medium">Cost per box</th>
                              <th className="text-right py-1 pl-2 font-medium">Change</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {r.lines.map((l, i) => (
                              <tr key={i}>
                                <td className="py-1 pr-2 text-gray-800">{l.name}{!l.fromBill && <span className="text-amber-600"> (recipe price, no bill)</span>}</td>
                                <td className="py-1 px-2 text-right">{Math.round(l.grams)}</td>
                                <td className="py-1 px-2 text-right">{inr0(l.kgNow)}</td>
                                <td className="py-1 px-2 text-right text-gray-500">{inr0(l.kg3)}</td>
                                <td className="py-1 px-2 text-right font-medium">{inr(l.now)}</td>
                                <td className={`py-1 pl-2 text-right ${tone(l.now - l.was3)}`}>{sign(l.now - l.was3)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {r.notFromBills.length > 0 && (
                          <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-600">
                            <AlertTriangle className="w-3 h-3" /> No bill yet for {r.notFromBills.join(', ')}: the price saved on the recipe is used. Link the recipe line to a stock item in SKUs.
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-gray-400">Packing and labour are today's figures from SKUs for all three dates, so the change columns show raw material price moves only.</p>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
