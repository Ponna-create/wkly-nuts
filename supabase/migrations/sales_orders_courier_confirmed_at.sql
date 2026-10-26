-- When the courier cost and weight were checked by hand after scanning the
-- slip. Only confirmed rows teach the cost/weight suggestions in the scanner.
alter table public.sales_orders add column if not exists courier_confirmed_at timestamptz;
