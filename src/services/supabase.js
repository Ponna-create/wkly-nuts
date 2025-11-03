import { createClient } from '@supabase/supabase-js';

// Supabase configuration - these will be set as environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Using localStorage fallback.');
}

// Create Supabase client
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Check if Supabase is available
export const isSupabaseAvailable = () => {
  return supabase !== null;
};

// Database helper functions
export const dbService = {
  // Vendors
  async getVendors() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform data to match app structure
      const vendors = (data || []).map(vendor => ({
        id: vendor.id,
        name: vendor.name,
        phone: vendor.phone,
        location: vendor.location,
        email: vendor.email,
        ingredients: vendor.ingredients || [],
        created_at: vendor.created_at,
      }));
      
      return { data: vendors, error: null };
    } catch (error) {
      console.error('Error fetching vendors:', error);
      return { data: [], error };
    }
  },

  async createVendor(vendor) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    
    try {
      const { data, error } = await supabase
        .from('vendors')
        .insert([{
          name: vendor.name,
          phone: vendor.phone,
          location: vendor.location,
          email: vendor.email,
          ingredients: vendor.ingredients || [],
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      return { 
        data: {
          id: data.id,
          name: data.name,
          phone: data.phone,
          location: data.location,
          email: data.email,
          ingredients: data.ingredients || [],
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error creating vendor:', error);
      return { data: null, error };
    }
  },

  async updateVendor(vendor) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    
    try {
      const { data, error } = await supabase
        .from('vendors')
        .update({
          name: vendor.name,
          phone: vendor.phone,
          location: vendor.location,
          email: vendor.email,
          ingredients: vendor.ingredients || [],
        })
        .eq('id', vendor.id)
        .select()
        .single();
      
      if (error) throw error;
      
      return { 
        data: {
          id: data.id,
          name: data.name,
          phone: data.phone,
          location: data.location,
          email: data.email,
          ingredients: data.ingredients || [],
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error updating vendor:', error);
      return { data: null, error };
    }
  },

  async deleteVendor(vendorId) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    
    try {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendorId);
      
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting vendor:', error);
      return { error };
    }
  },

  // SKUs
  async getSKUs() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    
    try {
      const { data, error } = await supabase
        .from('skus')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const skus = (data || []).map(sku => ({
        id: sku.id,
        name: sku.name,
        description: sku.description,
        targetWeightPerSachet: sku.target_weight_per_sachet,
        recipes: sku.recipes || {},
        weeklyPack: sku.weekly_pack || {},
        monthlyPack: sku.monthly_pack || {},
        created_at: sku.created_at,
      }));
      
      return { data: skus, error: null };
    } catch (error) {
      console.error('Error fetching SKUs:', error);
      return { data: [], error };
    }
  },

  async createSKU(sku) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    
    try {
      const { data, error } = await supabase
        .from('skus')
        .insert([{
          name: sku.name,
          description: sku.description,
          target_weight_per_sachet: sku.targetWeightPerSachet,
          recipes: sku.recipes || {},
          weekly_pack: sku.weeklyPack || {},
          monthly_pack: sku.monthlyPack || {},
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      return { 
        data: {
          id: data.id,
          name: data.name,
          description: data.description,
          targetWeightPerSachet: data.target_weight_per_sachet,
          recipes: data.recipes || {},
          weeklyPack: data.weekly_pack || {},
          monthlyPack: data.monthly_pack || {},
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error creating SKU:', error);
      return { data: null, error };
    }
  },

  async updateSKU(sku) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    
    try {
      const { data, error } = await supabase
        .from('skus')
        .update({
          name: sku.name,
          description: sku.description,
          target_weight_per_sachet: sku.targetWeightPerSachet,
          recipes: sku.recipes || {},
          weekly_pack: sku.weeklyPack || {},
          monthly_pack: sku.monthlyPack || {},
        })
        .eq('id', sku.id)
        .select()
        .single();
      
      if (error) throw error;
      
      return { 
        data: {
          id: data.id,
          name: data.name,
          description: data.description,
          targetWeightPerSachet: data.target_weight_per_sachet,
          recipes: data.recipes || {},
          weeklyPack: data.weekly_pack || {},
          monthlyPack: data.monthly_pack || {},
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error updating SKU:', error);
      return { data: null, error };
    }
  },

  async deleteSKU(skuId) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    
    try {
      const { error } = await supabase
        .from('skus')
        .delete()
        .eq('id', skuId);
      
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting SKU:', error);
      return { error };
    }
  },

  // Pricing Strategies
  async getPricingStrategies() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    
    try {
      const { data, error } = await supabase
        .from('pricing_strategies')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const strategies = (data || []).map(strategy => ({
        id: strategy.id,
        skuId: strategy.sku_id,
        packType: strategy.pack_type,
        costs: strategy.costs || {},
        margins: strategy.margins || {},
        sellingPrice: strategy.selling_price,
        created_at: strategy.created_at,
      }));
      
      return { data: strategies, error: null };
    } catch (error) {
      console.error('Error fetching pricing strategies:', error);
      return { data: [], error };
    }
  },

  async createPricingStrategy(strategy) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    
    try {
      const { data, error } = await supabase
        .from('pricing_strategies')
        .insert([{
          sku_id: strategy.skuId,
          pack_type: strategy.packType,
          costs: strategy.costs || {},
          margins: strategy.margins || {},
          selling_price: strategy.sellingPrice,
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      return { 
        data: {
          id: data.id,
          skuId: data.sku_id,
          packType: data.pack_type,
          costs: data.costs || {},
          margins: data.margins || {},
          sellingPrice: data.selling_price,
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error creating pricing strategy:', error);
      return { data: null, error };
    }
  },

  async updatePricingStrategy(strategy) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    
    try {
      const { data, error } = await supabase
        .from('pricing_strategies')
        .update({
          sku_id: strategy.skuId,
          pack_type: strategy.packType,
          costs: strategy.costs || {},
          margins: strategy.margins || {},
          selling_price: strategy.sellingPrice,
        })
        .eq('id', strategy.id)
        .select()
        .single();
      
      if (error) throw error;
      
      return { 
        data: {
          id: data.id,
          skuId: data.sku_id,
          packType: data.pack_type,
          costs: data.costs || {},
          margins: data.margins || {},
          sellingPrice: data.selling_price,
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error updating pricing strategy:', error);
      return { data: null, error };
    }
  },

  async deletePricingStrategy(strategyId) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    
    try {
      const { error } = await supabase
        .from('pricing_strategies')
        .delete()
        .eq('id', strategyId);
      
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting pricing strategy:', error);
      return { error };
    }
  },

  // Sales Targets
  async getSalesTargets() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    
    try {
      const { data, error } = await supabase
        .from('sales_targets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const targets = (data || []).map(target => ({
        id: target.id,
        month: target.month,
        year: target.year,
        targets: target.targets || [],
        fixedCosts: target.fixed_costs || {},
        created_at: target.created_at,
      }));
      
      return { data: targets, error: null };
    } catch (error) {
      console.error('Error fetching sales targets:', error);
      return { data: [], error };
    }
  },

  async createSalesTarget(target) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    
    try {
      const { data, error } = await supabase
        .from('sales_targets')
        .insert([{
          month: target.month,
          year: target.year,
          targets: target.targets || [],
          fixed_costs: target.fixedCosts || {},
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      return { 
        data: {
          id: data.id,
          month: data.month,
          year: data.year,
          targets: data.targets || [],
          fixedCosts: data.fixed_costs || {},
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error creating sales target:', error);
      return { data: null, error };
    }
  },

  async updateSalesTarget(target) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    
    try {
      const { data, error } = await supabase
        .from('sales_targets')
        .update({
          month: target.month,
          year: target.year,
          targets: target.targets || [],
          fixed_costs: target.fixedCosts || {},
        })
        .eq('id', target.id)
        .select()
        .single();
      
      if (error) throw error;
      
      return { 
        data: {
          id: data.id,
          month: data.month,
          year: data.year,
          targets: data.targets || [],
          fixedCosts: data.fixed_costs || {},
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error updating sales target:', error);
      return { data: null, error };
    }
  },

  async deleteSalesTarget(targetId) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    
    try {
      const { error } = await supabase
        .from('sales_targets')
        .delete()
        .eq('id', targetId);
      
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting sales target:', error);
      return { error };
    }
  },
};

