import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';

const AppContext = createContext();

// Load data from localStorage
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
    toast: null,
  };
};

const initialState = loadFromLocalStorage();

function appReducer(state, action) {
  switch (action.type) {
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
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Save to localStorage whenever state changes (except toast)
  useEffect(() => {
    try {
      const dataToSave = {
        vendors: state.vendors,
        skus: state.skus,
        pricingStrategies: state.pricingStrategies,
        salesTargets: state.salesTargets,
      };
      localStorage.setItem('wklyNutsAppData', JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [state.vendors, state.skus, state.pricingStrategies, state.salesTargets]);

  const showToast = useCallback((message, type = 'success') => {
    dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    setTimeout(() => {
      dispatch({ type: 'HIDE_TOAST' });
    }, 3000);
  }, []);

  const value = {
    state,
    dispatch,
    showToast,
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
