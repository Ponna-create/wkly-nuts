import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Package, DollarSign, TrendingUp, ShoppingBag, Truck, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import DataManagement from '../components/DataManagement';
import ProductionSimulator from '../components/ProductionSimulator';
import DashboardStats from '../components/DashboardStats';
import TopItems from '../components/TopItems';
import RecentActivity from '../components/RecentActivity';
import logo from '../assets/wkly-nuts-logo.png';

export default function Dashboard() {
  const { state, isLoading, useDatabase } = useApp();
  const { vendors, skus, pricingStrategies, salesTargets, customers, salesOrders } = state;

  // Calculate stats
  const totalVendors = vendors.length;
  const totalSKUs = skus.length;
  const totalIngredients = vendors.reduce((sum, v) => sum + (v.ingredients?.length || 0), 0);

  // Calculate monthly revenue target
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentTarget = salesTargets.find(
    t => t.month === currentMonth && t.year === currentYear
  );
  const monthlyRevenue = currentTarget?.targets.reduce((sum, t) => sum + t.projectedRevenue, 0) || 0;

  const quickStats = [
    { label: 'Total Vendors', value: totalVendors, icon: Users, color: 'text-blue-600' },
    { label: 'Total Customers', value: customers.length, icon: Users, color: 'text-indigo-600' },
    { label: 'Total SKUs', value: totalSKUs, icon: Package, color: 'text-primary' },
    { label: 'Total Ingredients', value: totalIngredients, icon: ShoppingBag, color: 'text-orange-600' },
    { label: 'Pricing Strategies', value: pricingStrategies.length, icon: DollarSign, color: 'text-green-600' },
  ];

  // Order pipeline stats
  const orderPipeline = [
    { label: 'Follow-up', count: (salesOrders || []).filter(o => o.status === 'follow_up').length, color: 'bg-blue-500', href: '/orders' },
    { label: 'Packing', count: (salesOrders || []).filter(o => o.status === 'packing').length, color: 'bg-yellow-500', href: '/orders' },
    { label: 'Packed', count: (salesOrders || []).filter(o => o.status === 'packed').length, color: 'bg-orange-500', href: '/orders' },
    { label: 'Dispatched', count: (salesOrders || []).filter(o => o.status === 'dispatched').length, color: 'bg-purple-500', href: '/orders' },
    { label: 'In Transit', count: (salesOrders || []).filter(o => o.status === 'in_transit').length, color: 'bg-indigo-500', href: '/orders' },
    { label: 'Delivered', count: (salesOrders || []).filter(o => o.status === 'delivered').length, color: 'bg-green-500', href: '/orders' },
  ];
  const totalOrders = (salesOrders || []).length;
  const todayRevenue = (salesOrders || [])
    .filter(o => o.order_date === new Date().toISOString().split('T')[0])
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  const quickActions = [
    { title: 'New Order', href: '/orders', icon: Truck, color: 'bg-teal-500' },
    { title: 'Add Vendor', href: '/vendors', icon: Users, color: 'bg-blue-500' },
    { title: 'Manage Customers', href: '/customers', icon: Users, color: 'bg-indigo-500' },
    { title: 'Create SKU', href: '/skus', icon: Package, color: 'bg-primary' },
    { title: 'Set Pricing', href: '/pricing', icon: DollarSign, color: 'bg-accent' },
    { title: 'Track Sales', href: '/sales', icon: TrendingUp, color: 'bg-green-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary to-primary-700 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <img
            src={logo}
            alt="WKLY Nuts Logo"
            className="h-16 w-auto object-contain bg-white rounded-lg p-2 hidden sm:block"
          />
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-1">Welcome to WKLY Nuts Production Manager</h1>
            <p className="text-primary-100">
              Manage your entire production workflow from vendors to sales targets
            </p>
            <div className="mt-2 flex items-center gap-2">
              {isLoading ? (
                <div className="inline-block bg-primary-800 text-white px-3 py-1 rounded-lg text-xs font-medium">
                  ⏳ Loading...
                </div>
              ) : useDatabase ? (
                <div className="inline-block bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1">
                  <span>🗄️</span>
                  <span>Database Connected</span>
                </div>
              ) : (
                <div className="inline-block bg-yellow-600 text-white px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1">
                  <span>💾</span>
                  <span>Local Storage</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout: Content + Sidebar */}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Area (3 columns) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickStats.map((stat, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} bg-opacity-10 p-2 rounded-lg`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Pipeline Widget */}
          {totalOrders > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900">Order Pipeline</h3>
                <Link to="/orders" className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                  View All ({totalOrders})
                </Link>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {orderPipeline.map((step) => (
                  <Link key={step.label} to={step.href} className="text-center group">
                    <div className={`${step.color} text-white text-xl font-bold rounded-lg p-3 group-hover:opacity-90 transition`}>
                      {step.count}
                    </div>
                    <p className="text-xs text-gray-600 mt-1 font-medium">{step.label}</p>
                  </Link>
                ))}
              </div>
              {todayRevenue > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Today's Revenue</span>
                  <span className="text-sm font-bold text-teal-600">₹{todayRevenue.toFixed(2)}</span>
                </div>
              )}
              {/* Action needed alerts */}
              {orderPipeline.find(s => s.label === 'Dispatched')?.count > 0 && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-purple-600" />
                  <span className="text-xs text-purple-700 font-medium">
                    {orderPipeline.find(s => s.label === 'Dispatched').count} orders need tracking numbers
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Top Items Widget */}
          <TopItems />

          {/* Data Management Section */}
          <DataManagement />

          {/* Production Simulator */}
          <ProductionSimulator />

          {/* Recent Activity */}
          <RecentActivity />
        </div>

        {/* Right Sidebar (1 column) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Dashboard Stats */}
          <DashboardStats />

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {quickActions.map((action, index) => (
                <Link
                  key={index}
                  to={action.href}
                  className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                >
                  <div className={`${action.color} p-2 rounded-lg text-white`}>
                    <action.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {action.title}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Getting Started Tips */}
          <div className="bg-gradient-to-br from-accent-50 to-primary-50 rounded-lg border border-accent-100 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Getting Started</h3>
            <div className="space-y-2 text-xs text-gray-700">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  1
                </div>
                <p><span className="font-semibold">Add Vendors</span> with ingredients</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  2
                </div>
                <p><span className="font-semibold">Manage Customers</span> and contacts</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  3
                </div>
                <p><span className="font-semibold">Create SKUs</span> with recipes</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  4
                </div>
                <p><span className="font-semibold">Set Pricing</span> and margins</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  5
                </div>
                <p><span className="font-semibold">Track Sales</span> targets</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
}
