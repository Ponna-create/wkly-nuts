-- Applied 2026-10-26 (migration bill_item_memory). Remembers what a name on a
-- supplier bill means, so Quick Bill matches it next time without guessing:
-- vendor_key '*' = any vendor; a row with ingredient_id is an exact item, a
-- row with only product means "this product, ask which grade". Keys are
-- lower-case letters+digits. Seeded with the vendor spellings approved on the
-- item-matching page (38 rows: 29 exact, 9 ask-the-grade); Quick Bill adds a
-- row per vendor + wording each time a bill is saved.
create table if not exists public.bill_item_memory (
  id uuid primary key default gen_random_uuid(),
  vendor_key text not null default '*',
  name_key text not null,
  ingredient_id uuid references public.ingredients(id) on delete cascade,
  product text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_key, name_key)
);
alter table public.bill_item_memory enable row level security;
create policy "App read" on public.bill_item_memory for select to anon, authenticated, service_role using (true);
create policy "App insert" on public.bill_item_memory for insert to anon, authenticated, service_role with check (true);
create policy "App update" on public.bill_item_memory for update to anon, authenticated, service_role using (true) with check (true);
create policy "App delete" on public.bill_item_memory for delete to anon, authenticated, service_role using (true);
