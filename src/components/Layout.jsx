import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Package, Warehouse, ShoppingCart, BarChart3, FileText,
  Menu, X, LogOut, Users, Truck, Receipt, FolderOpen, Factory, Box,
  ChevronDown, ChevronRight, HelpCircle, Database
} from 'lucide-react';
import { logout } from './Auth';
import logo from '../assets/wkly-nuts-logo.png';

// Grouped navigation - clean categories
const navGroups = [
  {
    label: null,
    items: [
      { name: 'Home', href: '/', icon: Home },
    ],
  },
  {
    label: 'Orders & Sales',
    items: [
      { name: 'Sales Orders', href: '/orders', icon: Truck },
      { name: 'Customers', href: '/customers', icon: Users },
      { name: 'Invoices', href: '/invoices', icon: FileText },
    ],
  },
  {
    label: 'Purchasing',
    items: [
      { name: 'Purchase Orders', href: '/purchase-orders', icon: ShoppingCart },
      { name: 'Expenses', href: '/expenses', icon: Receipt },
      { name: 'Vendors', href: '/vendors', icon: ShoppingCart },
    ],
  },
  {
    label: 'Production & Stock',
    items: [
      { name: 'Production', href: '/production', icon: Factory },
      { name: 'Packaging', href: '/packaging', icon: Box },
      { name: 'Ingredients', href: '/ingredients', icon: Warehouse },
      { name: 'SKU Items', href: '/skus', icon: Package },
    ],
  },
  {
    label: 'Reports & Files',
    items: [
      { name: 'Reports', href: '/reports', icon: BarChart3 },
      { name: 'Documents', href: '/documents', icon: FolderOpen },
    ],
  },
  {
    label: null,
    items: [
      { name: 'Backup & Settings', href: '/settings', icon: Database },
      { name: 'Help Guide', href: '/help', icon: HelpCircle },
    ],
  },
];

// Flat list for header title lookup
const allNavItems = navGroups.flatMap(g => g.items);

export default function Layout({ children }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const toggleGroup = (label) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          style={{ pointerEvents: 'auto' }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-64 bg-slate-900 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src={logo} alt="WKLY Nuts Logo"
              className="h-10 w-auto object-contain bg-white rounded p-1" />
            <div>
              <h1 className="text-lg font-bold text-white">WKLY Nuts</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Business OS</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 space-y-0.5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
          {navGroups.map((group, gIdx) => {
            const isCollapsed = group.label && collapsedGroups[group.label];

            return (
              <div key={gIdx} className={group.label ? 'pt-3' : ''}>
                {/* Group label */}
                {group.label && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5"
                  >
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {group.label}
                    </span>
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-slate-500" />
                    )}
                  </button>
                )}

                {/* Group items */}
                {!isCollapsed && group.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 ${isActive
                        ? 'bg-primary text-white shadow-md'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                      <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="text-sm font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20 no-print">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex-1 lg:flex-none">
              <h2 className="text-xl font-semibold text-gray-800">
                {allNavItems.find((item) => item.href === location.pathname)?.name || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-sm text-gray-500">
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </div>
              <button onClick={logout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Logout">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
