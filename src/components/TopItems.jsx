import React from 'react';
import { Package, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function TopItems() {
    const { state } = useApp();
    const { skus, vendors } = state;

    // Get top 5 SKUs (by order - for now just show first 5)
    const topSKUs = skus.slice(0, 5);

    // Get top 5 ingredients (by vendor count - for now just show first 5)
    const allIngredients = vendors.flatMap(v =>
        (v.ingredients || []).map(ing => ({
            ...ing,
            vendorName: v.name
        }))
    );
    const topIngredients = allIngredients.slice(0, 5);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Selling SKUs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Top SKUs</h3>
                    <button className="text-sm text-primary hover:text-primary-600 font-medium">
                        View All →
                    </button>
                </div>
                <div className="space-y-3">
                    {topSKUs.length > 0 ? (
                        topSKUs.map((sku, index) => (
                            <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Package className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{sku.name}</p>
                                    <p className="text-xs text-gray-500">{sku.type || 'Product'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-primary">
                                        {sku.ingredients?.length || 0}
                                    </p>
                                    <p className="text-xs text-gray-500">ingredients</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">No SKUs created yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Ingredients */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Recent Ingredients</h3>
                    <button className="text-sm text-primary hover:text-primary-600 font-medium">
                        View All →
                    </button>
                </div>
                <div className="space-y-3">
                    {topIngredients.length > 0 ? (
                        topIngredients.map((ingredient, index) => (
                            <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <TrendingUp className="w-5 h-5 text-orange-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{ingredient.name}</p>
                                    <p className="text-xs text-gray-500">{ingredient.vendorName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-900">
                                        ₹{ingredient.pricePerKg?.toLocaleString('en-IN') || 0}
                                    </p>
                                    <p className="text-xs text-gray-500">per kg</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">No ingredients added yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
