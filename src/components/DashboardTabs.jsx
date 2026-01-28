import React, { useState } from 'react';
import {
    Home,
    Package,
    Warehouse,
    TrendingUp,
    ShoppingCart,
    BarChart3,
    BarChart3,
    FileText,
    Users
} from 'lucide-react';

const tabs = [
    { id: 'home', name: 'Home', icon: Home, href: '/' },
    { id: 'items', name: 'Items', icon: Package, href: '/skus' },
    { id: 'inventory', name: 'Inventory', icon: Warehouse, href: '/inventory' },
    { id: 'sales', name: 'Sales', icon: TrendingUp, href: '/sales' },
    { id: 'purchase', name: 'Purchase', icon: ShoppingCart, href: '/vendors' },
    { id: 'reports', name: 'Reports', icon: BarChart3, href: '/vendor-comparison' },
    { id: 'customers', name: 'Customers', icon: Users, href: '/customers' },
    { id: 'documents', name: 'Documents', icon: FileText, href: '/invoices' },
];

export default function DashboardTabs({ activeTab = 'home' }) {
    const [active, setActive] = useState(activeTab);

    return (
        <div className="bg-white border-b border-gray-200">
            <div className="flex items-center gap-1 px-4 overflow-x-auto">
                {tabs.map((tab) => {
                    const isActive = active === tab.id;
                    return (
                        <a
                            key={tab.id}
                            href={tab.href}
                            onClick={(e) => {
                                e.preventDefault();
                                setActive(tab.id);
                                window.location.href = tab.href;
                            }}
                            className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
                border-b-2 transition-colors duration-200
                ${isActive
                                    ? 'border-primary text-primary bg-primary-50'
                                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }
              `}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span>{tab.name}</span>
                        </a>
                    );
                })}
            </div>
        </div>
    );
}
