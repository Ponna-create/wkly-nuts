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
        inventory: parsed.inventory || [],
        ingredients: parsed.ingredients || [],
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
    inventory: [],
    ingredients: [],
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
  inventory: [],
  ingredients: [],
  salesOrders: [],
  expenses: [],
  purchaseOrders: [],
  documents: [],
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
    case 'LOAD_INVENTORY':
      return { ...state, inventory: action.payload };
    case 'LOAD_ALL_DATA':
      return {
        ...state,
        vendors: action.payload.vendors || [],
        skus: action.payload.skus || [],
        pricingStrategies: action.payload.pricingStrategies || [],
        salesTargets: action.payload.salesTargets || [],
        customers: action.payload.customers || [],
        invoices: action.payload.invoices || [],
        inventory: action.payload.inventory || [],
        salesOrders: action.payload.salesOrders || [],
        expenses: action.payload.expenses || [],
        purchaseOrders: action.payload.purchaseOrders || [],
        documents: action.payload.documents || [],
      };

    // Sales Order actions
    case 'LOAD_SALES_ORDERS':
      return { ...state, salesOrders: action.payload };
    case 'ADD_SALES_ORDER':
      return { ...state, salesOrders: [...state.salesOrders, action.payload] };
    case 'UPDATE_SALES_ORDER':
      return {
        ...state,
        salesOrders: state.salesOrders.map((o) =>
          o.id === action.payload.id ? action.payload : o
        ),
      };
    case 'DELETE_SALES_ORDER':
      return {
        ...state,
        salesOrders: state.salesOrders.filter((o) => o.id !== action.payload),
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
      // Check for duplicate by phone number before adding
      const existingCustomer = state.customers.find(
        (c) => c.phone && action.payload.phone &&
          c.phone.replace(/\D/g, '') === action.payload.phone.replace(/\D/g, '')
      );
      if (existingCustomer) {
        return state; // Don't add duplicate
      }
      return { ...state, customers: [...state.customers, action.payload] };
    case 'REPLACE_CUSTOMER':
      // Replace customer with temporary ID with the one from database
      return {
        ...state,
        customers: state.customers
          .filter((c) => c.id !== action.payload.tempId)
          .concat(action.payload.customer),
      };
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

    // Inventory actions
    case 'ADD_INVENTORY':
      return { ...state, inventory: [...state.inventory, action.payload] };
    case 'UPDATE_INVENTORY':
      return {
        ...state,
        inventory: state.inventory.map((inv) =>
          inv.id === action.payload.id ? action.payload : inv
        ),
      };
    case 'DELETE_INVENTORY':
      return {
        ...state,
        inventory: state.inventory.filter((inv) => inv.id !== action.payload),
      };

    // Ingredient Actions (Phase 2)
    case 'LOAD_INGREDIENTS':
      return { ...state, ingredients: action.payload };
    case 'UPDATE_INGREDIENT':
      return {
        ...state,
        ingredients: state.ingredients.map(ing =>
          ing.id === action.payload.id ? action.payload : ing
        )
      };

    // Expense actions
    case 'LOAD_EXPENSES':
      return { ...state, expenses: action.payload };
    case 'ADD_EXPENSE':
      return { ...state, expenses: [...state.expenses, action.payload] };
    case 'UPDATE_EXPENSE':
      return { ...state, expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) };

    // Purchase Order actions
    case 'LOAD_PURCHASE_ORDERS':
      return { ...state, purchaseOrders: action.payload };
    case 'ADD_PURCHASE_ORDER':
      return { ...state, purchaseOrders: [...state.purchaseOrders, action.payload] };
    case 'UPDATE_PURCHASE_ORDER':
      return { ...state, purchaseOrders: state.purchaseOrders.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_PURCHASE_ORDER':
      return { ...state, purchaseOrders: state.purchaseOrders.filter(p => p.id !== action.payload) };

    // Document actions
    case 'LOAD_DOCUMENTS':
      return { ...state, documents: action.payload };
    case 'ADD_DOCUMENT':
      return { ...state, documents: [...state.documents, action.payload] };
    case 'DELETE_DOCUMENT':
      return { ...state, documents: state.documents.filter(d => d.id !== action.payload) };

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
              if (customerRes.data) {
                const tempId = action.payload.id;
                dispatchReducer({
                  type: 'REPLACE_CUSTOMER',
                  payload: { tempId, customer: { ...customerRes.data, id: customerRes.data.id } }
                });
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
            case 'ADD_INVENTORY':
              const inventoryRes = await dbService.createInventory(action.payload);
              if (inventoryRes.data && inventoryRes.data.id !== action.payload.id) {
                dispatchReducer({ type: 'UPDATE_INVENTORY', payload: { ...action.payload, id: inventoryRes.data.id } });
              }
              break;
            case 'UPDATE_INVENTORY':
              await dbService.updateInventory(action.payload);
              break;
            case 'DELETE_INVENTORY':
              await dbService.deleteInventory(action.payload);
              break;

            // Ingredient Batch Actions
            case 'ADD_BATCH':
              await dbService.addIngredientBatch(action.payload);
              // Refresh ingredients to get updated totals structure
              const refetched = await dbService.getIngredients();
              if (refetched.data) {
                dispatchReducer({ type: 'LOAD_INGREDIENTS', payload: refetched.data });
              }
              break;
            case 'UPDATE_BATCH_STATUS':
              await dbService.updateBatchStatus(action.payload.id, action.payload.status, action.payload.quantity);
              // Refresh ingredients
              const refetchedStatus = await dbService.getIngredients();
              if (refetchedStatus.data) {
                dispatchReducer({ type: 'LOAD_INGREDIENTS', payload: refetchedStatus.data });
              }
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
          const [vendorsRes, skusRes, pricingRes, targetsRes, customersRes, invoicesRes, inventoryRes, ingredientsRes, salesOrdersRes, expensesRes, purchaseOrdersRes, documentsRes] = await Promise.all([
            dbService.getVendors(),
            dbService.getSKUs(),
            dbService.getPricingStrategies(),
            dbService.getSalesTargets(),
            dbService.getCustomers(),
            dbService.getInvoices(),
            dbService.getInventory(),
            dbService.getIngredients(),
            dbService.getSalesOrders(),
            dbService.getExpenses(),
            dbService.getPurchaseOrders(),
            dbService.getDocuments(),
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
              inventory: inventoryRes.data || [],
              ingredients: ingredientsRes.data || [],
              salesOrders: salesOrdersRes.data || [],
              expenses: expensesRes.data || [],
              purchaseOrders: purchaseOrdersRes.data || [],
              documents: documentsRes.data || [],
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
        inventory: state.inventory,
        ingredients: state.ingredients,
      });
    }
  }, [state.vendors, state.skus, state.pricingStrategies, state.salesTargets, state.customers, state.invoices, state.inventory, state.ingredients, isLoading, useDatabase]);

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
