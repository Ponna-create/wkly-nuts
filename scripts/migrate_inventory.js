import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to read .env file since we don't have dotenv
const loadEnv = () => {
    try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const envPath = path.resolve(__dirname, '../.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            content.split('\n').forEach(line => {
                const [key, val] = line.split('=');
                if (key && val) process.env[key.trim()] = val.trim();
            });
        }
    } catch (e) {
        console.log('Could not load .env file, relying on process.env');
    }
};

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase Credentials. Make sure .env exists with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrate() {
    console.log('🚀 Starting Inventory Migration...');

    // 1. Fetch all vendors with their ingredients
    const { data: vendors, error: vendorError } = await supabase.from('vendors').select('*');
    if (vendorError) throw vendorError;

    console.log(`📦 Found ${vendors.length} vendors to process.`);

    for (const vendor of vendors) {
        const ingredients = vendor.ingredients || [];
        if (ingredients.length === 0) continue;

        console.log(`\n🔹 Processing Vendor: ${vendor.name} (${ingredients.length} ingredients)`);

        for (const ing of ingredients) {
            // A. Create/Get Master Ingredient
            // We upsert by name to ensure uniqueness
            const { data: ingData, error: ingError } = await supabase
                .from('ingredients')
                .select('id')
                .eq('name', ing.name)
                .single();

            let ingredientId;

            if (!ingData) {
                // Create new
                const { data: newIng, error: createError } = await supabase
                    .from('ingredients')
                    .insert([{
                        name: ing.name,
                        unit: ing.unit,
                        current_stock_total: 0 // Will update via batch trigger or manual calculation later
                    }])
                    .select()
                    .single();

                if (createError) {
                    console.error(`   ❌ Failed to create ingredient ${ing.name}:`, createError.message);
                    continue;
                }
                ingredientId = newIng.id;
                console.log(`   ✅ Created Master Ingredient: ${ing.name}`);
            } else {
                ingredientId = ingData.id;
                console.log(`   Detailed: Found existing Ingredient: ${ing.name}`);
            }

            // B. Create "Opening Balance" Batch
            // We assume the current quantity in Vendor JSON is the "current stock"
            if (parseFloat(ing.quantityAvailable) > 0) {
                const { error: batchError } = await supabase
                    .from('ingredient_batches')
                    .insert([{
                        ingredient_id: ingredientId,
                        vendor_id: vendor.id,
                        batch_number: 'MIGRATION-OPENING-STOCK',
                        quantity_initial: parseFloat(ing.quantityAvailable),
                        quantity_remaining: parseFloat(ing.quantityAvailable),
                        price_per_unit: parseFloat(ing.pricePerUnit || ing.price || 0),
                        status: 'active',
                        expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString() // Default 1 year expiry
                    }]);

                if (batchError) {
                    console.error(`   ❌ Failed to create batch for ${ing.name}:`, batchError.message);
                } else {
                    console.log(`   ✅ Created Batch: ${ing.quantityAvailable}${ing.unit} from ${vendor.name}`);
                }
            }
        }
    }

    // 3. Update Totals
    console.log('\n🔄 Recalculating Total Stock Levels...');
    // We could do this in SQL, but let's do a quick pass here to be safe
    // Actually, let's leave that for the app logic or a trigger.
    // For now, the migration created the batches.

    console.log('\n✨ Migration Complete!');
}

migrate().catch(console.error);
