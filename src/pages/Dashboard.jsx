import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Package, DollarSign, TrendingUp, ShoppingBag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import DataManagement from '../components/DataManagement';
import logo from '../assets/wkly-nuts-logo.png';

export default function Dashboard() {
  const { state } = useApp();
  const { vendors, skus, pricingStrategies, salesTargets } = state;

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

  const cards = [
    {
      title: 'Vendor Management',
      description: 'Manage vendors and ingredients',
      icon: Users,
      href: '/vendors',
      color: 'bg-blue-500',
      stats: `${totalVendors} Vendors, ${totalIngredients} Ingredients`,
    },
    {
      title: 'SKU Management',
      description: 'Create and manage product SKUs',
      icon: Package,
      href: '/skus',
      color: 'bg-primary',
      stats: `${totalSKUs} Active SKUs`,
    },
    {
      title: 'Pricing Strategy',
      description: 'Set prices and profit margins',
      icon: DollarSign,
      href: '/pricing',
      color: 'bg-accent',
      stats: `${pricingStrategies.length} Pricing Strategies`,
    },
    {
      title: 'Sales & Revenue',
      description: 'Track targets and projections',
      icon: TrendingUp,
      href: '/sales',
      color: 'bg-green-500',
      stats: `₹${monthlyRevenue.toLocaleString('en-IN')} Monthly Target`,
    },
  ];

  const quickStats = [
    { label: 'Total Vendors', value: totalVendors, icon: Users, color: 'text-blue-600' },
    { label: 'Total SKUs', value: totalSKUs, icon: Package, color: 'text-primary' },
    { label: 'Total Ingredients', value: totalIngredients, icon: ShoppingBag, color: 'text-orange-600' },
    { label: 'Pricing Strategies', value: pricingStrategies.length, icon: DollarSign, color: 'text-green-600' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary to-primary-700 rounded-2xl p-8 text-white">
        <div className="flex items-start gap-6">
          <img 
            src={logo} 
            alt="WKLY Nuts Logo" 
            className="h-20 w-auto object-contain bg-white rounded-lg p-2 hidden sm:block"
          />
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">Welcome to WKLY Nuts Production Manager</h1>
            <p className="text-primary-100 text-lg">
              Manage your entire production workflow from vendors to sales targets
            </p>
            <p className="text-primary-200 text-sm mt-2">
              ✅ All data is automatically saved and will persist across sessions
            </p>
          </div>
        </div>
      </div>

      {/* Data Management Section */}
      <DataManagement />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat, index) => (
          <div key={index} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`${stat.color} bg-opacity-10 p-3 rounded-lg`}>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Navigation Cards */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card, index) => (
            <Link
              key={index}
              to={card.href}
              className="card group hover:scale-[1.02] transition-transform duration-200"
            >
              <div className="flex items-start gap-4">
                <div className={`${card.color} p-4 rounded-xl text-white`}>
                  <card.icon className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-gray-600 mb-3">{card.description}</p>
                  <p className="text-sm font-medium text-primary">{card.stats}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity or Tips */}
      <div className="bg-gradient-to-br from-accent-50 to-primary-50 rounded-2xl p-8 border border-accent-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Getting Started</h2>
        <div className="space-y-3 text-gray-700">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
              1
            </div>
            <p><span className="font-semibold">Add Vendors:</span> Start by adding your ingredient suppliers with their contact details and available ingredients.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
              2
            </div>
            <p><span className="font-semibold">Create SKUs:</span> Build your product recipes (Day Pack, Night Pack) with ingredient quantities per sachet.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
              3
            </div>
            <p><span className="font-semibold">Set Pricing:</span> Calculate costs and set profit margins for both Weekly and Monthly packs.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
              4
            </div>
            <p><span className="font-semibold">Plan Sales:</span> Set monthly targets and track revenue projections.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
