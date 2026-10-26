-- Applied 2026-10-26 (migration items_products_and_grades). One item list:
-- every stock item is a product + grade with one clear name; stock lots keep
-- pointing at the same ingredient id, so stock and history are unchanged.
-- Choices approved by the owner on the item-matching page.
-- SKU recipe lines (skus.recipes / weekly_pack.singleUnitIngredients) were then
-- linked with stockItemId / stockProduct / stockGrade ('*' = any grade) and
-- packaging lines with packagingId, by a one-off script on the same day.
-- Backup before the change: WKLY-Nuts-Backups/before-item-grades-2026-10-26.

alter table public.ingredients add column if not exists product text;
alter table public.ingredients add column if not exists grade text;

update public.ingredients i set name = v.new_name, product = v.product, grade = v.grade
from (values
  ('Almonds Premium', 'Almonds - Premium', 'Almonds', 'Premium'),
  ('Almonds Regular', 'Almonds - Regular', 'Almonds', 'Regular'),
  ('Cashew A320', 'Cashews - A320', 'Cashews', 'A320'),
  ('Walnuts 2pcs Chile', 'Walnuts', 'Walnuts', 'Chile (2 pcs)'),
  ('Salted Pistachios', 'Pistachios - Salted in shell', 'Pistachios', 'Salted in shell'),
  ('Black Grapes Seedless', 'Black Raisins - Seedless', 'Black Raisins', 'Seedless'),
  ('Drygrapes Indian', 'Yellow Raisins', 'Yellow Raisins', 'Indian'),
  ('Fig Regular', 'Dry Figs - Small', 'Dry Figs', 'Small'),
  ('Dry Dates Yellow', 'Dates - Dry (Yellow)', 'Dates', 'Dry (Yellow)'),
  ('Black Dates', 'Dates - Black', 'Dates', 'Black'),
  ('Pumpkin Seeds', 'Pumpkin Seeds', 'Pumpkin Seeds', 'Standard'),
  ('Sunflower Seed', 'Sunflower Seeds', 'Sunflower Seeds', 'Standard'),
  ('Flax Seed', 'Flax Seeds', 'Flax Seeds', 'Standard'),
  ('Sesame White', 'White Sesame Seeds', 'White Sesame Seeds', 'Standard'),
  ('Foxtail Millet Mint Flakes', 'Foxtail Millet Mint Flakes', 'Foxtail Millet Mint Flakes', 'Standard'),
  ('Little Millet Biriyani Flakes', 'Little Millet Biriyani Flakes', 'Little Millet Biriyani Flakes', 'Standard'),
  ('Kodo Millet Biriyani Flakes', 'Kodo Millet Biriyani Flakes', 'Kodo Millet Biriyani Flakes', 'Standard'),
  ('Barnyard Millet Lemon Flakes', 'Barnyard Millet Lemon Flakes', 'Barnyard Millet Lemon Flakes', 'Standard'),
  ('Green Gram Flakes', 'Green Gram Flakes', 'Green Gram Flakes', 'Standard'),
  ('Horse Gram Flakes', 'Horse Gram Flakes', 'Horse Gram Flakes', 'Standard'),
  ('Finger Millet Flakes', 'Finger Millet Flakes', 'Finger Millet Flakes', 'Standard'),
  ('Party mix', 'Party Mix', 'Party Mix', 'Standard'),
  ('Dates Bite 250g', 'Date Bytes 250g', 'Date Bytes 250g', 'Standard')
) as v(old_name, new_name, product, grade)
where trim(i.name) = v.old_name;

insert into public.ingredients (name, unit, product, grade, current_stock_total)
select v.name, 'Kg', v.product, v.grade, 0
from (values
  ('Cashews - W320', 'Cashews', 'W320'), ('Cashews - W240', 'Cashews', 'W240'),
  ('Black Raisins - With seeds', 'Black Raisins', 'With seeds'), ('Dry Figs - Big', 'Dry Figs', 'Big'),
  ('Pistachios - Plain', 'Pistachios', 'Plain'), ('Dates - Black Royal', 'Dates', 'Black Royal'),
  ('Chia Seeds', 'Chia Seeds', 'Standard')
) as v(name, product, grade)
where not exists (select 1 from public.ingredients x where x.name = v.name);

update public.packaging_materials set name = 'Seed Cycle Red Pouch', updated_at = now() where trim(name) = 'red pochech';
insert into public.packaging_materials (name, category, unit, current_stock, min_stock, cost_per_unit, notes)
select v.name, v.category, 'pcs', 0, 0, v.cost, 'Created 2026-10-26 for one-item-list (product-specific packaging)'
from (values
  ('Day Pack Outer PVC Box', 'other', 17), ('Outer PVC box Sticker', 'sticker', 6),
  ('Combo Pouch (200 g)', 'zipper_bag', 7), ('Millet Sticker', 'sticker', 5.5),
  ('Ragi Flakes Pouch', 'zipper_bag', 6.6), ('Ragi Flakes Label', 'label', 5.5),
  ('Dates Pouch', 'zipper_bag', 5), ('Dates Sticker', 'sticker', 10),
  ('Mexican Bites Silver Cover', 'sachet', 1), ('Mexican Bites Sticker', 'sticker', 1)
) as v(name, category, cost)
where not exists (select 1 from public.packaging_materials x where x.name = v.name);
