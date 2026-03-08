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
      // 1. Fetch current vendor data to compare ingredients
      const { data: currentVendor, error: fetchError } = await supabase
        .from('vendors')
        .select('ingredients')
        .eq('id', vendor.id)
        .single();

      if (!fetchError && currentVendor && currentVendor.ingredients) {
        const oldIngredients = currentVendor.ingredients;
        const newIngredients = vendor.ingredients || [];
        const priceHistoryEntries = [];

        // 2. Compare ingredients to find price changes
        for (const newIng of newIngredients) {
          const oldIng = oldIngredients.find(o => o.name === newIng.name);
          if (oldIng) {
            const oldPrice = parseFloat(oldIng.pricePerUnit || 0);
            const newPrice = parseFloat(newIng.pricePerUnit || 0);

            // If price changed significantly (more than 0.01 difference)
            if (Math.abs(oldPrice - newPrice) > 0.01) {
              // Check if history exists to determine if we need a "base" record
              const { count } = await supabase
                .from('price_history')
                .select('*', { count: 'exact', head: true })
                .eq('vendor_id', vendor.id)
                .eq('ingredient_name', newIng.name);

              if (count === 0) {
                // First time logging? Save the OLD price too so we have a baseline
                priceHistoryEntries.push({
                  vendor_id: vendor.id,
                  ingredient_name: newIng.name,
                  price_per_unit: oldPrice,
                  unit: newIng.unit,
                  changed_by: 'system',
                  created_at: new Date(Date.now() - 1000).toISOString() // 1 second ago
                });
              }

              priceHistoryEntries.push({
                vendor_id: vendor.id,
                ingredient_name: newIng.name,
                price_per_unit: newPrice,
                unit: newIng.unit,
                changed_by: 'system',
              });
            }
          }
        }

        // 3. Log changes to price_history table
        if (priceHistoryEntries.length > 0) {
          const { error: historyError } = await supabase
            .from('price_history')
            .insert(priceHistoryEntries);

          if (historyError) {
            console.error('Error logging price history:', historyError);
          }
        }
      }

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

  // Price History & Volatility
  async getPriceHistory(vendorId, ingredientName) {
    if (!isSupabaseAvailable()) return { data: [], error: null };

    try {
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('ingredient_name', ingredientName)
        .order('created_at', { ascending: true }); // Oldest first for charts

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching price history:', error);
      return { data: [], error };
    }
  },

  async getPriceVolatility(ingredientName) {
    if (!isSupabaseAvailable()) return { data: null, error: null };

    try {
      // Get all history for this ingredient across ALL vendors (to see market trend)
      // Limit to last 12 months roughly (last 50 records for simplicity for now)
      const { data, error } = await supabase
        .from('price_history')
        .select('price_per_unit')
        .eq('ingredient_name', ingredientName)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (!data || data.length < 2) {
        return { data: { volatility: 0, min: 0, max: 0, trend: 'stable' }, error: null };
      }

      const prices = data.map(d => parseFloat(d.price_per_unit));
      const max = Math.max(...prices);
      const min = Math.min(...prices);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

      // Calculate volatility score (Standard Deviation or simple Max-Min %)
      // Using simple range percentage relative to average
      const range = max - min;
      const volatilityPercent = (range / avg) * 100;

      return {
        data: {
          volatility: parseFloat(volatilityPercent.toFixed(1)),
          min,
          max,
          avg: parseFloat(avg.toFixed(2)),
          trend: prices[0] > prices[prices.length - 1] ? 'up' : 'down' // Simplistic trend
        },
        error: null
      };
    } catch (error) {
      console.error('Error calcluating volatility:', error);
      return { data: null, error };
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

      const strategies = (data || []).map(strategy => {
        // Transform database format to app format
        const costs = strategy.costs || {};
        const margins = strategy.margins || {};

        return {
          id: strategy.id,
          skuId: strategy.sku_id,
          skuName: strategy.sku_name || '', // Will need to join or fetch separately
          packType: strategy.pack_type,
          // Extract flat fields from costs JSON
          rawMaterialCost: costs.rawMaterialCost || 0,
          sachetPackagingCost: costs.sachetPackagingCost || 0,
          packBoxCost: costs.packBoxCost || 0,
          operatingCost: costs.operatingCost || 0,
          marketingCost: costs.marketingCost || 0,
          shippingCost: costs.shippingCost || 0,
          otherCosts: costs.otherCosts || 0,
          volatilityBuffer: costs.volatilityBuffer || 0,
          totalCost: costs.totalCost || 0,
          // Extract from margins JSON
          profitMargin: margins.profitMargin || 0,
          profitAmount: margins.profitAmount || 0,
          sellingPrice: strategy.selling_price || 0,
          // Keep original for backwards compatibility
          costs: costs,
          margins: margins,
          created_at: strategy.created_at,
        };
      });

      return { data: strategies, error: null };
    } catch (error) {
      console.error('Error fetching pricing strategies:', error);
      return { data: [], error };
    }
  },

  async createPricingStrategy(strategy) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };

    try {
      // Transform flat fields to JSON structure if needed
      const costs = strategy.costs || {
        rawMaterialCost: strategy.rawMaterialCost || 0,
        sachetPackagingCost: strategy.sachetPackagingCost || 0,
        packBoxCost: strategy.packBoxCost || 0,
        operatingCost: strategy.operatingCost || 0,
        marketingCost: strategy.marketingCost || 0,
        shippingCost: strategy.shippingCost || 0,
        otherCosts: strategy.otherCosts || 0,
        volatilityBuffer: strategy.volatilityBuffer || 0,
        totalCost: strategy.totalCost || 0,
      };

      const margins = strategy.margins || {
        profitMargin: strategy.profitMargin || 0,
        profitAmount: strategy.profitAmount || 0,
      };

      const { data, error } = await supabase
        .from('pricing_strategies')
        .insert([{
          sku_id: strategy.skuId,
          pack_type: strategy.packType,
          costs: costs,
          margins: margins,
          selling_price: strategy.sellingPrice || 0,
        }])
        .select()
        .single();

      if (error) throw error;

      // Transform back to flat format for app
      const costsData = data.costs || {};
      const marginsData = data.margins || {};

      return {
        data: {
          id: data.id,
          skuId: data.sku_id,
          skuName: strategy.skuName || '',
          packType: data.pack_type,
          rawMaterialCost: costsData.rawMaterialCost || 0,
          sachetPackagingCost: costsData.sachetPackagingCost || 0,
          packBoxCost: costsData.packBoxCost || 0,
          operatingCost: costsData.operatingCost || 0,
          marketingCost: costsData.marketingCost || 0,
          shippingCost: costsData.shippingCost || 0,
          otherCosts: costsData.otherCosts || 0,
          volatilityBuffer: costsData.volatilityBuffer || 0,
          totalCost: costsData.totalCost || 0,
          profitMargin: marginsData.profitMargin || 0,
          profitAmount: marginsData.profitAmount || 0,
          sellingPrice: data.selling_price || 0,
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
      // Transform flat fields to JSON structure if needed
      const costs = strategy.costs || {
        rawMaterialCost: strategy.rawMaterialCost || 0,
        sachetPackagingCost: strategy.sachetPackagingCost || 0,
        packBoxCost: strategy.packBoxCost || 0,
        operatingCost: strategy.operatingCost || 0,
        marketingCost: strategy.marketingCost || 0,
        shippingCost: strategy.shippingCost || 0,
        otherCosts: strategy.otherCosts || 0,
        volatilityBuffer: strategy.volatilityBuffer || 0,
        totalCost: strategy.totalCost || 0,
      };

      const margins = strategy.margins || {
        profitMargin: strategy.profitMargin || 0,
        profitAmount: strategy.profitAmount || 0,
      };

      const { data, error } = await supabase
        .from('pricing_strategies')
        .update({
          sku_id: strategy.skuId,
          pack_type: strategy.packType,
          costs: costs,
          margins: margins,
          selling_price: strategy.sellingPrice || 0,
        })
        .eq('id', strategy.id)
        .select()
        .single();

      if (error) throw error;

      // Transform back to flat format for app
      const costsData = data.costs || {};
      const marginsData = data.margins || {};

      return {
        data: {
          id: data.id,
          skuId: data.sku_id,
          skuName: strategy.skuName || '',
          packType: data.pack_type,
          rawMaterialCost: costsData.rawMaterialCost || 0,
          sachetPackagingCost: costsData.sachetPackagingCost || 0,
          packBoxCost: costsData.packBoxCost || 0,
          operatingCost: costsData.operatingCost || 0,
          marketingCost: costsData.marketingCost || 0,
          shippingCost: costsData.shippingCost || 0,
          otherCosts: costsData.otherCosts || 0,
          volatilityBuffer: costsData.volatilityBuffer || 0,
          totalCost: costsData.totalCost || 0,
          profitMargin: marginsData.profitMargin || 0,
          profitAmount: marginsData.profitAmount || 0,
          sellingPrice: data.selling_price || 0,
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

  // ============================================================================
  // CUSTOMERS
  // ============================================================================

  async getCustomers() {
    if (!isSupabaseAvailable()) return { data: [], error: null };

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const customers = (data || []).map(customer => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
        gstin: customer.gstin,
        customerType: customer.customer_type,
        notes: customer.notes,
        createdAt: customer.created_at,
      }));

      return { data: customers, error: null };
    } catch (error) {
      console.error('Error fetching customers:', error);
      return { data: [], error };
    }
  },

  async createCustomer(customer) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          pincode: customer.pincode,
          gstin: customer.gstin,
          customer_type: customer.customerType || 'individual',
          notes: customer.notes,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        data: {
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          gstin: data.gstin,
          customerType: data.customer_type,
          notes: data.notes,
        },
        error: null
      };
    } catch (error) {
      console.error('Error creating customer:', error);
      return { data: null, error };
    }
  },

  async updateCustomer(customer) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };

    try {
      const { data, error } = await supabase
        .from('customers')
        .update({
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          pincode: customer.pincode,
          gstin: customer.gstin,
          customer_type: customer.customerType,
          notes: customer.notes,
        })
        .eq('id', customer.id)
        .select()
        .single();

      if (error) throw error;

      return {
        data: {
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          gstin: data.gstin,
          customerType: data.customer_type,
          notes: data.notes,
        },
        error: null
      };
    } catch (error) {
      console.error('Error updating customer:', error);
      return { data: null, error };
    }
  },

  async deleteCustomer(customerId) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting customer:', error);
      return { error };
    }
  },

  // ============================================================================
  // INVOICES
  // ============================================================================

  async getInvoices() {
    if (!isSupabaseAvailable()) return { data: [], error: null };

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (
            id,
            name,
            email,
            phone,
            address,
            gstin
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const invoices = (data || []).map(invoice => ({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        customerId: invoice.customer_id,
        customer: invoice.customers ? {
          id: invoice.customers.id,
          name: invoice.customers.name,
          email: invoice.customers.email,
          phone: invoice.customers.phone,
          address: invoice.customers.address,
          gstin: invoice.customers.gstin,
        } : null,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        items: invoice.items || [],
        subtotal: parseFloat(invoice.subtotal || 0),
        gstRate: parseFloat(invoice.gst_rate || 5),
        gstAmount: parseFloat(invoice.gst_amount || 0),
        discountPercent: parseFloat(invoice.discount_percent || 0),
        discountAmount: parseFloat(invoice.discount_amount || 0),
        shippingCharge: parseFloat(invoice.shipping_charge || 0),
        advancePaid: parseFloat(invoice.advance_paid || 0),
        totalAmount: parseFloat(invoice.total_amount || 0),
        balanceDue: parseFloat(invoice.balance_due || 0),
        status: invoice.status,
        paymentMethod: invoice.payment_method,
        paymentDate: invoice.payment_date,
        notes: invoice.notes,
        terms: invoice.terms,
        createdAt: invoice.created_at,
      }));

      return { data: invoices, error: null };
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return { data: [], error };
    }
  },

  async createInvoice(invoice) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };

    try {
      // For new invoices, use NULL for invoice_number (will be generated when status changes to 'paid')
      // Only use provided invoiceNumber if it's explicitly set and not 'N/A'
      let invoiceNumberValue = null;
      if (invoice.invoiceNumber && invoice.invoiceNumber !== 'N/A') {
        invoiceNumberValue = invoice.invoiceNumber;
      }

      console.log('Creating invoice with data:', {
        invoiceNumber: invoiceNumberValue,
        customerId: invoice.customerId,
        status: invoice.status,
        subtotal: invoice.subtotal,
        totalAmount: invoice.totalAmount
      });

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumberValue, // Use NULL for new invoices (not 'N/A' to avoid duplicate key errors)
          customer_id: invoice.customerId || null,
          invoice_date: invoice.invoiceDate || new Date().toISOString().split('T')[0],
          due_date: invoice.dueDate || null,
          items: invoice.items || [],
          subtotal: invoice.subtotal || 0,
          gst_rate: invoice.gstRate || 5,
          gst_amount: invoice.gstAmount || 0,
          discount_percent: invoice.discountPercent || 0,
          discount_amount: invoice.discountAmount || 0,
          shipping_charge: invoice.shippingCharge || 0,
          advance_paid: invoice.advancePaid || 0,
          total_amount: invoice.totalAmount || 0,
          balance_due: invoice.balanceDue || 0,
          status: invoice.status || 'draft',
          payment_method: invoice.paymentMethod || null,
          payment_date: invoice.paymentDate || null,
          notes: invoice.notes || null,
          terms: invoice.terms || null,
        })
        .select(`
          *,
          customers (
            id,
            name,
            email,
            phone,
            address,
            gstin
          )
        `)
        .single();

      if (error) {
        console.error('❌ Supabase error creating invoice:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      // Map invoice_number: if NULL, use 'N/A' for display
      const invoiceNumber = data.invoice_number || 'N/A';

      console.log('✅ Invoice created successfully:', {
        id: data.id,
        invoiceNumber: invoiceNumber,
        status: data.status
      });

      return {
        data: {
          id: data.id,
          invoiceNumber: invoiceNumber, // Use 'N/A' if NULL for display consistency
          invoice_number: invoiceNumber, // Also set snake_case format
          customerId: data.customer_id,
          customer: data.customers ? {
            id: data.customers.id,
            name: data.customers.name,
            email: data.customers.email,
            phone: data.customers.phone,
            address: data.customers.address,
            gstin: data.customers.gstin,
          } : null,
          invoiceDate: data.invoice_date,
          dueDate: data.due_date,
          items: data.items || [],
          subtotal: parseFloat(data.subtotal || 0),
          gstRate: parseFloat(data.gst_rate || 0),
          gstAmount: parseFloat(data.gst_amount || 0),
          discountPercent: parseFloat(data.discount_percent || 0),
          discountAmount: parseFloat(data.discount_amount || 0),
          shippingCharge: parseFloat(data.shipping_charge || 0),
          advancePaid: parseFloat(data.advance_paid || 0),
          totalAmount: parseFloat(data.total_amount || 0),
          balanceDue: parseFloat(data.balance_due || 0),
          status: data.status,
          paymentMethod: data.payment_method,
          paymentDate: data.payment_date,
          notes: data.notes,
          terms: data.terms,
          createdAt: data.created_at,
        },
        error: null
      };
    } catch (error) {
      console.error('❌❌❌ Error creating invoice:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        fullError: error
      });
      return { data: null, error };
    }
  },

  async updateInvoice(invoice) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };

    try {
      // Prepare update data - explicitly handle invoice_number
      const updateData = {
        customer_id: invoice.customerId,
        invoice_date: invoice.invoiceDate,
        due_date: invoice.dueDate,
        items: invoice.items,
        subtotal: invoice.subtotal,
        gst_rate: invoice.gstRate,
        gst_amount: invoice.gstAmount,
        discount_percent: invoice.discountPercent,
        discount_amount: invoice.discountAmount,
        shipping_charge: invoice.shippingCharge,
        advance_paid: invoice.advancePaid,
        total_amount: invoice.totalAmount,
        balance_due: invoice.balanceDue,
        status: invoice.status,
        payment_method: invoice.paymentMethod,
        payment_date: invoice.paymentDate,
        notes: invoice.notes,
        terms: invoice.terms,
      };

      // ALWAYS update invoice_number if it's provided (even if it was 'N/A' before)
      // This ensures generated invoice numbers are saved
      if (invoice.invoiceNumber !== undefined && invoice.invoiceNumber !== null) {
        updateData.invoice_number = invoice.invoiceNumber;
        console.log('Setting invoice_number in update:', invoice.invoiceNumber);
      } else {
        console.log('WARNING: invoiceNumber is undefined or null, not updating invoice_number field');
      }

      console.log('Updating invoice in database:', {
        id: invoice.id,
        invoice_number: updateData.invoice_number,
        status: updateData.status,
        full_invoice_number: invoice.invoiceNumber
      });

      const { data, error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoice.id)
        .select(`
          *,
          customers (
            id,
            name,
            email,
            phone,
            address,
            gstin
          )
        `)
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from update - invoice may not exist');
      }

      return {
        data: {
          id: data.id,
          invoiceNumber: data.invoice_number,
          customerId: data.customer_id,
          customer: data.customers ? {
            id: data.customers.id,
            name: data.customers.name,
            email: data.customers.email,
            phone: data.customers.phone,
            address: data.customers.address,
            gstin: data.customers.gstin,
          } : null,
          invoiceDate: data.invoice_date,
          dueDate: data.due_date,
          items: data.items || [],
          subtotal: parseFloat(data.subtotal || 0),
          gstRate: parseFloat(data.gst_rate || 0),
          gstAmount: parseFloat(data.gst_amount || 0),
          discountPercent: parseFloat(data.discount_percent || 0),
          discountAmount: parseFloat(data.discount_amount || 0),
          shippingCharge: parseFloat(data.shipping_charge || 0),
          advancePaid: parseFloat(data.advance_paid || 0),
          totalAmount: parseFloat(data.total_amount || 0),
          balanceDue: parseFloat(data.balance_due || 0),
          status: data.status,
          paymentMethod: data.payment_method,
          paymentDate: data.payment_date,
          notes: data.notes,
          terms: data.terms,
          createdAt: data.created_at,
        },
        error: null
      };
    } catch (error) {
      console.error('Error updating invoice:', error);
      return { data: null, error };
    }
  },

  async deleteInvoice(invoiceId) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting invoice:', error);
      return { error };
    }
  },

  // ============================================================================
  // INVENTORY/STOCK MANAGEMENT
  // ============================================================================

  async getInventory() {
    if (!isSupabaseAvailable()) return { data: [], error: null };

    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          skus (
            id,
            name,
            description
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const inventory = (data || []).map(item => ({
        id: item.id,
        skuId: item.sku_id,
        sku: item.skus ? {
          id: item.skus.id,
          name: item.skus.name,
          description: item.skus.description,
        } : null,
        weeklyPacksAvailable: parseFloat(item.weekly_packs_available || 0),
        monthlyPacksAvailable: parseFloat(item.monthly_packs_available || 0),
        lastUpdated: item.last_updated,
        notes: item.notes,
        createdAt: item.created_at,
      }));

      return { data: inventory, error: null };
    } catch (error) {
      console.error('Error fetching inventory:', error);
      return { data: [], error };
    }
  },

  async getInventoryBySkuId(skuId) {
    if (!isSupabaseAvailable()) return { data: null, error: null };

    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          skus (
            id,
            name,
            description
          )
        `)
        .eq('sku_id', skuId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

      if (!data) return { data: null, error: null };

      return {
        data: {
          id: data.id,
          skuId: data.sku_id,
          sku: data.skus ? {
            id: data.skus.id,
            name: data.skus.name,
            description: data.skus.description,
          } : null,
          weeklyPacksAvailable: parseFloat(data.weekly_packs_available || 0),
          monthlyPacksAvailable: parseFloat(data.monthly_packs_available || 0),
          lastUpdated: data.last_updated,
          notes: data.notes,
        },
        error: null
      };
    } catch (error) {
      console.error('Error fetching inventory by SKU:', error);
      return { data: null, error };
    }
  },

  async createInventory(inventory) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };

    try {
      const { data, error } = await supabase
        .from('inventory')
        .insert({
          sku_id: inventory.skuId,
          weekly_packs_available: inventory.weeklyPacksAvailable || 0,
          monthly_packs_available: inventory.monthlyPacksAvailable || 0,
          notes: inventory.notes || null,
          last_updated: new Date().toISOString(),
        })
        .select(`
          *,
          skus (
            id,
            name,
            description
          )
        `)
        .single();

      if (error) throw error;

      return {
        data: {
          id: data.id,
          skuId: data.sku_id,
          sku: data.skus ? {
            id: data.skus.id,
            name: data.skus.name,
            description: data.skus.description,
          } : null,
          weeklyPacksAvailable: parseFloat(data.weekly_packs_available || 0),
          monthlyPacksAvailable: parseFloat(data.monthly_packs_available || 0),
          lastUpdated: data.last_updated,
          notes: data.notes,
        },
        error: null
      };
    } catch (error) {
      console.error('Error creating inventory:', error);
      return { data: null, error };
    }
  },

  async updateInventory(inventory) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };

    try {
      const { data, error } = await supabase
        .from('inventory')
        .update({
          weekly_packs_available: inventory.weeklyPacksAvailable || 0,
          monthly_packs_available: inventory.monthlyPacksAvailable || 0,
          notes: inventory.notes || null,
          last_updated: new Date().toISOString(),
        })
        .eq('id', inventory.id)
        .select(`
          *,
          skus (
            id,
            name,
            description
          )
        `)
        .single();

      if (error) throw error;

      return {
        data: {
          id: data.id,
          skuId: data.sku_id,
          sku: data.skus ? {
            id: data.skus.id,
            name: data.skus.name,
            description: data.skus.description,
          } : null,
          weeklyPacksAvailable: parseFloat(data.weekly_packs_available || 0),
          monthlyPacksAvailable: parseFloat(data.monthly_packs_available || 0),
          lastUpdated: data.last_updated,
          notes: data.notes,
        },
        error: null
      };
    } catch (error) {
      console.error('Error updating inventory:', error);
      return { data: null, error };
    }
  },

  async updateInventoryStock(skuId, packType, quantity, operation = 'subtract') {
    // operation: 'add' or 'subtract'
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };

    // Single-unit pack types (0.5kg, 1kg, single): DB has no single_units_available column yet - skip update
    if (packType === 'single' || packType === '0.5kg' || packType === '1kg') {
      return { data: null, error: null };
    }

    try {
      // First get current inventory
      const currentRes = await this.getInventoryBySkuId(skuId);
      if (currentRes.error) throw currentRes.error;

      const current = currentRes.data;
      if (!current) {
        // Create new inventory record if doesn't exist
        return await this.createInventory({
          skuId,
          weeklyPacksAvailable: packType === 'weekly' ? (operation === 'add' ? quantity : -quantity) : 0,
          monthlyPacksAvailable: packType === 'monthly' ? (operation === 'add' ? quantity : -quantity) : 0,
        });
      }

      const field = packType === 'weekly' ? 'weekly_packs_available' : 'monthly_packs_available';
      const currentValue = packType === 'weekly'
        ? current.weeklyPacksAvailable
        : current.monthlyPacksAvailable;

      const newValue = operation === 'add'
        ? currentValue + quantity
        : Math.max(0, currentValue - quantity); // Don't go below 0

      const updateData = {
        id: current.id,
        weeklyPacksAvailable: packType === 'weekly' ? newValue : current.weeklyPacksAvailable,
        monthlyPacksAvailable: packType === 'monthly' ? newValue : current.monthlyPacksAvailable,
        notes: current.notes,
      };

      return await this.updateInventory(updateData);
    } catch (error) {
      console.error('Error updating inventory stock:', error);
      return { data: null, error };
    }
  },

  async deleteInventory(inventoryId) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };

    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', inventoryId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting inventory:', error);
      return { error };
    }
  },

  // Raw Material Inventory (Phase 2: Batches)
  async getIngredients() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select(`
          *,
          ingredient_batches (
            id,
            batch_number,
            quantity_remaining,
            expiry_date,
            status
          )
        `)
        .order('name');

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching ingredients:', error);
      return { data: [], error };
    }
  },

  async getIngredientBatches(ingredientId) {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    try {
      const { data, error } = await supabase
        .from('ingredient_batches')
        .select(`
            *,
            vendors (name)
        `)
        .eq('ingredient_id', ingredientId)
        .order('expiry_date', { ascending: true }); // FIFO: Expiring first

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching batches:', error);
      return { data: [], error };
    }
  },

  async addIngredientBatch(batch) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    try {
      // 1. Create the batch
      const { data, error } = await supabase
        .from('ingredient_batches')
        .insert([{
          ingredient_id: batch.ingredientId,
          vendor_id: batch.vendorId,
          batch_number: batch.batchNumber,
          quantity_initial: batch.quantity,
          quantity_remaining: batch.quantity,
          price_per_unit: batch.price,
          expiry_date: batch.expiryDate,
          received_date: batch.receivedDate || new Date().toISOString(),
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;

      // 2. Update Master Ingredient Total Stock
      await this.recalculateIngredientStock(batch.ingredientId);

      return { data, error: null };
    } catch (error) {
      console.error('Error adding batch:', error);
      return { data: null, error };
    }
  },

  async updateBatchStatus(batchId, status, quantityRemaining = null) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    try {
      const updatePayload = { status };
      if (quantityRemaining !== null) {
        updatePayload.quantity_remaining = quantityRemaining;
      }

      const { data, error } = await supabase
        .from('ingredient_batches')
        .update(updatePayload)
        .eq('id', batchId)
        .select()
        .single();

      if (error) throw error;

      // Update total stock
      if (data) {
        await this.recalculateIngredientStock(data.ingredient_id);
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error updating batch:', error);
      return { error };
    }
  },

  async recalculateIngredientStock(ingredientId) {
    try {
      // Sum all active batches
      const { data, error } = await supabase
        .from('ingredient_batches')
        .select('quantity_remaining')
        .eq('ingredient_id', ingredientId)
        .eq('status', 'active');

      if (error) throw error;

      const total = data.reduce((sum, b) => sum + parseFloat(b.quantity_remaining || 0), 0);

      await supabase
        .from('ingredients')
        .update({ current_stock_total: total })
        .eq('id', ingredientId);

    } catch (error) {
      console.error('Error recalculating stock:', error);
    }
  },

  /**
   * FIFO Consumption: Deduct quantity from oldest batches first
   * @param {string} ingredientId - UUID of the ingredient
   * @param {number} quantityNeeded - Amount to consume
   * @returns {Promise<{success: boolean, consumed: Array, error?: string}>}
   */
  async consumeIngredientFIFO(ingredientId, quantityNeeded) {
    if (!isSupabaseAvailable()) return { success: false, error: 'Supabase not configured' };

    try {
      // 1. Get all active batches sorted by expiry (FIFO)
      const { data: batches, error: fetchError } = await supabase
        .from('ingredient_batches')
        .select('*')
        .eq('ingredient_id', ingredientId)
        .eq('status', 'active')
        .gt('quantity_remaining', 0)
        .order('expiry_date', { ascending: true }); // Oldest first

      if (fetchError) throw fetchError;

      if (!batches || batches.length === 0) {
        return { success: false, error: 'No active batches available' };
      }

      // 2. Calculate total available
      const totalAvailable = batches.reduce((sum, b) => sum + parseFloat(b.quantity_remaining), 0);
      if (totalAvailable < quantityNeeded) {
        return {
          success: false,
          error: `Insufficient stock. Need: ${quantityNeeded}, Available: ${totalAvailable}`
        };
      }

      // 3. Consume from batches (FIFO)
      let remaining = quantityNeeded;
      const consumedBatches = [];

      for (const batch of batches) {
        if (remaining <= 0) break;

        const batchQty = parseFloat(batch.quantity_remaining);
        const toConsume = Math.min(remaining, batchQty);
        const newQty = batchQty - toConsume;

        // Update batch
        const updatePayload = {
          quantity_remaining: newQty,
          status: newQty <= 0 ? 'consumed' : 'active'
        };

        const { error: updateError } = await supabase
          .from('ingredient_batches')
          .update(updatePayload)
          .eq('id', batch.id);

        if (updateError) throw updateError;

        consumedBatches.push({
          batchId: batch.id,
          batchNumber: batch.batch_number,
          consumed: toConsume,
          remaining: newQty
        });

        remaining -= toConsume;
      }

      // 4. Recalculate total stock
      await this.recalculateIngredientStock(ingredientId);

      return {
        success: true,
        consumed: consumedBatches,
        totalConsumed: quantityNeeded
      };

    } catch (error) {
      console.error('Error consuming ingredient (FIFO):', error);
      return { success: false, error: error.message };
    }
  },

  // Sales Orders (Phase 1)
  async getSalesOrders() {
    if (!isSupabaseAvailable()) return { data: [], error: null };

    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers (
            id,
            name,
            email,
            phone,
            address,
            city,
            state,
            pincode
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching sales orders:', error);
      return { data: [], error };
    }
  },

  async getSalesOrderById(orderId) {
    if (!isSupabaseAvailable()) return { data: null, error: null };

    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers (
            id,
            name,
            email,
            phone,
            address,
            city,
            state,
            pincode,
            gstin
          ),
          invoices (
            id,
            invoice_number,
            status
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching sales order:', error);
      return { data: null, error };
    }
  },

  async createSalesOrder(order) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };

    try {
      // Generate order number
      const { data: seqData } = await supabase.rpc('nextval', { name: 'sales_order_number_seq' });
      const orderNumber = `SO-${new Date().getFullYear()}-${String(seqData || 1).padStart(5, '0')}`;

      const { data, error } = await supabase
        .from('sales_orders')
        .insert([{
          order_number: orderNumber,
          customer_id: order.customerId,
          customer_name: order.customerName,
          order_date: order.orderDate || new Date().toISOString().split('T')[0],
          order_source: order.orderSource,
          items: order.items || [],
          subtotal: order.subtotal || 0,
          gst_rate: order.gstRate || 5,
          gst_amount: order.gstAmount || 0,
          discount_percent: order.discountPercent || 0,
          discount_amount: order.discountAmount || 0,
          shipping_charge: order.shippingCharge || 0,
          total_amount: order.totalAmount || 0,
          payment_method: order.paymentMethod,
          payment_status: order.paymentStatus || 'pending',
          amount_paid: order.amountPaid || 0,
          balance_due: order.balanceDue || 0,
          payment_date: order.paymentDate,
          transaction_id: order.transactionId,
          status: order.status || 'packing',
          follow_up_date: order.followUpDate,
          follow_up_notes: order.followUpNotes,
          shipping_address: order.shippingAddress,
          courier_name: order.courierName,
          tracking_number: order.trackingNumber,
          dispatch_date: order.dispatchDate,
          estimated_delivery_date: order.estimatedDeliveryDate,
          actual_delivery_date: order.actualDeliveryDate,
          shipping_weight: order.shippingWeight,
          qr_code_data: order.qrCodeData,
          invoice_id: order.invoiceId,
          zoho_order_id: order.zohoOrderId,
          notes: order.notes,
          internal_notes: order.internalNotes
        }])
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error creating sales order:', error);
      return { data: null, error };
    }
  },

  async updateSalesOrder(order) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };

    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .update({
          customer_id: order.customerId,
          customer_name: order.customerName,
          order_source: order.orderSource,
          items: order.items || [],
          subtotal: order.subtotal,
          gst_rate: order.gstRate,
          gst_amount: order.gstAmount,
          discount_percent: order.discountPercent,
          discount_amount: order.discountAmount,
          shipping_charge: order.shippingCharge,
          total_amount: order.totalAmount,
          payment_method: order.paymentMethod,
          payment_status: order.paymentStatus,
          amount_paid: order.amountPaid,
          balance_due: order.balanceDue,
          payment_date: order.paymentDate,
          transaction_id: order.transactionId,
          status: order.status,
          follow_up_date: order.followUpDate,
          follow_up_notes: order.followUpNotes,
          shipping_address: order.shippingAddress,
          courier_name: order.courierName,
          tracking_number: order.trackingNumber,
          dispatch_date: order.dispatchDate,
          estimated_delivery_date: order.estimatedDeliveryDate,
          actual_delivery_date: order.actualDeliveryDate,
          shipping_weight: order.shippingWeight,
          qr_code_data: order.qrCodeData,
          invoice_id: order.invoiceId,
          feedback_sent: order.feedbackSent,
          feedback_rating: order.feedbackRating,
          feedback_text: order.feedbackText,
          feedback_date: order.feedbackDate,
          notes: order.notes,
          internal_notes: order.internalNotes
        })
        .eq('id', order.id)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error updating sales order:', error);
      return { data: null, error };
    }
  },

  async deleteSalesOrder(orderId) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };

    try {
      const { error } = await supabase
        .from('sales_orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Error deleting sales order:', error);
      return { error };
    }
  },

  async getSalesOrdersByStatus(status) {
    if (!isSupabaseAvailable()) return { data: [], error: null };

    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching orders by status:', error);
      return { data: [], error };
    }
  },

  async getSalesOrdersByDate(startDate, endDate) {
    if (!isSupabaseAvailable()) return { data: [], error: null };

    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('*')
        .gte('order_date', startDate)
        .lte('order_date', endDate)
        .order('order_date', { ascending: false });

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching orders by date:', error);
      return { data: [], error };
    }
  },

  // ==========================================
  // EXPENSES
  // ==========================================

  async getExpenses() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching expenses:', error);
      return { data: [], error };
    }
  },

  async createExpense(expense) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    try {
      const { data: seqData } = await supabase.rpc('nextval', { name: 'expense_number_seq' });
      const expenseNumber = `EXP-${new Date().getFullYear()}-${String(seqData || 1).padStart(5, '0')}`;

      const { data, error } = await supabase
        .from('expenses')
        .insert([{
          expense_number: expenseNumber,
          category: expense.category,
          subcategory: expense.subcategory,
          description: expense.description,
          vendor_id: expense.vendorId,
          vendor_name: expense.vendorName,
          payee_name: expense.payeeName,
          amount: expense.amount || 0,
          gst_amount: expense.gstAmount || 0,
          total_amount: expense.totalAmount || 0,
          payment_method: expense.paymentMethod,
          payment_status: expense.paymentStatus || 'paid',
          transaction_id: expense.transactionId,
          payment_date: expense.paymentDate || new Date().toISOString().split('T')[0],
          bill_number: expense.billNumber,
          bill_date: expense.billDate,
          bill_image_url: expense.billImageUrl,
          purchase_order_id: expense.purchaseOrderId,
          sales_order_id: expense.salesOrderId,
          notes: expense.notes,
          is_recurring: expense.isRecurring || false,
          recurring_frequency: expense.recurringFrequency,
        }])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating expense:', error);
      return { data: null, error };
    }
  },

  async updateExpense(expense) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    try {
      const { data, error } = await supabase
        .from('expenses')
        .update({
          category: expense.category,
          subcategory: expense.subcategory,
          description: expense.description,
          vendor_name: expense.vendor_name,
          payee_name: expense.payee_name,
          amount: expense.amount,
          gst_amount: expense.gst_amount,
          total_amount: expense.total_amount,
          payment_method: expense.payment_method,
          payment_status: expense.payment_status,
          transaction_id: expense.transaction_id,
          payment_date: expense.payment_date,
          bill_number: expense.bill_number,
          bill_date: expense.bill_date,
          bill_image_url: expense.bill_image_url,
          notes: expense.notes,
        })
        .eq('id', expense.id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating expense:', error);
      return { data: null, error };
    }
  },

  async deleteExpense(id) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting expense:', error);
      return { error };
    }
  },

  // ==========================================
  // DOCUMENTS
  // ==========================================

  async getDocuments() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching documents:', error);
      return { data: [], error };
    }
  },

  async uploadDocument(file, metadata) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('wkly-nuts-docs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('wkly-nuts-docs')
        .getPublicUrl(filePath);

      // Save document record
      const { data, error } = await supabase
        .from('documents')
        .insert([{
          name: metadata.name || file.name,
          description: metadata.description,
          document_type: metadata.documentType || 'misc',
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          expense_id: metadata.expenseId,
          vendor_id: metadata.vendorId,
          sales_order_id: metadata.salesOrderId,
          tags: metadata.tags || [],
        }])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error uploading document:', error);
      return { data: null, error };
    }
  },

  async deleteDocument(id) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting document:', error);
      return { error };
    }
  },

  // ==========================================
  // PURCHASE ORDERS
  // ==========================================

  async getPurchaseOrders() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('order_date', { ascending: false });
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      return { data: [], error };
    }
  },

  async createPurchaseOrder(po) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    try {
      const { data: seqData } = await supabase.rpc('nextval', { name: 'purchase_order_number_seq' });
      const poNumber = `PO-${new Date().getFullYear()}-${String(seqData || 1).padStart(5, '0')}`;

      const { data, error } = await supabase
        .from('purchase_orders')
        .insert([{
          po_number: poNumber,
          vendor_id: po.vendorId,
          vendor_name: po.vendorName,
          order_date: po.orderDate || new Date().toISOString().split('T')[0],
          expected_delivery_date: po.expectedDeliveryDate,
          items: po.items || [],
          subtotal: po.subtotal || 0,
          gst_amount: po.gstAmount || 0,
          shipping_charge: po.shippingCharge || 0,
          total_amount: po.totalAmount || 0,
          payment_method: po.paymentMethod,
          payment_status: po.paymentStatus || 'pending',
          amount_paid: po.amountPaid || 0,
          payment_date: po.paymentDate,
          transaction_id: po.transactionId,
          status: po.status || 'ordered',
          bill_number: po.billNumber,
          bill_image_url: po.billImageUrl,
          quality_notes: po.qualityNotes,
          notes: po.notes,
        }])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating purchase order:', error);
      return { data: null, error };
    }
  },

  async updatePurchaseOrder(po) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .update({
          vendor_name: po.vendor_name,
          expected_delivery_date: po.expected_delivery_date,
          actual_delivery_date: po.actual_delivery_date,
          items: po.items,
          subtotal: po.subtotal,
          gst_amount: po.gst_amount,
          shipping_charge: po.shipping_charge,
          total_amount: po.total_amount,
          payment_method: po.payment_method,
          payment_status: po.payment_status,
          amount_paid: po.amount_paid,
          payment_date: po.payment_date,
          transaction_id: po.transaction_id,
          status: po.status,
          bill_number: po.bill_number,
          bill_image_url: po.bill_image_url,
          quality_notes: po.quality_notes,
          notes: po.notes,
        })
        .eq('id', po.id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating purchase order:', error);
      return { data: null, error };
    }
  },

  async deletePurchaseOrder(id) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    try {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      return { error };
    }
  },

  // ==========================================
  // PRODUCTION RUNS
  // ==========================================

  async getProductionRuns() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    try {
      const { data, error } = await supabase
        .from('production_runs')
        .select('*')
        .order('batch_date', { ascending: false });
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching production runs:', error);
      return { data: [], error };
    }
  },

  async createProductionRun(run) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    try {
      const { data: seqData } = await supabase.rpc('nextval', { name: 'production_run_number_seq' });
      const runNumber = `PR-${new Date().getFullYear()}-${String(seqData || 1).padStart(5, '0')}`;

      // Get SKU instance numbers if quantity > 0
      let instanceStart = null;
      let instanceEnd = null;
      if (run.plannedQuantity > 0 && run.skuCode) {
        const dateStr = (run.batchDate || new Date().toISOString().split('T')[0]).replace(/-/g, '').slice(4); // MMDD
        try {
          const { data: instanceData } = await supabase.rpc('get_next_sku_instance', {
            p_sku_code: run.skuCode,
            p_date: run.batchDate || new Date().toISOString().split('T')[0],
            p_quantity: run.plannedQuantity,
          });
          if (instanceData && instanceData[0]) {
            const year = (run.batchDate || new Date().toISOString().split('T')[0]).slice(0, 4);
            instanceStart = `${run.skuCode}-${year}-${dateStr}-${String(instanceData[0].start_num).padStart(3, '0')}`;
            instanceEnd = `${run.skuCode}-${year}-${dateStr}-${String(instanceData[0].end_num).padStart(3, '0')}`;
          }
        } catch (e) {
          console.warn('Could not generate SKU instance numbers:', e);
        }
      }

      const { data, error } = await supabase
        .from('production_runs')
        .insert([{
          run_number: runNumber,
          sku_id: run.skuId,
          sku_name: run.skuName,
          sku_code: run.skuCode,
          batch_date: run.batchDate || new Date().toISOString().split('T')[0],
          planned_quantity: run.plannedQuantity || 0,
          actual_quantity: run.actualQuantity || 0,
          pack_type: run.packType || 'weekly',
          status: run.status || 'planned',
          ingredients_used: run.ingredientsUsed || [],
          packaging_used: run.packagingUsed || [],
          instance_start: instanceStart,
          instance_end: instanceEnd,
          ingredient_cost: run.ingredientCost || 0,
          packaging_cost: run.packagingCost || 0,
          labor_cost: run.laborCost || 0,
          total_cost: run.totalCost || 0,
          cost_per_unit: run.costPerUnit || 0,
          notes: run.notes,
        }])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating production run:', error);
      return { data: null, error };
    }
  },

  async updateProductionRun(run) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    try {
      const updateData = {
        status: run.status,
        actual_quantity: run.actual_quantity,
        rejected_quantity: run.rejected_quantity,
        ingredients_used: run.ingredients_used,
        packaging_used: run.packaging_used,
        quality_status: run.quality_status,
        quality_notes: run.quality_notes,
        ingredient_cost: run.ingredient_cost,
        packaging_cost: run.packaging_cost,
        labor_cost: run.labor_cost,
        total_cost: run.total_cost,
        cost_per_unit: run.cost_per_unit,
        notes: run.notes,
      };

      if (run.status === 'in_progress' && !run.started_at) {
        updateData.started_at = new Date().toISOString();
      }
      if (run.status === 'completed' && !run.completed_at) {
        updateData.completed_at = new Date().toISOString();
      }
      if (run.quality_status && run.quality_status !== 'pending') {
        updateData.quality_checked_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('production_runs')
        .update(updateData)
        .eq('id', run.id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating production run:', error);
      return { data: null, error };
    }
  },

  async deleteProductionRun(id) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    try {
      const { error } = await supabase.from('production_runs').delete().eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting production run:', error);
      return { error };
    }
  },

  // ==========================================
  // PACKAGING MATERIALS
  // ==========================================
  async getPackagingMaterials() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    try {
      const { data, error } = await supabase
        .from('packaging_materials')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching packaging materials:', error);
      return { data: [], error };
    }
  },

  async createPackagingMaterial(material) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    try {
      const { data, error } = await supabase
        .from('packaging_materials')
        .insert([{
          name: material.name,
          category: material.category || 'other',
          unit: material.unit || 'pcs',
          current_stock: material.current_stock || 0,
          min_stock: material.min_stock || 0,
          cost_per_unit: material.cost_per_unit || 0,
          vendor_name: material.vendor_name,
          notes: material.notes,
        }])
        .select()
        .single();
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating packaging material:', error);
      return { data: null, error };
    }
  },

  async updatePackagingMaterial(material) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    try {
      const updateData = {};
      if (material.name !== undefined) updateData.name = material.name;
      if (material.category !== undefined) updateData.category = material.category;
      if (material.unit !== undefined) updateData.unit = material.unit;
      if (material.current_stock !== undefined) updateData.current_stock = material.current_stock;
      if (material.min_stock !== undefined) updateData.min_stock = material.min_stock;
      if (material.cost_per_unit !== undefined) updateData.cost_per_unit = material.cost_per_unit;
      if (material.vendor_name !== undefined) updateData.vendor_name = material.vendor_name;
      if (material.notes !== undefined) updateData.notes = material.notes;
      if (material.last_purchase_date !== undefined) updateData.last_purchase_date = material.last_purchase_date;
      if (material.last_purchase_qty !== undefined) updateData.last_purchase_qty = material.last_purchase_qty;
      if (material.last_purchase_cost !== undefined) updateData.last_purchase_cost = material.last_purchase_cost;

      const { data, error } = await supabase
        .from('packaging_materials')
        .update(updateData)
        .eq('id', material.id)
        .select()
        .single();
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating packaging material:', error);
      return { data: null, error };
    }
  },

  async deletePackagingMaterial(id) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    try {
      const { error } = await supabase.from('packaging_materials').delete().eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting packaging material:', error);
      return { error };
    }
  },

  // Packaging Transactions
  async getPackagingTransactions() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    try {
      const { data, error } = await supabase
        .from('packaging_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching packaging transactions:', error);
      return { data: [], error };
    }
  },

  async createPackagingTransaction(txn) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    try {
      const { data, error } = await supabase
        .from('packaging_transactions')
        .insert([{
          material_id: txn.material_id,
          type: txn.type || 'purchase',
          quantity: txn.quantity || 0,
          unit_cost: txn.unit_cost || 0,
          total_cost: txn.total_cost || 0,
          production_run_id: txn.production_run_id || null,
          reference_note: txn.reference_note,
          transaction_date: txn.transaction_date || new Date().toISOString().split('T')[0],
        }])
        .select()
        .single();
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating packaging transaction:', error);
      return { data: null, error };
    }
  },

  // ==========================================
  // MARKETING CONTACTS
  // ==========================================
  async getMarketingContacts() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    try {
      const { data, error } = await supabase
        .from('marketing_contacts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { data: (data || []).map(c => ({
        id: c.id, name: c.name, platform: c.platform, handle: c.handle,
        followers: c.followers, contactDate: c.contact_date, status: c.status,
        fee: c.fee, commissionPercent: c.commission_percent,
        ordersGenerated: c.orders_generated, revenueGenerated: c.revenue_generated,
        notes: c.notes, createdAt: c.created_at,
      })), error: null };
    } catch (error) {
      console.error('Error fetching marketing contacts:', error);
      return { data: [], error };
    }
  },

  async createMarketingContact(contact) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    try {
      const { data, error } = await supabase
        .from('marketing_contacts')
        .insert([{
          name: contact.name, platform: contact.platform, handle: contact.handle,
          followers: contact.followers || 0, contact_date: contact.contactDate,
          status: contact.status || 'contacted', fee: contact.fee || 0,
          commission_percent: contact.commissionPercent || 0,
          orders_generated: contact.ordersGenerated || 0,
          revenue_generated: contact.revenueGenerated || 0, notes: contact.notes,
        }])
        .select().single();
      if (error) throw error;
      return { data: { ...contact, id: data.id, createdAt: data.created_at }, error: null };
    } catch (error) {
      console.error('Error creating marketing contact:', error);
      return { data: null, error };
    }
  },

  async updateMarketingContact(contact) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    try {
      const { error } = await supabase
        .from('marketing_contacts')
        .update({
          name: contact.name, platform: contact.platform, handle: contact.handle,
          followers: contact.followers, contact_date: contact.contactDate,
          status: contact.status, fee: contact.fee,
          commission_percent: contact.commissionPercent,
          orders_generated: contact.ordersGenerated,
          revenue_generated: contact.revenueGenerated, notes: contact.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contact.id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error updating marketing contact:', error);
      return { error };
    }
  },

  async deleteMarketingContact(id) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    try {
      const { error } = await supabase.from('marketing_contacts').delete().eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting marketing contact:', error);
      return { error };
    }
  },

  // ==========================================
  // MARKETING CAMPAIGNS
  // ==========================================
  async getMarketingCampaigns() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    try {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { data: (data || []).map(c => ({
        id: c.id, campaignName: c.campaign_name, platform: c.platform,
        budget: c.budget, spend: c.spend, startDate: c.start_date, endDate: c.end_date,
        status: c.status, impressions: c.impressions, clicks: c.clicks,
        ordersAttributed: c.orders_attributed, revenueAttributed: c.revenue_attributed,
        notes: c.notes, createdAt: c.created_at,
      })), error: null };
    } catch (error) {
      console.error('Error fetching marketing campaigns:', error);
      return { data: [], error };
    }
  },

  async createMarketingCampaign(campaign) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    try {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .insert([{
          campaign_name: campaign.campaignName, platform: campaign.platform,
          budget: campaign.budget || 0, spend: campaign.spend || 0,
          start_date: campaign.startDate, end_date: campaign.endDate,
          status: campaign.status || 'active', impressions: campaign.impressions || 0,
          clicks: campaign.clicks || 0, orders_attributed: campaign.ordersAttributed || 0,
          revenue_attributed: campaign.revenueAttributed || 0, notes: campaign.notes,
        }])
        .select().single();
      if (error) throw error;
      return { data: { ...campaign, id: data.id, createdAt: data.created_at }, error: null };
    } catch (error) {
      console.error('Error creating marketing campaign:', error);
      return { data: null, error };
    }
  },

  async updateMarketingCampaign(campaign) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    try {
      const { error } = await supabase
        .from('marketing_campaigns')
        .update({
          campaign_name: campaign.campaignName, platform: campaign.platform,
          budget: campaign.budget, spend: campaign.spend,
          start_date: campaign.startDate, end_date: campaign.endDate,
          status: campaign.status, impressions: campaign.impressions, clicks: campaign.clicks,
          orders_attributed: campaign.ordersAttributed,
          revenue_attributed: campaign.revenueAttributed, notes: campaign.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaign.id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error updating marketing campaign:', error);
      return { error };
    }
  },

  async deleteMarketingCampaign(id) {
    if (!isSupabaseAvailable()) return { error: new Error('Supabase not configured') };
    try {
      const { error } = await supabase.from('marketing_campaigns').delete().eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting marketing campaign:', error);
      return { error };
    }
  },

  // ==========================================
  // INVENTORY FLOW ORCHESTRATION
  // ==========================================

  // P2: PO Received → Stock-in raw materials
  async stockInFromPurchaseOrder(po) {
    const results = { success: 0, errors: [] };
    const items = Array.isArray(po.items) ? po.items : [];
    if (items.length === 0) return results;

    for (const item of items) {
      try {
        const itemName = (item.ingredient_name || item.name || '').trim();
        if (!itemName) continue;

        // Find ingredient by name (case-insensitive)
        let ingredient = null;
        if (isSupabaseAvailable()) {
          const { data } = await supabase
            .from('ingredients')
            .select('id, name')
            .ilike('name', itemName)
            .limit(1)
            .maybeSingle();
          ingredient = data;
        }

        // Create ingredient if not found
        if (!ingredient && isSupabaseAvailable()) {
          const { data: created } = await supabase
            .from('ingredients')
            .insert({ name: itemName, unit: item.unit || 'kg', current_stock_total: 0, safety_stock_level: 0 })
            .select('id, name')
            .single();
          ingredient = created;
        }

        if (!ingredient) {
          results.errors.push(`${itemName}: Could not find/create ingredient`);
          continue;
        }

        // Add batch via existing function
        const qty = parseFloat(item.quantity_kg || item.quantity || 0);
        const price = parseFloat(item.unit_price || item.rate || 0);
        await this.addIngredientBatch({
          ingredientId: ingredient.id,
          vendorId: po.vendor_id || null,
          batchNumber: `${po.po_number || 'PO'}-${itemName}`,
          quantity: qty,
          price: price,
          expiryDate: null,
          receivedDate: new Date().toISOString().split('T')[0],
        });
        results.success++;
      } catch (err) {
        results.errors.push(`${item.ingredient_name || item.name}: ${err.message}`);
      }
    }
    return results;
  },

  // P3: Production Completed → Deduct raw materials + packaging, add finished goods
  async completeProductionRun(run) {
    const results = { ingredientsDeducted: 0, packagingDeducted: 0, finishedGoodsAdded: false, errors: [] };

    // 1. Deduct raw materials
    for (const ing of (run.ingredients_used || [])) {
      try {
        const ingName = (ing.ingredient_name || ing.name || '').trim();
        if (!ingName) continue;

        const { data: ingredient } = await supabase
          .from('ingredients')
          .select('id')
          .ilike('name', ingName)
          .limit(1)
          .maybeSingle();

        if (ingredient) {
          // Convert grams to kg if needed
          let qty = parseFloat(ing.quantity_grams || ing.quantity || 0);
          if (ing.quantity_grams) qty = qty / 1000;

          if (qty > 0) {
            const consumeResult = await this.consumeIngredientFIFO(ingredient.id, qty);
            if (consumeResult.success) {
              results.ingredientsDeducted++;
            } else {
              results.errors.push(`${ingName}: ${consumeResult.error || 'Insufficient stock'}`);
            }
          }
        } else {
          results.errors.push(`${ingName}: Ingredient not found in stock`);
        }
      } catch (err) {
        results.errors.push(`Ingredient ${ing.ingredient_name || ing.name}: ${err.message}`);
      }
    }

    // 2. Deduct packaging materials
    for (const pkg of (run.packaging_used || [])) {
      try {
        const pkgName = (pkg.material_name || pkg.name || '').trim();
        if (!pkgName) continue;

        const { data: materials } = await supabase
          .from('packaging_materials')
          .select('id, current_stock')
          .ilike('name', `%${pkgName}%`)
          .limit(1);

        if (materials && materials.length > 0) {
          const mat = materials[0];
          const qty = parseFloat(pkg.quantity || 0);
          if (qty > 0) {
            const newStock = Math.max(0, (mat.current_stock || 0) - qty);
            await this.createPackagingTransaction({
              material_id: mat.id,
              type: 'usage',
              quantity: qty,
              production_run_id: run.id,
              reference_note: `Production ${run.run_number || run.id}`,
            });
            await this.updatePackagingMaterial({ id: mat.id, current_stock: newStock });
            results.packagingDeducted++;
          }
        }
      } catch (err) {
        results.errors.push(`Packaging ${pkg.material_name || pkg.name}: ${err.message}`);
      }
    }

    // 3. Add finished goods to inventory
    try {
      const skuId = run.sku_id;
      const qty = parseInt(run.actual_quantity) || 0;
      const packType = run.pack_type || 'weekly';
      if (skuId && qty > 0) {
        await this.updateInventoryStock(skuId, packType, qty, 'add');
        results.finishedGoodsAdded = true;
      }
    } catch (err) {
      results.errors.push(`Finished goods: ${err.message}`);
    }

    return results;
  },

  // P4: Order Dispatched → Deduct finished goods
  async deductInventoryForOrder(order) {
    const results = { deducted: 0, warnings: [] };
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) return results;

    for (const item of items) {
      try {
        const skuId = item.sku_id || item.skuId;
        const packType = item.pack_type || item.packType || 'weekly';
        const quantity = parseInt(item.quantity) || 1;
        if (!skuId) continue;

        // Check current stock
        const currentRes = await this.getInventoryBySkuId(skuId);
        const current = currentRes.data;
        const available = current
          ? (packType === 'weekly' ? (current.weeklyPacksAvailable || 0) : (current.monthlyPacksAvailable || 0))
          : 0;

        if (available < quantity) {
          results.warnings.push(`${item.sku_name || item.skuName || 'SKU'} ${packType}: need ${quantity}, have ${available}`);
        }

        await this.updateInventoryStock(skuId, packType, quantity, 'subtract');
        results.deducted++;
      } catch (err) {
        results.warnings.push(`${item.sku_name || item.skuName}: ${err.message}`);
      }
    }
    return results;
  },

  // P1: Zoho Import helpers
  async findOrderByZohoId(zohoOrderId) {
    if (!isSupabaseAvailable() || !zohoOrderId) return null;
    try {
      const { data } = await supabase
        .from('sales_orders')
        .select('id, order_number')
        .eq('zoho_order_id', zohoOrderId)
        .maybeSingle();
      return data;
    } catch { return null; }
  },

  async findCustomerByPhone(phone) {
    if (!isSupabaseAvailable() || !phone) return null;
    try {
      const cleaned = phone.replace(/\D/g, '').slice(-10);
      if (cleaned.length < 10) return null;
      const { data } = await supabase
        .from('customers')
        .select('*')
        .like('phone', `%${cleaned}%`)
        .limit(1)
        .maybeSingle();
      return data;
    } catch { return null; }
  },

  // ==========================================
  // STOCK ALERTS
  // ==========================================
  async getLowStockAlerts() {
    const alerts = [];

    try {
      // 1. Raw material alerts - ingredients below safety_stock_level
      if (isSupabaseAvailable()) {
        const { data: ingredients } = await supabase
          .from('ingredients')
          .select('id, name, unit, current_stock_total, safety_stock_level')
          .order('name');

        if (ingredients) {
          for (const ing of ingredients) {
            const threshold = parseFloat(ing.safety_stock_level) || 2; // default 2kg
            const stock = parseFloat(ing.current_stock_total) || 0;
            if (stock <= threshold) {
              alerts.push({
                type: 'raw_material',
                severity: stock === 0 ? 'critical' : stock <= threshold * 0.5 ? 'high' : 'medium',
                name: ing.name,
                currentStock: stock,
                threshold: threshold,
                unit: ing.unit || 'kg',
                message: stock === 0
                  ? `${ing.name}: OUT OF STOCK!`
                  : `${ing.name}: ${stock} ${ing.unit || 'kg'} left (min: ${threshold} ${ing.unit || 'kg'})`,
              });
            }
          }
        }

        // 2. Check for expiring batches (within 7 days)
        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        const { data: expiringBatches } = await supabase
          .from('ingredient_batches')
          .select('id, batch_number, expiry_date, quantity_remaining, ingredient_id, ingredients(name, unit)')
          .eq('status', 'active')
          .gt('quantity_remaining', 0)
          .lte('expiry_date', weekFromNow.toISOString().split('T')[0])
          .order('expiry_date', { ascending: true });

        if (expiringBatches) {
          for (const batch of expiringBatches) {
            const daysLeft = Math.ceil((new Date(batch.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
            const isExpired = daysLeft < 0;
            alerts.push({
              type: 'expiring_batch',
              severity: isExpired ? 'critical' : daysLeft <= 3 ? 'high' : 'medium',
              name: batch.ingredients?.name || 'Unknown',
              batchNumber: batch.batch_number,
              expiryDate: batch.expiry_date,
              daysLeft: daysLeft,
              quantity: batch.quantity_remaining,
              unit: batch.ingredients?.unit || 'kg',
              message: isExpired
                ? `${batch.ingredients?.name} batch ${batch.batch_number}: EXPIRED! (${batch.quantity_remaining} ${batch.ingredients?.unit || 'kg'} remaining)`
                : `${batch.ingredients?.name} batch ${batch.batch_number}: expires in ${daysLeft} days (${batch.quantity_remaining} ${batch.ingredients?.unit || 'kg'})`,
            });
          }
        }

        // 3. Packaging material alerts - below min_stock
        const { data: packaging } = await supabase
          .from('packaging_materials')
          .select('id, name, category, unit, current_stock, min_stock')
          .order('name');

        if (packaging) {
          for (const pkg of packaging) {
            const minStock = parseFloat(pkg.min_stock) || 0;
            const currentStock = parseFloat(pkg.current_stock) || 0;
            if (minStock > 0 && currentStock <= minStock) {
              alerts.push({
                type: 'packaging',
                severity: currentStock === 0 ? 'critical' : currentStock <= minStock * 0.5 ? 'high' : 'medium',
                name: pkg.name,
                currentStock: currentStock,
                threshold: minStock,
                unit: pkg.unit || 'pcs',
                message: currentStock === 0
                  ? `${pkg.name}: OUT OF STOCK!`
                  : `${pkg.name}: ${currentStock} ${pkg.unit || 'pcs'} left (min: ${minStock})`,
              });
            }
          }
        }

        // 4. Finished goods alerts - low stock (below 5 units)
        const { data: finishedGoods } = await supabase
          .from('inventory')
          .select('*, skus(id, name)')
          .order('last_updated', { ascending: false });

        if (finishedGoods) {
          for (const inv of finishedGoods) {
            const weekly = parseFloat(inv.weekly_packs_available) || 0;
            const monthly = parseFloat(inv.monthly_packs_available) || 0;
            const total = weekly + monthly;
            if (total < 5) {
              alerts.push({
                type: 'finished_goods',
                severity: total === 0 ? 'critical' : 'medium',
                name: inv.skus?.name || 'Unknown SKU',
                weeklyStock: weekly,
                monthlyStock: monthly,
                unit: 'boxes',
                message: total === 0
                  ? `${inv.skus?.name}: NO STOCK! Need to produce more.`
                  : `${inv.skus?.name}: Only ${weekly} weekly + ${monthly} monthly packs left`,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching stock alerts:', error);
    }

    // Sort: critical first, then high, then medium
    const severityOrder = { critical: 0, high: 1, medium: 2 };
    alerts.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

    return alerts;
  },

  // Get ingredients with full batch details for production form dropdown
  async getIngredientsForProduction() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select(`
          id, name, unit, current_stock_total, safety_stock_level,
          ingredient_batches (
            id, batch_number, quantity_remaining, expiry_date, status, price_per_unit
          )
        `)
        .order('name');
      if (error) throw error;
      // Filter to only active batches with stock
      const enriched = (data || []).map(ing => ({
        ...ing,
        ingredient_batches: (ing.ingredient_batches || [])
          .filter(b => b.status === 'active' && b.quantity_remaining > 0)
          .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date)), // FIFO
      }));
      return { data: enriched, error: null };
    } catch (error) {
      console.error('Error fetching ingredients for production:', error);
      return { data: [], error };
    }
  },

  // Get packaging materials for production form dropdown
  async getPackagingForProduction() {
    if (!isSupabaseAvailable()) return { data: [], error: null };
    try {
      const { data, error } = await supabase
        .from('packaging_materials')
        .select('id, name, category, unit, current_stock, min_stock')
        .gt('current_stock', 0)
        .order('name');
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching packaging for production:', error);
      return { data: [], error };
    }
  },
};
