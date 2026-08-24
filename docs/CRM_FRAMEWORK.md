# WKLY Nuts — Customer Growth & Retention Framework

> Locked 2026-08-24. This is the reasoning behind CRM's segmentation, growth-tracking, and outreach system — read this before changing thresholds, adding a new segment, or building an "AI" feature on top of it. The core principle: **every number here must be explainable from raw transaction data. No black-box scores.**

## Why this shape, not a generic CRM tool

Most CRM/marketing platforms (HubSpot, Zoho, Klaviyo) are built around **RFM — Recency, Frequency, Monetary** segmentation. That's not a coincidence this framework arrived at the same three axes independently — it's the correct, standard model for any repeat-purchase business. What generic tools get wrong for a business this size:

- **AI churn-prediction / health-score models are statistically meaningless below a few thousand customers.** WKLY Nuts had 180 tracked customers at the time this was written. A model "learning" patterns from that little data is worse than the simple rules below, and — critically — it can't be explained to a human deciding whether to act on it. Every segment here is derived from 3 numbers you can see: order count, days since last order, ₹ spent.
- **Automation/drip sequences underperform manual outreach at this scale.** Measured fact, not a guess: manual WhatsApp win-back nudges converted ~30% of contacted lapsed customers, vs. an organic (un-contacted) 2nd-order rate of ~5%. Don't automate away a 6x-better channel just because "real CRMs automate."
- **Vanity dashboards get built and never acted on.** Every metric in this framework ships attached to a specific next action (a message template, a filter, a list to work through) — if a number doesn't change what happens next, it doesn't belong here.

## The baseline (as of 2026-08-24, for recalibrating thresholds later)

Pulled directly from `sales_orders`, fulfilled statuses only (`delivered`, `completed`, `in_transit`, `dispatched`):

- **180 customers** total
- **171 (95%) are one-time buyers** — ordered exactly once
- **8 have ordered 2-3 times, 1 has ordered 4-5 times, 0 have ordered 6+ times**
- Average orders/customer: **1.1**. Average LTV: **₹898**. Max LTV so far: **₹9,923**.

**The implication that shapes everything below**: this business is not primarily fighting *churn* (losing established repeat customers) — almost nobody has reached "established repeat" yet. It's fighting **activation** — getting a customer from order #1 to order #2. That's the highest-leverage lever, and the data proves it (5% organic vs 30% nudged). Re-run this query periodically; once the 4-5 and 6+ buckets have real people in them, some of the thresholds below (especially "Loyal") should be revisited.

## The six segments

Computed live in `src/components/CustomerSegments.jsx`, per customer, from **all** their fulfilled orders (not just SKUs with a Reorder Cycle set — LTV/segment should reflect the whole relationship):

| Segment | Rule | Why | Default action |
|---|---|---|---|
| **New** | 1 order, <20 days old | Too early to judge or nudge | Leave alone (maybe a "thanks for your first order" touch) |
| **Ripe for 2nd order** | 1 order, ≥20 days old | **The single highest-leverage list** — 171 people, 5%→30% conversion when contacted | Win-back-style nudge, same energy as a reorder-due message |
| **Repeat** | 2-3 orders, not overdue | Building the habit | Standard reorder-due nudges (existing "Due to Reorder" tab handles this per-SKU) |
| **Loyal** | 4+ orders, not overdue | Rare and valuable — treat individually | Personal touch, not a template |
| **At Risk** | 2+ orders, but now overdue beyond 1.5x their cycle | Was a real repeat relationship, now slipping — different tone than "Ripe" (rekindling, not starting) | "We miss you" message |
| *(flag, not a segment)* **💎 High-value one-timer** | 1 order, LTV ≥ 2x the average one-time-buyer LTV | A big single order deserves higher-touch outreach than a typical ₹300 one-timer | Personal follow-up, not the generic template |

"Overdue" uses the same `effectiveCycleDays()` logic as the existing per-SKU "Due to Reorder" tab (Weekly box cycle × 4 for Monthly, from the SKU's `Reorder Cycle (days)` field) so a customer's segment status never contradicts what that tab says about them. SKUs with no Reorder Cycle set fall back to a neutral 30-day assumption rather than being excluded (unlike the per-SKU due list, which skips them entirely) — Customer Explorer's job is to cover *every* customer, not just cycle-tracked ones.

## Filters (Customer Explorer tab, `/crm`)

- **Segment** (the six above, as chips)
- **SKU** — "who's bought Seed Cycle"
- **City** — geographic view, see below
- **Channel/source** — WhatsApp / Instagram / Amazon / etc.
- **Payment method** — UPI / COD / Cash / Bank Transfer
- **Date range** — filters by *last order date*, so "who ordered last month" / "who hasn't ordered since June" both work with the same control
- **Search** (name/phone) + **sort** (LTV / order count / most recent)

Each row has one-click **Copy** and **WhatsApp** using a segment-appropriate message template (`SEGMENT_MESSAGES` in the component) — contacting the list is never more than one click away from seeing it, matching the "every number needs an action" rule.

## Geography

Revenue/orders/customers by city is the honest starting point for "where should ad spend go" — it shows where demand already exists organically, which is cheaper to lean into than guessing cold. As of 2026-08-24: **Chennai dominates** (~71 orders, ~₹65k revenue, ~64 customers after fixing a casing bug — see below), **Coimbatore is a clear #2** with real organic traction (12 customers) and may be worth a dedicated test campaign.

**Known limitation, stated honestly**: this can't automatically compute a true cost-per-acquisition by city — ad platforms (Meta particularly) usually report spend at the campaign level, not geo-tagged that granularly unless campaigns are deliberately split by city. If/when city-targeted campaigns start, tag spend by city in Marketing so a real CAC-by-city number becomes possible instead of estimated.

**Bug fixed alongside this**: city names were splitting on casing ("Chennai" vs "chennai" — 4 orders' worth of customers were invisible to the "Chennai" bucket). Fixed retroactively (SQL backfill, 2026-08-24) and going forward — `normalizeCity()` in `src/services/supabase.js` title-cases every city on `createCustomer`/`updateCustomer`/`findOrCreateCustomer`.

## Win-back conversion rate

Turns the anecdotal "if I contact 10 lapsed customers, ~3 reorder" into a real, standing number instead of a memory. Computed from the existing `reorder_nudges` table (already logs every WhatsApp nudge sent, with timestamp) cross-referenced against whether that customer placed a new order within 21 days after. Shown at the top of the Customer Explorer tab. Worth watching over time — if it drifts meaningfully from ~30%, that's a signal (message quality, timing, or list quality changing) worth investigating, not just a number to glance past.

## What's deliberately NOT built (and shouldn't be added without revisiting this doc)

- No churn-prediction/health-score ML model — see "why this shape" above. Revisit only once there are thousands of customers, not hundreds.
- No automated drip/sequence messaging — manual WhatsApp outperforms it here. Automating is a downgrade at this scale, not an upgrade.
- No engagement/vanity scores without a tied action.
- Cohort retention curves (by signup month) — not built because "Loyal"/"VIP" are still nearly empty; add once there's a real distribution to show a curve for.

## Recalibration checklist (do this periodically, not just once)

- Re-run the baseline query (customers by order-count bucket) — if "Loyal" (4+) grows past a handful of people, consider splitting it into Loyal (4-5) and VIP (6+) as originally imagined, since there'll finally be enough people to make that split meaningful.
- Watch the win-back conversion rate for drift.
- If "days since last order" thresholds (20 days for New→Ripe, 1.5x cycle for At Risk) start feeling wrong in practice, they're deliberately simple starting points, not sacred — adjust and note why here.
