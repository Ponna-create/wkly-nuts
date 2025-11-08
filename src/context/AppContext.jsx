import React, { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react';
import { dbService, isSupabaseAvailable } from '../services/supabase';

const AppContext = createContext();

// Load data from localStorage (fallback)
const loadFromLocalStorage = () => {
  try {
    const savedData = localStorage.getItem('wklyNutsAppData');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      return {
        vendors: parsed.vendors || [],
        skus: parsed.skus || [],
        pricingStrategies: parsed.pricingStrategies || [],
        salesTargets: parsed.salesTargets || [],
        customers: parsed.customers || [],
        invoices: parsed.invoices || [],
        toast: null,
      };
    }
  } catch (error) {
    console.error('Error loading from localStorage:', error);
  }
  return {
    vendors: [],
    skus: [],
    pricingStrategies: [],
    salesTargets: [],
    customers: [],
    invoices: [],
    toast: null,
  };
};

// Save to localStorage (fallback)
const saveToLocalStorage = (data) => {
  try {
    localStorage.setItem('wklyNutsAppData', JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

const initialState = {
  vendors: [],
  skus: [],
  pricingStrategies: [],
  salesTargets: [],
  customers: [],
  invoices: [],
  toast: null,
};

function appReducer(state, action) {
  switch (action.type) {
    // Load actions (from database)
    case 'LOAD_VENDORS':
      return { ...state, vendors: action.payload };
    case 'LOAD_SKUS':
      return { ...state, skus: action.payload };
    case 'LOAD_PRICING_STRATEGIES':
      return { ...state, pricingStrategies: action.payload };
    case 'LOAD_SALES_TARGETS':
      return { ...state, salesTargets: action.payload };
    case 'LOAD_CUSTOMERS':
      return { ...state, customers: action.payload };
    case 'LOAD_INVOICES':
      return { ...state, invoices: action.payload };
    case 'LOAD_ALL_DATA':
      return {
        ...state,
        vendors: action.payload.vendors || [],
        skus: action.payload.skus || [],
        pricingStrategies: action.payload.pricingStrategies || [],
        salesTargets: action.payload.salesTargets || [],
        customers: action.payload.customers || [],
        invoices: action.payload.invoices || [],
      };

    // Vendor actions
    case 'ADD_VENDOR':
      return { ...state, vendors: [...state.vendors, action.payload] };
    case 'UPDATE_VENDOR':
      return {
        ...state,
        vendors: state.vendors.map((v) =>
          v.id === action.payload.id ? action.payload : v
        ),
      };
    case 'DELETE_VENDOR':
      return {
        ...state,
        vendors: state.vendors.filter((v) => v.id !== action.payload),
      };

    // SKU actions
    case 'ADD_SKU':
      return { ...state, skus: [...state.skus, action.payload] };
    case 'UPDATE_SKU':
      return {
        ...state,
        skus: state.skus.map((s) =>
          s.id === action.payload.id ? action.payload : s
        ),
      };
    case 'DELETE_SKU':
      return {
        ...state,
        skus: state.skus.filter((s) => s.id !== action.payload),
      };

    // Pricing actions
    case 'ADD_PRICING':
      return { ...state, pricingStrategies: [...state.pricingStrategies, action.payload] };
    case 'UPDATE_PRICING':
      return {
        ...state,
        pricingStrategies: state.pricingStrategies.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      };
    case 'DELETE_PRICING':
      return {
        ...state,
        pricingStrategies: state.pricingStrategies.filter((p) => p.id !== action.payload),
      };

    // Sales Target actions
    case 'ADD_SALES_TARGET':
      return { ...state, salesTargets: [...state.salesTargets, action.payload] };
    case 'UPDATE_SALES_TARGET':
      return {
        ...state,
        salesTargets: state.salesTargets.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      };
    case 'DELETE_SALES_TARGET':
      return {
        ...state,
        salesTargets: state.salesTargets.filter((t) => t.id !== action.payload),
      };

    // Customer actions
    case 'ADD_CUSTOMER':
      return { ...state, customers: [...state.customers, action.payload] };
    case 'UPDATE_CUSTOMER':
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === action.payload.id ? action.payload : c
        ),
      };
    case 'DELETE_CUSTOMER':
      return {
        ...state,
        customers: state.customers.filter((c) => c.id !== action.payload),
      };

    // Invoice actions
    case 'ADD_INVOICE':
      return { ...state, invoices: [...state.invoices, action.payload] };
    case 'UPDATE_INVOICE':
      return {
        ...state,
        invoices: state.invoices.map((i) =>
          i.id === action.payload.id ? action.payload : i
        ),
      };
    case 'DELETE_INVOICE':
      return {
        ...state,
        invoices: state.invoices.filter((i) => i.id !== action.payload),
      };

    // Toast actions
    case 'SHOW_TOAST':
      return { ...state, toast: action.payload };
    case 'HIDE_TOAST':
      return { ...state, toast: null };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatchReducer] = useReducer(appReducer, initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [useDatabase, setUseDatabase] = useState(false);

  // Wrapper dispatch that syncs with database
  const dispatch = useCallback((action) => {
    // First update local state
    dispatchReducer(action);

    // Then sync with database if available (async, don't wait)
    if (useDatabase && isSupabaseAvailable() && !isLoading) {
      // Don't sync LOAD actions
      if (action.type.startsWith('LOAD_') || action.type.startsWith('SHOW_') || action.type.startsWith('HIDE_')) {
        return;
      }

      // Sync with database asynchronously
      (async () => {
        try {
          switch (action.type) {
            case 'ADD_VENDOR':
              const vendorRes = await dbService.createVendor(action.payload);
              if (vendorRes.data && vendorRes.data.id !== action.payload.id) {
                // Update with database ID
                dispatchReducer({ type: 'UPDATE_VENDOR', payload: { ...action.payload, id: vendorRes.data.id } });
              }
              break;
            case 'UPDATE_VENDOR':
              await dbService.updateVendor(action.payload);
              break;
            case 'DELETE_VENDOR':
              await dbService.deleteVendor(action.payload);
              break;
            case 'ADD_SKU':
              const skuRes = await dbService.createSKU(action.payload);
              if (skuRes.data && skuRes.data.id !== action.payload.id) {
                dispatchReducer({ type: 'UPDATE_SKU', payload: { ...action.payload, id: skuRes.data.id } });
              }
              break;
            case 'UPDATE_SKU':
              await dbService.updateSKU(action.payload);
              break;
            case 'DELETE_SKU':
              await dbService.deleteSKU(action.payload);
              break;
            case 'ADD_PRICING':
              const pricingRes = await dbService.createPricingStrategy(action.payload);
              if (pricingRes.data && pricingRes.data.id !== action.payload.id) {
                dispatchReducer({ type: 'UPDATE_PRICING', payload: { ...action.payload, id: pricingRes.data.id } });
              }
              break;
            case 'UPDATE_PRICING':
              await dbService.updatePricingStrategy(action.payload);
              break;
            case 'DELETE_PRICING':
              await dbService.deletePricingStrategy(action.payload);
              break;
            case 'ADD_SALES_TARGET':
              const targetRes = await dbService.createSalesTarget(action.payload);
              if (targetRes.data && targetRes.data.id !== action.payload.id) {
                dispatchReducer({ type: 'UPDATE_SALES_TARGET', payload: { ...action.payload, id: targetRes.data.id } });
              }
              break;
            case 'UPDATE_SALES_TARGET':
              await dbService.updateSalesTarget(action.payload);
              break;
            case 'DELETE_SALES_TARGET':
              await dbService.deleteSalesTarget(action.payload);
              break;
            case 'ADD_CUSTOMER':
              const customerRes = await dbService.createCustomer(action.payload);
              if (customerRes.data && customerRes.data.id !== action.payload.id) {
                dispatchReducer({ type: 'UPDATE_CUSTOMER', payload: { ...action.payload, id: customerRes.data.id } });
              }
              break;
            case 'UPDATE_CUSTOMER':
              await dbService.updateCustomer(action.payload);
              break;
            case 'DELETE_CUSTOMER':
              await dbService.deleteCustomer(action.payload);
              break;
            case 'ADD_INVOICE':
              const invoiceRes = await dbService.createInvoice(action.payload);
              if (invoiceRes.data && invoiceRes.data.id !== action.payload.id) {
                dispatchReducer({ type: 'UPDATE_INVOICE', payload: { ...action.payload, id: invoiceRes.data.id } });
              }
              break;
            case 'UPDATE_INVOICE':
              await dbService.updateInvoice(action.payload);
              break;
            case 'DELETE_INVOICE':
              await dbService.deleteInvoice(action.payload);
              break;
          }
        } catch (error) {
          console.error('Error syncing with database:', error);
        }
      })();
    }
  }, [useDatabase, isLoading]);

  // Check if Supabase is available and load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      if (isSupabaseAvailable()) {
        try {
          setUseDatabase(true);
          // Load all data from Supabase
          const [vendorsRes, skusRes, pricingRes, targetsRes, customersRes, invoicesRes] = await Promise.all([
            dbService.getVendors(),
            dbService.getSKUs(),
            dbService.getPricingStrategies(),
            dbService.getSalesTargets(),
            dbService.getCustomers(),
            dbService.getInvoices(),
          ]);

          dispatchReducer({
            type: 'LOAD_ALL_DATA',
            payload: {
              vendors: vendorsRes.data || [],
              skus: skusRes.data || [],
              pricingStrategies: pricingRes.data || [],
              salesTargets: targetsRes.data || [],
              customers: customersRes.data || [],
              invoices: invoicesRes.data || [],
            },
          });
        } catch (error) {
          console.error('Error loading from database:', error);
          // Fallback to localStorage
          const localData = loadFromLocalStorage();
          dispatchReducer({ type: 'LOAD_ALL_DATA', payload: localData });
          setUseDatabase(false);
        }
      } else {
        // Use localStorage
        const localData = loadFromLocalStorage();
        dispatchReducer({ type: 'LOAD_ALL_DATA', payload: localData });
        setUseDatabase(false);
      }
      
      setIsLoading(false);
    };

    loadData();
  }, []);

  // Save data to localStorage when state changes (fallback only)
  useEffect(() => {
    if (isLoading) return; // Don't save during initial load

    if (!useDatabase) {
      // Save to localStorage as fallback
      saveToLocalStorage({
        vendors: state.vendors,
        skus: state.skus,
        pricingStrategies: state.pricingStrategies,
        salesTargets: state.salesTargets,
        customers: state.customers,
        invoices: state.invoices,
      });
    }
  }, [state.vendors, state.skus, state.pricingStrategies, state.salesTargets, state.customers, state.invoices, isLoading, useDatabase]);

  const showToast = useCallback((message, type = 'success') => {
    dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    setTimeout(() => {
      dispatch({ type: 'HIDE_TOAST' });
    }, 3000);
  }, [dispatch]);

  const value = {
    state,
    dispatch,
    showToast,
    isLoading,
    useDatabase,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
