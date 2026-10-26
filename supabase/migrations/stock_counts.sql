-- Applied 2026-10-26 (migration stock_counts). One row per item counted on the
-- shelf (Inventory > Stock count): what the app had, what was counted, and the
-- difference applied as an adjustment (dbService.saveStockCount).
create table if not exists public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  counted_at timestamptz not null default now(),
  item_type text not null,        -- finished | ingredient | packaging
  item_id text not null,
  item_name text,
  unit text,
  before_qty numeric,
  counted_qty numeric not null,
  difference numeric,
  note text
);
alter table public.stock_counts enable row level security;
create policy "App read" on public.stock_counts for select to anon, authenticated, service_role using (true);
create policy "App insert" on public.stock_counts for insert to anon, authenticated, service_role with check (true);
