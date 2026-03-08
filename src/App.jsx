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
import IngredientInventory from './pages/IngredientInventory';
import InvoiceManagement from './pages/InvoiceManagement';
import SalesOrders from './pages/SalesOrders';
import Expenses from './pages/Expenses';
import PurchaseOrders from './pages/PurchaseOrders';
import Documents from './pages/Documents';
import ProductionRuns from './pages/ProductionRuns';
import PackagingMaterials from './pages/PackagingMaterials';
import Reports from './pages/Reports';
import HelpGuide from './pages/HelpGuide';
import BackupSettings from './pages/BackupSettings';
import Marketing from './pages/Marketing';
import GSTFiling from './pages/GSTFiling';

function App() {
  return (
    <Auth>
      <AppProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Layout>
            <Routes>
              <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
              <Route path="/orders" element={<ErrorBoundary><SalesOrders /></ErrorBoundary>} />
              <Route path="/purchase-orders" element={<ErrorBoundary><PurchaseOrders /></ErrorBoundary>} />
              <Route path="/expenses" element={<ErrorBoundary><Expenses /></ErrorBoundary>} />
              <Route path="/documents" element={<ErrorBoundary><Documents /></ErrorBoundary>} />
              <Route path="/production" element={<ErrorBoundary><ProductionRuns /></ErrorBoundary>} />
              <Route path="/packaging" element={<ErrorBoundary><PackagingMaterials /></ErrorBoundary>} />
              <Route path="/vendors" element={<ErrorBoundary><VendorManagement /></ErrorBoundary>} />
              <Route path="/ingredients" element={<ErrorBoundary><IngredientInventory /></ErrorBoundary>} />
              <Route path="/skus" element={<ErrorBoundary><SKUManagement /></ErrorBoundary>} />
              <Route path="/pricing" element={<ErrorBoundary><PricingStrategy /></ErrorBoundary>} />
              <Route path="/sales" element={<ErrorBoundary><SalesRevenue /></ErrorBoundary>} />
              <Route path="/vendor-comparison" element={<ErrorBoundary><VendorComparison /></ErrorBoundary>} />
              <Route path="/customers" element={<ErrorBoundary><CustomerManagement /></ErrorBoundary>} />
              <Route path="/inventory" element={<ErrorBoundary><InventoryManagement /></ErrorBoundary>} />
              <Route path="/invoices" element={<ErrorBoundary><InvoiceManagement /></ErrorBoundary>} />
              <Route path="/reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
              <Route path="/marketing" element={<ErrorBoundary><Marketing /></ErrorBoundary>} />
              <Route path="/gst" element={<ErrorBoundary><GSTFiling /></ErrorBoundary>} />
              <Route path="/help" element={<ErrorBoundary><HelpGuide /></ErrorBoundary>} />
              <Route path="/settings" element={<ErrorBoundary><BackupSettings /></ErrorBoundary>} />
            </Routes>
          </Layout>
          <Toast />
        </Router>
      </AppProvider>
    </Auth>
  );
}

export default App;
