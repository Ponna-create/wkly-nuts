import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import VendorManagement from './pages/VendorManagement';
import SKUManagement from './pages/SKUManagement';
import PricingStrategy from './pages/PricingStrategy';
import SalesRevenue from './pages/SalesRevenue';
import VendorComparison from './pages/VendorComparison';
import CustomerManagement from './pages/CustomerManagement';
import InventoryManagement from './pages/InventoryManagement';
import InvoiceManagement from './pages/InvoiceManagement';

function App() {
  return (
    <Auth>
      <AppProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Layout>
            <Routes>
              <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
              <Route path="/vendors" element={<ErrorBoundary><VendorManagement /></ErrorBoundary>} />
              <Route path="/skus" element={<ErrorBoundary><SKUManagement /></ErrorBoundary>} />
              <Route path="/pricing" element={<ErrorBoundary><PricingStrategy /></ErrorBoundary>} />
              <Route path="/sales" element={<ErrorBoundary><SalesRevenue /></ErrorBoundary>} />
              <Route path="/vendor-comparison" element={<ErrorBoundary><VendorComparison /></ErrorBoundary>} />
              <Route path="/customers" element={<ErrorBoundary><CustomerManagement /></ErrorBoundary>} />
              <Route path="/inventory" element={<ErrorBoundary><InventoryManagement /></ErrorBoundary>} />
              <Route path="/invoices" element={<ErrorBoundary><InvoiceManagement /></ErrorBoundary>} />
            </Routes>
          </Layout>
          <Toast />
        </Router>
      </AppProvider>
    </Auth>
  );
}

export default App;
