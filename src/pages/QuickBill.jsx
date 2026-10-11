import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { parseBillPdf } from '../utils/billPdfParser';

// One screen for every rupee going out. A bill/expense is saved once and fans
// out to the place that needs it: raw material -> Inventory lot (with bill
// number + date), packaging -> Packaging stock-in, marketing -> campaign spend
// or influencer fee. Expenses stays the single list of everything spent.

const CATEGORIES = [
  { value: 'raw_materials', label: 'Raw material' },
  { value: 'packaging', label: 'Packaging / sticker' },
  { value: 'advertising', label: 'Marketing' },
  { value: 'repairs', label: 'Machine service' },
  { value: 'shipping', label: 'Shipping / courier' },
  { value: 'salary', label: 'Labour' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Electricity / water' },
  { value: 'misc', label: 'Other' },
];

const MARKETING_TYPES = ['Meta ads', 'Google ads', 'Influencer (cash)', 'Collab (barter value)', 'Other marketing'];
const MACHINES = ['Packing machine', 'Roaster', 'Sealing machine', 'Nitrogen / gas', 'Other'];
const PAY_METHODS = ['UPI', 'Cash', 'Bank Transfer', 'Credit Card'];
const SCOPES = [
  { value: 'sku', title: 'For one product', hint: 'Sticker, pouch or ingredient only for a certain product' },
  { value: 'shared', title: 'Shared by all products', hint: 'Used across products' },
  { value: 'ops', title: 'Running the business', hint: 'Shipping, machine, rent, ads' },
];

const todayStr = () => new Date().toISOString().split('T')[0];
const num = (v) => parseFloat(v) || 0;
const round2 = (v) => Math.round(v * 100) / 100;
const emptyLine = () => ({ key: Math.random().toString(36).slice(2), itemId: '', newName: '', qty: '', amount: '', expiry: '' });

export default function QuickBill() {
  const { state, dispatch, showToast } = useApp();
  const skus = state.skus || [];

  const [billDate, setBillDate] = useState(todayStr());
  const [vendor, setVendor] = useState('');
  const [billNo, setBillNo] = useState('');
  const [payMethod, setPayMethod] = useState('UPI');
  const [category, setCategory] = useState('raw_materials');
  const [scope, setScope] = useState('shared');
  const [skuId, setSkuId] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [amount, setAmount] = useState('');
  const [gst, setGst] = useState('');
  const [desc, setDesc] = useState('');
  const [machine, setMachine] = useState(MACHINES[0]);
  const [machineOther, setMachineOther] = useState('');
  const [marketingType, setMarketingType] = useState(MARKETING_TYPES[0]);
  const [influencerId, setInfluencerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [materials, setMaterials] = useState([]);

  // fetched fresh: an influencer added in Marketing a minute ago must show up here
  const [contacts, setContacts] = useState(state.marketingContacts || []);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState('');
  const [printedTotal, setPrintedTotal] = useState(0);

  useEffect(() => {
    dbService.getMarketingContacts().then(r => setContacts(r.data || []));
    dbService.getIngredients().then(r => setIngredients(r.data || []));
    dbService.getPackagingMaterials().then(r => setMaterials(r.data || []));
  }, []);

  const vendorNames = useMemo(() => {
    const set = new Set();
    (state.expenses || []).forEach(e => { if (e.vendor_name) set.add(e.vendor_name); });
    return [...set].sort();
  }, [state.expenses]);

  const isStockCategory = category === 'raw_materials' || category === 'packaging';
  const isBarter = category === 'advertising' && marketingType.startsWith('Collab');
  const lineTotal = lines.reduce((s, l) => s + num(l.amount), 0);
  // a printed total that differs from the lines only by round-off (<₹5) is what was actually paid
  const billTotal = isStockCategory
    ? (printedTotal > 0 && Math.abs(printedTotal - lineTotal) < 5 ? printedTotal : lineTotal)
    : num(amount);
  const pickList = category === 'raw_materials' ? ingredients : materials;
  const unitOf = (item) => item?.unit || (category === 'raw_materials' ? 'Kg' : 'pcs');

  const setLine = (key, patch) => setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  const resetForm = () => {
    setBillNo(''); setVendor(''); setLines([emptyLine()]); setAmount(''); setGst('');
    setDesc(''); setInfluencerId(''); setMachineOther(''); setPrintedTotal(0); setReadNote('');
  };

  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setReadNote('Photo reading is coming next. For now upload the PDF, or type the bill in.');
      return;
    }
    setReading(true);
    setReadNote('');
    try {
      const bill = await parseBillPdf(file);
      if (!bill.items.length) {
        setReadNote('Could not find item lines in this PDF. Please type the bill in.');
        setReading(false);
        return;
      }
      setCategory('raw_materials');
      if (bill.vendor) setVendor(bill.vendor);
      if (bill.billNo) setBillNo(bill.billNo);
      if (bill.date) setBillDate(bill.date);
      setPrintedTotal(bill.total || 0);
      setLines(bill.items.map(it => {
        const hit = ingredients.find(i => norm(i.name) === norm(it.name))
          || ingredients.find(i => norm(i.name).includes(norm(it.name)) || norm(it.name).includes(norm(i.name)));
        return {
          key: Math.random().toString(36).slice(2),
          itemId: hit ? hit.id : '__new',
          newName: hit ? '' : it.name,
          qty: String(it.qty),
          amount: String(it.amount),
          expiry: '',
        };
      }));
      const newOnes = bill.items.filter(it => !ingredients.some(i => norm(i.name) === norm(it.name))).length;
      setReadNote(`Read ${bill.items.length} items from the bill${newOnes ? `, ${newOnes} matched loosely or are new — check the item names` : ''}. Please check everything before saving.`);
    } catch (err) {
      console.error('Bill PDF read failed:', err);
      setReadNote('Could not read this PDF. Please type the bill in.');
    }
    setReading(false);
  };

  const validate = () => {
    if (billTotal <= 0) return 'Enter the amount';
    if (scope === 'sku' && !skuId) return 'Choose which product this is for';
    if (isStockCategory) {
      if (!vendor.trim()) return 'Enter the vendor so stock can be traced to the bill';
      for (const l of lines) {
        const named = l.itemId && l.itemId !== '__new' ? true : l.newName.trim().length > 0;
        if (!named) return 'Choose the item on every line (or type a new name)';
        if (num(l.qty) <= 0) return 'Enter the quantity on every line';
        if (num(l.amount) <= 0) return 'Enter the amount on every line';
      }
    }
    if (category === 'advertising' && marketingType.startsWith('Influencer') && !influencerId) {
      return 'Choose the influencer (add them in Marketing first if they are not listed)';
    }
    if (category === 'repairs' && machine === 'Other' && !machineOther.trim()) return 'Type the machine name';
    return '';
  };

  const subcategoryText = () => {
    if (category === 'advertising') return marketingType;
    if (category === 'repairs') return machine === 'Other' ? machineOther.trim() : machine;
    return '';
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) { showToast(problem, 'error'); return; }
    setSaving(true);
    const label = CATEGORIES.find(c => c.value === category)?.label || category;
    const gstAmt = num(gst);
    try {
      const { data: expense, error } = await dbService.createExpense({
        category,
        subcategory: subcategoryText(),
        description: desc.trim() || [label, subcategoryText()].filter(Boolean).join(' — '),
        vendorName: vendor.trim() || null,
        amount: round2(billTotal - gstAmt),
        gstAmount: gstAmt,
        totalAmount: round2(billTotal),
        paymentMethod: isBarter ? 'Barter (non-cash)' : payMethod,
        paymentStatus: 'paid',
        paymentDate: billDate,
        billNumber: billNo.trim() || null,
        billDate,
        skuId: scope === 'sku' ? String(skuId) : null,
        expenseScope: scope,
        marketingContactId: influencerId || null,
      });
      if (error || !expense) throw error || new Error('Expense not saved');

      const ref = billNo.trim() ? `Bill ${billNo.trim()}` : 'Bill';
      const notes = [];

      if (category === 'raw_materials') {
        for (const l of lines) {
          let ingredientId = l.itemId;
          let name = ingredients.find(i => String(i.id) === String(l.itemId))?.name;
          if (!ingredientId || ingredientId === '__new') {
            name = l.newName.trim();
            const { data: created, error: ingErr } = await dbService.createIngredient({ name, unit: 'Kg' });
            if (ingErr || !created) throw ingErr || new Error(`Could not create ${name}`);
            ingredientId = created.id;
          }
          const qty = num(l.qty);
          const { error: batchErr } = await dbService.addIngredientBatch({
            ingredientId,
            vendorId: null,
            batchNumber: `${billNo.trim() || 'BILL'}-${(name || 'item').replace(/\s+/g, '').slice(0, 14)}-${billDate}`,
            quantity: qty,
            price: round2(num(l.amount) / qty),
            expiryDate: l.expiry || null,
            receivedDate: billDate,
            expenseId: expense.id,
            billNumber: billNo.trim() || null,
          });
          if (batchErr) throw batchErr;
        }
        notes.push(`${lines.length} item(s) added to Inventory`);
      }

      if (category === 'packaging') {
        const fresh = (await dbService.getPackagingMaterials()).data || [];
        for (const l of lines) {
          let material = fresh.find(m => String(m.id) === String(l.itemId));
          const qty = num(l.qty);
          const unitCost = round2(num(l.amount) / qty);
          if (!material) {
            const { data: created, error: matErr } = await dbService.createPackagingMaterial({
              name: l.newName.trim(), category: 'other', unit: 'pcs', current_stock: 0,
              min_stock: 0, cost_per_unit: unitCost, vendor_name: vendor.trim(),
            });
            if (matErr || !created) throw matErr || new Error(`Could not create ${l.newName}`);
            material = created;
          }
          const { error: txErr } = await dbService.createPackagingTransaction({
            material_id: material.id, type: 'purchase', quantity: qty,
            unit_cost: unitCost, total_cost: round2(num(l.amount)),
            reference_note: `${ref} · ${vendor.trim()}`, expense_id: expense.id,
            transaction_date: billDate,
          });
          if (txErr) throw txErr;
          const { error: upErr } = await dbService.updatePackagingMaterial({
            id: material.id,
            current_stock: num(material.current_stock) + qty,
            cost_per_unit: unitCost,
            vendor_name: vendor.trim() || material.vendor_name,
            last_purchase_date: billDate,
            last_purchase_qty: qty,
            last_purchase_cost: round2(num(l.amount)),
          });
          if (upErr) throw upErr;
        }
        notes.push(`${lines.length} item(s) added to Packaging stock`);
      }

      if (category === 'advertising') {
        if (['Meta ads', 'Google ads', 'Other marketing'].includes(marketingType)) {
          const platform = marketingType === 'Meta ads' ? 'meta' : marketingType === 'Google ads' ? 'google' : 'other';
          const month = billDate.slice(0, 7);
          const name = `${marketingType} ${month}`;
          const existing = ((await dbService.getMarketingCampaigns()).data || [])
            .find(c => c.campaignName === name && c.platform === platform);
          if (existing) {
            await dbService.updateMarketingCampaign({ ...existing, spend: round2(num(existing.spend) + billTotal) });
          } else {
            await dbService.createMarketingCampaign({
              campaignName: name, platform, budget: 0, spend: round2(billTotal),
              startDate: `${month}-01`, status: 'active', notes: 'Created from Quick Bill',
            });
          }
          notes.push('Added to Marketing ad spend');
        } else if (influencerId) {
          const c = contacts.find(x => String(x.id) === String(influencerId));
          if (c) {
            const cash = marketingType.startsWith('Influencer');
            const patch = cash
              ? { ...c, fee: round2(num(c.fee) + billTotal), compensationType: c.compensationType === 'barter' ? 'mixed' : (c.compensationType || 'cash') }
              : { ...c, compensationType: c.compensationType === 'cash' ? 'mixed' : 'barter',
                  barterDetails: [c.barterDetails, `${billDate}: ₹${round2(billTotal)} ${desc.trim()}`].filter(Boolean).join(' | ') };
            await dbService.updateMarketingContact(patch);
            notes.push(`Linked to ${c.name} in Marketing`);
          }
        }
      }

      dispatch({ type: 'ADD_EXPENSE', payload: expense, localOnly: true });
      const summary = `Saved ₹${round2(billTotal).toLocaleString('en-IN')} · ${label}${notes.length ? ' · ' + notes.join(' · ') : ''}`;
      setLastSaved(summary);
      showToast(summary, 'success');
      // refresh pick lists so a just-created item shows up for the next bill
      dbService.getIngredients().then(r => setIngredients(r.data || []));
      dbService.getPackagingMaterials().then(r => setMaterials(r.data || []));
      resetForm();
    } catch (err) {
      console.error('Quick bill save failed:', err);
      showToast(`Could not save everything: ${err?.message || 'unknown error'}. Check Expenses before retrying.`, 'error');
    }
    setSaving(false);
  };

  const field = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent';
  const chip = (on) => `px-3 py-2 rounded-lg text-sm font-medium border ${on ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-300 bg-white text-gray-600'}`;

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quick Bill</h1>
        <p className="text-sm text-gray-500">Every expense in one place. Raw material and packaging bills also go into stock.</p>
      </div>

      {lastSaved && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 text-sm">
          <Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> {lastSaved}
        </div>
      )}

      <div className="bg-white border border-dashed border-teal-300 rounded-xl p-4 text-center">
        <label className="cursor-pointer block">
          <span className="block text-sm font-semibold text-teal-700">{reading ? 'Reading bill…' : 'Upload supplier bill (PDF)'}</span>
          <span className="block text-xs text-gray-500 mt-0.5">Fills the vendor, bill number, date and items. You check it before saving.</span>
          <input type="file" accept="application/pdf,image/*" onChange={handleFile} className="hidden" />
        </label>
        {readNote && <p className="text-xs text-teal-800 mt-2">{readNote}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Bill date</label>
            <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Bill no (if any)</label>
            <input value={billNo} onChange={e => setBillNo(e.target.value)} className={field} placeholder="2381" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Vendor / paid to</label>
          <input list="vendor-list" value={vendor} onChange={e => setVendor(e.target.value)} className={field} placeholder="Sri Balaji Traders" />
          <datalist id="vendor-list">{vendorNames.map(v => <option key={v} value={v} />)}</datalist>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <label className="block text-xs font-semibold text-gray-500 uppercase">What is this for?</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button key={c.value} type="button" onClick={() => { setCategory(c.value); setLines([emptyLine()]); }} className={chip(category === c.value)}>
              {c.label}
            </button>
          ))}
        </div>

        {category === 'advertising' && (
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap gap-2">
              {MARKETING_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setMarketingType(t)} className={chip(marketingType === t)}>{t}</button>
              ))}
            </div>
            {(marketingType.startsWith('Influencer') || marketingType.startsWith('Collab')) && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Influencer</label>
                <select value={influencerId} onChange={e => setInfluencerId(e.target.value)} className={field}>
                  <option value="">{contacts.length ? 'Choose…' : 'No influencers yet — add one in Marketing'}</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.handle ? ` (${c.handle})` : ''}</option>)}
                </select>
                {isBarter && (
                  <p className="text-xs text-amber-700 mt-1">
                    Barter is a non-cash cost. If you sent products, do that in Quick Order (source Promotion / Collab) instead — don't enter them here too.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {category === 'repairs' && (
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap gap-2">
              {MACHINES.map(m => <button key={m} type="button" onClick={() => setMachine(m)} className={chip(machine === m)}>{m}</button>)}
            </div>
            {machine === 'Other' && <input value={machineOther} onChange={e => setMachineOther(e.target.value)} className={field} placeholder="Machine name" />}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <label className="block text-xs font-semibold text-gray-500 uppercase">Whose cost is it?</label>
        <div className="grid gap-2">
          {SCOPES.map(s => (
            <button key={s.value} type="button" onClick={() => setScope(s.value)}
              className={`text-left px-3 py-2.5 rounded-lg border ${scope === s.value ? 'border-teal-500 bg-teal-50' : 'border-gray-300 bg-white'}`}>
              <span className="block text-sm font-semibold text-gray-800">{s.title}</span>
              <span className="block text-xs text-gray-500">{s.hint}</span>
            </button>
          ))}
        </div>
        {scope === 'sku' && (
          <select value={skuId} onChange={e => setSkuId(e.target.value)} className={field}>
            <option value="">Which product?</option>
            {skus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {isStockCategory ? (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <label className="block text-xs font-semibold text-gray-500 uppercase">
            Items on the bill {category === 'raw_materials' ? '(goes into Inventory)' : '(goes into Packaging stock)'}
          </label>
          {lines.map((l, idx) => {
            const item = pickList.find(i => String(i.id) === String(l.itemId));
            return (
              <div key={l.key} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <select value={l.itemId} onChange={e => setLine(l.key, { itemId: e.target.value })} className={field}>
                  <option value="">Choose item…</option>
                  {pickList.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  <option value="__new">+ New item (type below)</option>
                </select>
                {l.itemId === '__new' && (
                  <input value={l.newName} onChange={e => setLine(l.key, { newName: e.target.value })} className={field} placeholder="New item name" />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-0.5">Quantity ({unitOf(item)})</label>
                    <input type="number" inputMode="decimal" min="0" step="any" value={l.qty} onChange={e => setLine(l.key, { qty: e.target.value })} className={field} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-0.5">Amount (₹)</label>
                    <input type="number" inputMode="decimal" min="0" step="any" value={l.amount} onChange={e => setLine(l.key, { amount: e.target.value })} className={field} />
                  </div>
                </div>
                {category === 'raw_materials' && (
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-0.5">Expiry date (optional)</label>
                    <input type="date" value={l.expiry} onChange={e => setLine(l.key, { expiry: e.target.value })} className={field} />
                  </div>
                )}
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines(prev => prev.filter(x => x.key !== l.key))} className="text-xs text-red-600 flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Remove line {idx + 1}
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" onClick={() => setLines(prev => [...prev, emptyLine()])} className="text-sm text-teal-700 font-medium flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add another item
          </button>
          <div className="flex justify-between text-sm pt-1 border-t border-gray-100">
            <span className="text-gray-500">Bill total</span>
            <b>₹{round2(lineTotal).toLocaleString('en-IN')}</b>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Amount (₹)</label>
            <input type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Note (optional)</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} className={field}
              placeholder={category === 'repairs' ? 'What was done' : category === 'advertising' ? 'Campaign or reason' : 'Short note'} />
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">GST in the bill (₹, optional)</label>
            <input type="number" inputMode="decimal" min="0" step="any" value={gst} onChange={e => setGst(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Paid by</label>
            {isBarter ? (
              <div className="px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500">Barter (no cash)</div>
            ) : (
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={field}>
                {PAY_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-gray-50 pt-2 pb-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full min-h-[48px] bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : `Save ₹${round2(billTotal).toLocaleString('en-IN')}`}
        </button>
      </div>
    </div>
  );
}
