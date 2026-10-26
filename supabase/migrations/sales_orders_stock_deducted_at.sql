-- Applied 2026-10-26. Finished boxes leave stock exactly once per order.
alter table public.sales_orders add column if not exists stock_deducted_at timestamptz;

comment on column public.sales_orders.stock_deducted_at is
  'When this order''s finished boxes were taken out of stock (set once when the order reaches fulfilled or later; cleared when returned/cancelled puts them back). Guards against deducting or restocking twice.';

-- Orders already at fulfilled or beyond have had their stock handled under
-- the old code; mark them so moving them on (e.g. to delivered) never
-- deducts again.
update public.sales_orders
set stock_deducted_at = coalesce(updated_at, created_at)
where status in ('fulfilled', 'collected', 'dispatched', 'transit', 'delivered', 'completed')
  and stock_deducted_at is null;
