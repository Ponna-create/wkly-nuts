import React from 'react';
import { Clock, CheckCircle, Package, Users, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function RecentActivity() {
    const { state } = useApp();
    const { vendors, skus } = state;

    // Generate recent activities (mock data for now - can be enhanced with real activity tracking)
    const activities = [];

    // Add recent vendors
    vendors.slice(0, 2).forEach(vendor => {
        activities.push({
            type: 'vendor',
            icon: Users,
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            title: 'Vendor Added',
            description: vendor.name,
            time: 'Recently',
        });
    });

    // Add recent SKUs
    skus.slice(0, 2).forEach(sku => {
        activities.push({
            type: 'sku',
            icon: Package,
            iconBg: 'bg-primary-100',
            iconColor: 'text-primary',
            title: 'SKU Created',
            description: sku.name,
            time: 'Recently',
        });
    });

    // If no activities, show placeholder
    if (activities.length === 0) {
        activities.push({
            type: 'placeholder',
            icon: Clock,
            iconBg: 'bg-gray-100',
            iconColor: 'text-gray-400',
            title: 'Getting Started',
            description: 'Start by adding vendors and creating SKUs',
            time: 'Now',
        });
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Recent Activities</h3>
                <Clock className="w-5 h-5 text-gray-400" />
            </div>

            <div className="space-y-4">
                {activities.slice(0, 5).map((activity, index) => (
                    <div key={index} className="flex items-start gap-3">
                        <div className={`${activity.iconBg} ${activity.iconColor} p-2 rounded-lg flex-shrink-0`}>
                            <activity.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{activity.title}</p>
                            <p className="text-sm text-gray-600 truncate">{activity.description}</p>
                            <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
                <button className="text-sm text-primary hover:text-primary-600 font-medium w-full text-center">
                    View All Activities →
                </button>
            </div>
        </div>
    );
}
