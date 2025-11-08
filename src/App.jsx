import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Toast from './components/Toast';
import Dashboard from './pages/Dashboard';
import VendorManagement from './pages/VendorManagement';
import SKUManagement from './pages/SKUManagement';
import PricingStrategy from './pages/PricingStrategy';
import SalesRevenue from './pages/SalesRevenue';
import VendorComparison from './pages/VendorComparison';

function App() {
  return (
    <Auth>
      <AppProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/vendors" element={<VendorManagement />} />
              <Route path="/skus" element={<SKUManagement />} />
              <Route path="/pricing" element={<PricingStrategy />} />
              <Route path="/sales" element={<SalesRevenue />} />
              <Route path="/vendor-comparison" element={<VendorComparison />} />
            </Routes>
          </Layout>
          <Toast />
        </Router>
      </AppProvider>
    </Auth>
  );
}

export default App;
