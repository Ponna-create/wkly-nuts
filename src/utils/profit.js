// The one profit rule, used by Reports and Profit & Cost so they agree.
//
//   Profit = Sales without GST
//          − cost of the boxes sold (boxes × cost per box of the latest finished batch:
//            ingredients + packaging + batch labour)
//          − cost of free sends (promotion / collab boxes, as marketing)
//          − running expenses (cash; not stock bought, not labour bills, not barter)
//          − courier (courier bills or the amounts on the slips, whichever is larger;
//            a slip amount over ₹500 is a misread and is skipped)
//          − labour not spent on batches (packing / general hours from Hours)
//
// Ingredient and packaging bills are not expenses here: they are stock, and
// they count when the boxes made from them are sold. Labour bills ('salary')
// are left out because labour is counted from Hours. Barter marketing is the
// product sent, already in free sends.
import { isPromotionalOrder } from './invoiceFromOrder';
import { costPerBoxInfo, productCostOfOrders } from './productCost';
import { boxesForPacks } from './packSize';

const num = (v) => parseFloat(v) || 0;
const STOCK_CATEGORIES = ['raw_materials', 'packaging'];
const isBarter = (e) => String(e.payment_method || '').toLowerCase().startsWith('barter');
const dayOf = (v) => String(v || '').slice(0, 10);
const expenseDay = (e) => dayOf(e.bill_date || e.payment_date || e.expense_date || e.created_at);
const gstOf = (o) => num(o.gst_amount) + (num(o.shipping_charge) - num(o.shipping_charge) / 1.05);

// from / to: 'YYYY-MM-DD' inclusive
export function computeProfit({ orders, expenses, runs, workLog, skus, from, to }) {
  const inRange = (d) => d && d >= from && d <= to;
  const live = (orders || []).filter(o => inRange(dayOf(o.order_date || o.created_at)) && !['cancelled', 'returned'].includes(o.status));
  const sales = live.filter(o => !isPromotionalOrder(o) && num(o.total_amount) > 0);
  const promos = live.filter(o => isPromotionalOrder(o));

  const salesIncl = sales.reduce((t, o) => t + num(o.total_amount), 0);
  const gst = sales.reduce((t, o) => t + gstOf(o), 0);
  const salesEx = salesIncl - gst;

  // cost of the boxes sold
  // cost per box: latest trusted batch, else the SKU costing estimate
  const { map: costMap, source: costSource } = costPerBoxInfo(runs, skus);
  let cogs = 0;
  const noCost = new Set();
  const estimated = new Set();
  sales.forEach(o => (o.items || []).forEach(it => {
    const id = it.sku_id || it.skuId;
    const sku = (skus || []).find(s => String(s.id) === String(id));
    const boxes = boxesForPacks(sku, it.pack_type || it.packType, it.quantity);
    const name = (sku?.name || it.sku_name || it.skuName || 'Item').trim();
    if (id && costMap[id] !== undefined) {
      cogs += costMap[id] * boxes;
      if (costSource[id] === 'estimate') estimated.add(name);
    } else noCost.add(name);
  }));
  const freeSends = productCostOfOrders(promos, skus, costMap);

  // running expenses (cash, not stock bought, not labour bills)
  const exp = (expenses || []).filter(e => inRange(expenseDay(e)));
  const byCategory = {};
  exp.filter(e => !isBarter(e) && !STOCK_CATEGORIES.includes(e.category) && e.category !== 'salary')
    .forEach(e => { byCategory[e.category || 'misc'] = (byCategory[e.category || 'misc'] || 0) + num(e.total_amount || e.amount); });
  const courierBills = (byCategory.shipping || 0) + (byCategory.courier || 0);
  delete byCategory.shipping; delete byCategory.courier;
  const runningExpenses = Object.values(byCategory).reduce((t, v) => t + v, 0);
  const MAX_SLIP = 500; // more than this on one slip is a misread (e.g. ₹60,620)
  const slipAmounts = live.map(o => num(o.courier_amount)).filter(a => a > 0);
  const courierSlips = slipAmounts.filter(a => a <= MAX_SLIP).reduce((t, a) => t + a, 0);
  const slipsSkipped = slipAmounts.filter(a => a > MAX_SLIP).length;
  const courier = Math.max(courierBills, courierSlips);

  // labour not already inside batch costs
  const work = (workLog || []).filter(w => inRange(dayOf(w.work_date)) && w.work_status !== 'open');
  const labourOther = work.filter(w => !['batch', 'product'].includes(w.work_scope)).reduce((t, w) => t + num(w.cost), 0);

  const profit = salesEx - cogs - freeSends.cost - runningExpenses - courier - labourOther;

  // cash view: every cash bill paid in the period counts, stock bought included
  const cashOut = exp.filter(e => !isBarter(e) && e.category !== 'salary').reduce((t, e) => t + num(e.total_amount || e.amount), 0);
  const labourAll = work.reduce((t, w) => t + num(w.cost), 0);
  const cashLeft = salesEx - cashOut - labourAll;

  return {
    orders: sales.length, salesIncl, gst, salesEx,
    cogs, noCost: [...noCost], estimated: [...estimated], freeSends: freeSends.cost, freeSendCount: promos.length,
    runningExpenses, byCategory, courier, courierBills, courierSlips, slipsSkipped, labourOther,
    profit, margin: salesEx > 0 ? (profit / salesEx) * 100 : 0,
    cashOut, labourAll, cashLeft,
  };
}
