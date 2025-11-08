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
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoice.invoiceNumber || null, // Will be auto-generated if null
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
      
      if (error) throw error;
      
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
          taxRate: parseFloat(data.tax_rate || 0),
          taxAmount: parseFloat(data.tax_amount || 0),
          discountAmount: parseFloat(data.discount_amount || 0),
          totalAmount: parseFloat(data.total_amount || 0),
          status: data.status,
          paymentMethod: data.payment_method,
          paymentDate: data.payment_date,
          notes: data.notes,
          terms: data.terms,
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error creating invoice:', error);
      return { data: null, error };
    }
  },

  async updateInvoice(invoice) {
    if (!isSupabaseAvailable()) return { data: null, error: new Error('Supabase not configured') };
    
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update({
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
        })
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
      
      if (error) throw error;
      
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
          taxRate: parseFloat(data.tax_rate || 0),
          taxAmount: parseFloat(data.tax_amount || 0),
          discountAmount: parseFloat(data.discount_amount || 0),
          totalAmount: parseFloat(data.total_amount || 0),
          status: data.status,
          paymentMethod: data.payment_method,
          paymentDate: data.payment_date,
          notes: data.notes,
          terms: data.terms,
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
};

