import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { isPromotionalOrder } from '../utils/invoiceFromOrder';
import { boxesForPacks, boxesPerMonthly } from '../utils/packSize';
import { formatDate } from '../utils/dateFormat';
import { computeProfit } from '../utils/profit';
import { costPerBoxInfo } from '../utils/productCost';

// One page that answers: what did we sell, what did it cost to make, what did
// we spend on ads, what did we waste, and what is each product earning.
// Everything here comes from what she already enters in Quick Order, Bill,
// Batch and Hours. Where a number can't be worked out yet it says so.

const num = (v) => parseFloat(v) || 0;
const inr = (v) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const inr2 = (v) => `₹${(Math.round(v * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthOf = (d) => String(d || '').slice(0, 7);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const CATEGORY_LABEL = {
  raw_materials: 'Raw material', packaging: 'Packaging', advertising: 'Marketing', repairs: 'Machine service',
  shipping: 'Shipping / courier', courier: 'Courier', salary: 'Labour bills', rent: 'Rent', utilities: 'Electricity / water',
  equipment: 'Equipment', misc: 'Other',
};

const SOURCE_LABEL = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', meta_ad: 'Meta Ad', website: 'Website', walkin: 'Walk-in',
  zoho: 'Zoho', amazon: 'Amazon', direct: 'Direct', other: 'Other',
};
function normSource(o) {
  const s = String(o.order_source || '').toLowerCase().trim();
  if (!s) return 'other';
  if (s === 'inst' || s.startsWith('insta')) return 'instagram';
  if (s.includes('meta')) return 'meta_ad';
  if (s.includes('whats')) return 'whatsapp';
  return SOURCE_LABEL[s] ? s : 'other';
}


function Tile({ label, value, sub, tone }) {
  const color = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {hint && <p className="text-xs text-gray-400 mt-0.5 mb-2">{hint}</p>}
      <div className={hint ? '' : 'mt-2'}>{children}</div>
    </section>
  );
}

export default function ProfitReport() {
  const { state } = useApp();
  const [month, setMonth] = useState(thisMonth());
  const [workLog, setWorkLog] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    dbService.getWorkLog().then(r => setWorkLog(r.data || []));
    dbService.getIngredients().then(r => setIngredients(r.data || []));
    dbService.getProductionRuns().then(r => setRuns(r.data || []));
  }, []);

  const skus = state.skus || [];
  const contacts = state.marketingContacts || [];

  const r = useMemo(() => {
    // ---- sales ----
    const monthOrders = (state.salesOrders || []).filter(o => monthOf(o.order_date) === month && o.status !== 'cancelled');
    const sales = monthOrders.filter(o => !isPromotionalOrder(o) && num(o.total_amount) > 0);
    const promoOrders = monthOrders.filter(o => isPromotionalOrder(o));
    const salesIncl = sales.reduce((t, o) => t + num(o.total_amount), 0);
    const gstIn = sales.reduce((t, o) => t + num(o.gst_amount) + (num(o.shipping_charge) - num(o.shipping_charge) / 1.05), 0);
    const salesEx = salesIncl - gstIn;

    // ---- expenses (cash and barter apart) ----
    const monthExp = (state.expenses || []).filter(e => monthOf(e.bill_date || e.payment_date || e.created_at) === month);
    const isBarter = (e) => String(e.payment_method || '').toLowerCase().startsWith('barter');
    const cashExp = monthExp.filter(e => !isBarter(e));
    const barterExp = monthExp.filter(isBarter);
    const byCat = {};
    cashExp.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + num(e.total_amount); });
    const labourBills = byCat.salary || 0;
    const expForProfit = Object.entries(byCat).filter(([k]) => k !== 'salary').reduce((t, [, v]) => t + v, 0);

    // ---- labour from Hours ----
    const monthWork = workLog.filter(w => monthOf(w.work_date) === month && w.work_status !== 'open');
    const labourBy = { production: 0, fulfilment: 0, general: 0 };
    monthWork.forEach(w => {
      const k = (w.work_scope === 'batch' || w.work_scope === 'product') ? 'production' : (w.work_scope === 'fulfilment' ? 'fulfilment' : 'general');
      labourBy[k] += num(w.cost);
    });
    const labourHours = labourBy.production + labourBy.fulfilment + labourBy.general;

    // ---- cost per box: same rule as the profit figure (utils/productCost.js):
    // latest batch that recorded ingredients and packaging, else the SKU costing estimate ----
    const info = costPerBoxInfo(runs, skus);
    const costBySku = {};
    Object.entries(info.map).forEach(([id, perBox]) => {
      if (info.source[id] !== 'batch') { costBySku[id] = { perBox, estimate: true }; return; }
      const x = runs.filter(rr => String(rr.sku_id) === String(id) && rr.status === 'completed' && num(rr.ingredient_cost) > 0 && num(rr.packaging_cost) > 0)
        .sort((a, b) => new Date(b.completed_at || b.batch_date) - new Date(a.completed_at || a.batch_date))[0];
      const runSku = skus.find(sk => String(sk.id) === String(id));
      const mult = x?.pack_type === 'monthly' ? boxesPerMonthly(runSku) : 1;
      const boxes = Math.max(1, num(x?.actual_quantity) * mult);
      costBySku[id] = {
        perBox, batch: x?.batch_number || x?.run_number, date: x?.completed_at || x?.batch_date,
        ing: num(x?.ingredient_cost) / boxes, pkg: num(x?.packaging_cost) / boxes, lab: num(x?.labor_cost) / boxes,
      };
    });
    const monthBatches = runs.filter(x => x.status === 'completed' && monthOf(x.completed_at || x.batch_date) === month);

    // ---- per product ----
    const prod = {};
    sales.forEach(o => {
      (o.items || []).forEach(it => {
        const id = it.sku_id || it.skuId;
        const name = (it.sku_name || it.skuName || 'Other item').trim();
        const key = id || `name:${name}`;
        const sku = skus.find(s => String(s.id) === String(id));
        const gst = num(sku?.gstRate ?? 5);
        const rev = num(it.total) / (1 + gst / 100);
        const units = boxesForPacks(sku, it.pack_type || it.packType, it.quantity);
        if (!prod[key]) prod[key] = { id, name, units: 0, rev: 0 };
        prod[key].units += units;
        prod[key].rev += rev;
      });
    });
    const products = Object.values(prod).map(p => {
      const c = p.id ? costBySku[p.id] : null;
      const cogs = c ? c.perBox * p.units : null;
      return { ...p, perBox: c ? c.perBox : null, estimate: !!c?.estimate, cogs, margin: cogs != null ? p.rev - cogs : null };
    }).sort((a, b) => b.rev - a.rev);

    // ---- sources / marketing ----
    const bySource = {};
    sales.forEach(o => {
      const k = normSource(o);
      bySource[k] = bySource[k] || { orders: 0, revenue: 0 };
      bySource[k].orders += 1;
      bySource[k].revenue += num(o.total_amount);
    });
    const mkt = monthExp.filter(e => e.category === 'advertising');
    const spendOf = (sub) => mkt.filter(e => !isBarter(e) && String(e.subcategory || '').startsWith(sub)).reduce((t, e) => t + num(e.total_amount), 0);
    const metaSpend = spendOf('Meta ads');
    const googleSpend = spendOf('Google ads');
    const influencerCash = spendOf('Influencer');
    const otherMkt = mkt.filter(e => !isBarter(e)).reduce((t, e) => t + num(e.total_amount), 0) - metaSpend - googleSpend - influencerCash;
    const barterValue = mkt.filter(isBarter).reduce((t, e) => t + num(e.total_amount), 0);
    const mktCash = metaSpend + googleSpend + influencerCash + Math.max(0, otherMkt);
    const metaRev = bySource.meta_ad?.revenue || 0;

    const influencers = contacts.map(c => {
      const cash = monthExp.filter(e => String(e.marketing_contact_id || '') === String(c.id) && !isBarter(e)).reduce((t, e) => t + num(e.total_amount), 0);
      const barter = monthExp.filter(e => String(e.marketing_contact_id || '') === String(c.id) && isBarter(e)).reduce((t, e) => t + num(e.total_amount), 0);
      const sent = promoOrders.filter(o => String(o.influencer_id || '') === String(c.id));
      let units = 0; let cost = 0; let costKnown = true;
      sent.forEach(o => (o.items || []).forEach(it => {
        const id = it.sku_id || it.skuId;
        const u = boxesForPacks(skus.find(sk => String(sk.id) === String(id)), it.pack_type || it.packType, it.quantity);
        units += u;
        if (costBySku[id]) cost += costBySku[id].perBox * u; else costKnown = false;
      }));
      return { c, cash, barter, orders: sent.length, units, cost, costKnown };
    }).filter(x => x.cash > 0 || x.barter > 0 || x.orders > 0);

    // ---- waste ----
    const wasteRows = ingredients.map(ing => {
      const lots = ing.ingredient_batches || [];
      const kg = lots.reduce((t, b) => t + num(b.waste_quantity), 0);
      const value = lots.reduce((t, b) => t + num(b.waste_quantity) * num(b.price_per_unit), 0);
      return { name: ing.name, unit: ing.unit || 'Kg', kg, value };
    }).filter(w => w.kg > 0).sort((a, b) => b.value - a.value);
    const wasteTotal = wasteRows.reduce((t, w) => t + w.value, 0);
    // raw material bought and still on the shelf (worth, at what it cost)
    const shelfValue = ingredients.reduce((t, ing) => t + (ing.ingredient_batches || [])
      .filter(b => b.status === 'active')
      .reduce((s2, b) => s2 + num(b.quantity_remaining) * num(b.price_per_unit), 0), 0);
    const rejectedBoxes = monthBatches.reduce((t, x) => t + num(x.rejected_quantity), 0);
    const rejectedValue = monthBatches.reduce((t, x) => t + num(x.rejected_quantity) * num(x.cost_per_unit), 0);

    const profit = salesEx - expForProfit - labourHours;
    return {
      sales, salesIncl, gstIn, salesEx, byCat, labourBills, expForProfit, labourBy, labourHours, profit,
      costBySku, monthBatches, products, bySource, metaSpend, googleSpend, influencerCash, otherMkt: Math.max(0, otherMkt),
      barterValue, mktCash, metaRev, influencers, shelfValue, wasteRows, wasteTotal, rejectedBoxes, rejectedValue, promoCount: promoOrders.length,
    };
  }, [state.salesOrders, state.expenses, workLog, runs, ingredients, month, skus, contacts]);

  // The one profit rule, shared with Reports (utils/profit.js)
  const P = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return computeProfit({ orders: state.salesOrders, expenses: state.expenses, runs, workLog, skus, from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` });
  }, [state.salesOrders, state.expenses, runs, workLog, skus, month]);

  const noCost = r.products.filter(p => p.perBox == null).length;
  const catRows = Object.entries(r.byCat).sort((a, b) => b[1] - a[1]);
  const sourceRows = Object.entries(r.bySource).sort((a, b) => b[1].revenue - a[1].revenue);

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profit &amp; Cost</h1>
          <p className="text-sm text-gray-500">Built from what is entered in Order, Bill, Batch and Hours.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value || thisMonth())}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Sales (without GST)" value={inr(P.salesEx)} sub={`${P.orders} orders · ${inr(P.salesIncl)} with GST`} />
        <Tile label="Cost of boxes sold" value={inr(P.cogs)} sub={P.noCost.length ? `No cost yet: ${P.noCost.join(', ')}` : P.estimated.length ? `Estimated from SKU costing: ${P.estimated.join(', ')}` : 'Latest batch cost per box'} />
        <Tile label="Other costs" value={inr(P.runningExpenses + P.courier + P.freeSends + P.labourOther)}
          sub={`Expenses ${inr(P.runningExpenses)} · courier ${inr(P.courier)} · free sends ${inr(P.freeSends)} · packing ${inr(P.labourOther)}`} />
        <Tile label="Profit" value={inr(P.profit)} tone={P.profit >= 0 ? 'good' : 'bad'} sub={`${P.margin.toFixed(1)}% of sales · same figure as Reports`} />
      </div>
      <p className="text-[11px] text-gray-400 -mt-2">
        Profit counts ingredients and packaging when the boxes made from them are sold, not when the bill is paid.
        Cash left over this month (every bill paid, stock still on the shelf included): <b>{inr(P.cashLeft)}</b>
        {' '}(about {inr(r.shelfValue)} of raw material is on the shelf right now).
        {r.labourBills > 0 && ` Labour bills of ${inr(r.labourBills)} entered in Bill are not added again, to avoid counting wages twice.`}
        {P.slipsSkipped > 0 && ` ${P.slipsSkipped} courier slip amount(s) over ₹500 were skipped as misreads.`}
      </p>

      <Section title="Cost per box" hint="From the most recent finished batch that recorded ingredients and packaging. Products without one use an estimate from their costing in SKU Management.">
        {Object.keys(r.costBySku).length === 0 ? (
          <p className="text-sm text-gray-400">No finished batch with a cost yet. Save a batch, log its hours, then finish it in Quick → Batch.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left py-2 pr-2 font-medium">Product</th>
                  <th className="text-right py-2 px-2 font-medium">Ingredients</th>
                  <th className="text-right py-2 px-2 font-medium">Packaging</th>
                  <th className="text-right py-2 px-2 font-medium">Labour</th>
                  <th className="text-right py-2 pl-2 font-medium">Per box</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(r.costBySku).map(([id, c]) => {
                  const sku = skus.find(s => String(s.id) === String(id));
                  return (
                    <tr key={id}>
                      <td className="py-2 pr-2">
                        <span className="font-medium text-gray-900">{(sku?.name || 'Product').trim()}</span>
                        <span className="block text-[11px] text-gray-400">{c.estimate ? 'Estimate from SKU costing' : `${c.batch} · ${formatDate(c.date)}`}</span>
                      </td>
                      <td className="py-2 px-2 text-right">{c.estimate ? '—' : inr2(c.ing)}</td>
                      <td className="py-2 px-2 text-right">{c.estimate ? '—' : inr2(c.pkg)}</td>
                      <td className="py-2 px-2 text-right">{c.estimate ? '—' : inr2(c.lab)}</td>
                      <td className="py-2 pl-2 text-right font-semibold">{inr2(c.perBox)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Profit per product" hint="Sales without GST minus boxes sold × cost per box.">
        {r.products.length === 0 ? (
          <p className="text-sm text-gray-400">No sales in this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left py-2 pr-2 font-medium">Product</th>
                  <th className="text-right py-2 px-2 font-medium">Boxes</th>
                  <th className="text-right py-2 px-2 font-medium">Sales</th>
                  <th className="text-right py-2 px-2 font-medium">Cost</th>
                  <th className="text-right py-2 pl-2 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {r.products.map(p => (
                  <tr key={p.id || p.name}>
                    <td className="py-2 pr-2 font-medium text-gray-900">{p.name}</td>
                    <td className="py-2 px-2 text-right">{p.units}</td>
                    <td className="py-2 px-2 text-right">{inr(p.rev)}</td>
                    <td className="py-2 px-2 text-right">{p.cogs != null ? <>{inr(p.cogs)}{p.estimate && <span className="block text-[10px] text-amber-600">estimate</span>}</> : <span className="text-amber-600 text-xs">no cost</span>}</td>
                    <td className={`py-2 pl-2 text-right font-semibold ${p.margin == null ? 'text-gray-300' : p.margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {p.margin != null ? `${inr(p.margin)} (${p.rev > 0 ? Math.round((p.margin / p.rev) * 100) : 0}%)` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {noCost > 0 && (
          <p className="text-xs text-amber-700 mt-2">
            {noCost} product(s) have no batch cost and no costing in SKU Management, so their margin can&apos;t be worked out. Fill in their costing, or finish a batch in Quick.
          </p>
        )}
      </Section>

      <Section title="Ad spend vs sales" hint="Orders count when the source was chosen at order time. Older orders were not tagged.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <Tile label="Meta ads spent" value={inr(r.metaSpend)} />
          <Tile label="Sales from Meta Ad orders" value={inr(r.metaRev)} sub={`${r.bySource.meta_ad?.orders || 0} orders`} />
          <Tile label="Return on Meta ads"
            value={r.metaSpend > 0 ? `${(r.metaRev / r.metaSpend).toFixed(1)}×` : '—'}
            tone={r.metaSpend > 0 ? (r.metaRev >= r.metaSpend ? 'good' : 'bad') : undefined}
            sub={r.metaSpend > 0 ? 'sales ÷ ad spend' : 'no Meta spend yet'} />
          <Tile label="All marketing (cash)" value={inr(r.mktCash)} sub={r.barterValue > 0 ? `+ ${inr(r.barterValue)} barter` : undefined} />
        </div>
        {sourceRows.length > 0 && (
          <div className="divide-y divide-gray-100 text-sm">
            {sourceRows.map(([k, v]) => (
              <div key={k} className="flex justify-between py-1.5">
                <span>{SOURCE_LABEL[k] || k} <span className="text-gray-400">· {v.orders} orders</span></span>
                <span className="font-medium">{inr(v.revenue)}</span>
              </div>
            ))}
          </div>
        )}
        {r.influencers.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Influencers</p>
            {r.influencers.map(x => (
              <div key={x.c.id} className="flex justify-between gap-2 py-1.5 border-t border-gray-100 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{x.c.name}</span>
                  <span className="block text-[11px] text-gray-400">
                    {x.orders > 0 ? `${x.units} box(es) sent` : 'no products sent'}
                    {x.orders > 0 && (x.costKnown ? ` · product cost ${inr(x.cost)}` : ' · product cost not known yet')}
                  </span>
                </span>
                <span className="text-right flex-shrink-0">
                  {x.cash > 0 && <span className="block">{inr(x.cash)} cash</span>}
                  {x.barter > 0 && <span className="block text-gray-500">{inr(x.barter)} barter</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Waste">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Tile label="Ingredient waste recorded" value={inr(r.wasteTotal)} sub="all lots so far" />
          <Tile label="Rejected boxes this month" value={`${r.rejectedBoxes}`} sub={r.rejectedValue > 0 ? `≈ ${inr(r.rejectedValue)} at cost` : undefined} />
        </div>
        {r.wasteRows.length === 0 ? (
          <p className="text-sm text-gray-400">No ingredient waste recorded. Use Record waste on a lot in Inventory.</p>
        ) : (
          <div className="divide-y divide-gray-100 text-sm">
            {r.wasteRows.map(w => (
              <div key={w.name} className="flex justify-between py-1.5">
                <span>{w.name}</span>
                <span className="font-medium">{Math.round(w.kg * 100) / 100} {w.unit} · {inr(w.value)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-2">Waste is shown for all time because the date of each waste entry is not stored yet.</p>
      </Section>

      <Section title="Where the money went">
        {catRows.length === 0 ? (
          <p className="text-sm text-gray-400">No expenses entered for this month.</p>
        ) : (
          <div className="divide-y divide-gray-100 text-sm">
            {catRows.map(([k, v]) => (
              <div key={k} className="flex justify-between py-1.5">
                <span>{CATEGORY_LABEL[k] || k}</span><span className="font-medium">{inr(v)}</span>
              </div>
            ))}
            <div className="flex justify-between py-1.5 text-gray-500">
              <span>Labour from Hours</span><span className="font-medium">{inr(r.labourHours)}</span>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Add or fix an entry in <Link className="text-teal-700 underline" to="/quick-bill">Quick → Bill</Link>.
          {r.promoCount > 0 && ` ${r.promoCount} promotion / collab order(s) this month are not counted as sales.`}
        </p>
      </Section>
    </div>
  );
}
