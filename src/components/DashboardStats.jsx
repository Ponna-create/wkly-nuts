import React from 'react';
import { TrendingUp, ShoppingCart, Package, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function DashboardStats() {
    const { state } = useApp();
    const { vendors, skus, salesTargets } = state;

    // Calculate stats
    const totalIngredients = vendors.reduce((sum, v) => sum + (v.ingredients?.length || 0), 0);
    const totalSKUs = skus.length;

    // Calculate monthly revenue target
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const currentTarget = salesTargets.find(
        t => t.month === currentMonth && t.year === currentYear
    );
    const monthlyRevenue = currentTarget?.targets.reduce((sum, t) => sum + t.projectedRevenue, 0) || 0;

    // Calculate low stock items (mock for now - can be enhanced later)
    const lowStockCount = 0; // Placeholder

    const stats = [
        {
            title: 'SALES',
            items: [
                { label: 'To Be Invoiced', value: '₹0', color: 'text-orange-600' },
                { label: 'Monthly Target', value: `₹${monthlyRevenue.toLocaleString('en-IN')}`, color: 'text-green-600' },
            ],
            icon: TrendingUp,
            iconBg: 'bg-green-100',
            iconColor: 'text-green-600',
        },
        {
            title: 'PURCHASES',
            items: [
                { label: 'To Be Received', value: '0', color: 'text-blue-600' },
                { label: 'Active Vendors', value: vendors.length, color: 'text-gray-700' },
            ],
            icon: ShoppingCart,
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
        },
        {
            title: 'INVENTORY',
            items: [
                { label: 'Total Ingredients', value: totalIngredients, color: 'text-gray-700' },
                { label: 'Total SKUs', value: totalSKUs, color: 'text-gray-700' },
            ],
            icon: Package,
            iconBg: 'bg-orange-100',
            iconColor: 'text-orange-600',
        },
    ];

    return (
        <div className="space-y-4">
            {stats.map((stat, index) => (
                <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`${stat.iconBg} ${stat.iconColor} p-2 rounded-lg`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <h3 className="text-xs font-bold text-gray-500 tracking-wide">{stat.title}</h3>
                    </div>
                    <div className="space-y-2">
                        {stat.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">{item.label}</span>
                                <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
