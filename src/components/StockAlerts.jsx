import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Package, Leaf, Box, Clock, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { dbService } from '../services/supabase';

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-700', icon: AlertCircle },
  high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
};

const TYPE_CONFIG = {
  raw_material: { label: 'Raw Material', icon: Leaf, color: 'text-amber-600' },
  expiring_batch: { label: 'Expiring', icon: Clock, color: 'text-red-600' },
  packaging: { label: 'Packaging', icon: Box, color: 'text-indigo-600' },
  finished_goods: { label: 'Finished Goods', icon: Package, color: 'text-teal-600' },
};

export default function StockAlerts({ compact = false, showTitle = true, maxItems = 0 }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);
  const [refreshing, setRefreshing] = useState(false);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await dbService.getLowStockAlerts();
      setAlerts(data || []);
    } catch (err) {
      console.error('Error loading stock alerts:', err);
    }
    setLoading(false);
  };

  useEffect(() => { loadAlerts(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  if (loading) {
    return compact ? null : (
      <div className="bg-white rounded-lg border p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (alerts.length === 0) {
    if (compact) return null;
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-700">
          <Package className="w-5 h-5" />
          <span className="font-medium text-sm">All stock levels are healthy</span>
        </div>
      </div>
    );
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;
  const displayAlerts = maxItems > 0 ? alerts.slice(0, maxItems) : alerts;

  return (
    <div className={`rounded-lg border ${criticalCount > 0 ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`}>
      {/* Header */}
      <div
        className={`flex items-center justify-between p-3 ${compact ? 'cursor-pointer' : ''}`}
        onClick={() => compact && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-5 h-5 ${criticalCount > 0 ? 'text-red-600' : 'text-orange-600'}`} />
          {showTitle && (
            <h3 className={`font-semibold text-sm ${criticalCount > 0 ? 'text-red-800' : 'text-orange-800'}`}>
              Stock Alerts ({alerts.length})
            </h3>
          )}
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
              {criticalCount} Critical
            </span>
          )}
          {highCount > 0 && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
              {highCount} Low
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            className="p-1 hover:bg-white hover:bg-opacity-50 rounded"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-4 h-4 ${criticalCount > 0 ? 'text-red-500' : 'text-orange-500'} ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {compact && (expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />)}
        </div>
      </div>

      {/* Alert List */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {displayAlerts.map((alert, idx) => {
            const sevConfig = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
            const typeConfig = TYPE_CONFIG[alert.type] || TYPE_CONFIG.raw_material;
            const TypeIcon = typeConfig.icon;

            return (
              <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${sevConfig.bg} ${sevConfig.border} border`}>
                <TypeIcon className={`w-4 h-4 ${typeConfig.color} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-900 truncate">{alert.name}</span>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${sevConfig.badge}`}>
                      {alert.severity === 'critical' ? 'OUT' : alert.severity === 'high' ? 'LOW' : 'WARN'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">
                    {alert.type === 'expiring_batch'
                      ? `Batch ${alert.batchNumber}: ${alert.daysLeft < 0 ? 'EXPIRED' : `${alert.daysLeft} days left`} (${alert.quantity} ${alert.unit})`
                      : `${alert.currentStock ?? alert.weeklyStock ?? 0} ${alert.unit} remaining${alert.threshold ? ` / min ${alert.threshold}` : ''}`
                    }
                  </p>
                </div>
              </div>
            );
          })}
          {maxItems > 0 && alerts.length > maxItems && (
            <p className="text-xs text-center text-gray-500 pt-1">
              +{alerts.length - maxItems} more alerts
            </p>
          )}
        </div>
      )}
    </div>
  );
}
