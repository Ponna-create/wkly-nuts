import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserX, Phone, MapPin, Clock, MessageCircle } from 'lucide-react';
import { dbService } from '../services/supabase';

export default function LapsedCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await dbService.getLapsedCustomers(30);
      setCustomers(data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return null;
  if (customers.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <UserX className="w-4 h-4 text-orange-500" />
          Lapsed Customers
        </h3>
        <span className="text-xs text-orange-600 font-medium">{customers.length} need follow-up</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">No orders in 30+ days — consider reaching out</p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {customers.slice(0, 10).map(c => (
          <div key={c.id} className="flex items-center gap-3 p-2 bg-orange-50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-orange-700">{(c.name || '?')[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                {c.phone && (
                  <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{c.phone}</span>
                )}
                {c.city && (
                  <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{c.city}</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-bold text-orange-600 flex items-center gap-1">
                <Clock className="w-3 h-3" />{c.daysSinceOrder}d ago
              </p>
              {c.phone && (
                <a
                  href={`https://wa.me/91${c.phone.replace(/[^0-9]/g, '').slice(-10)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[10px] text-green-600 hover:text-green-700 mt-0.5"
                >
                  <MessageCircle className="w-2.5 h-2.5" /> WhatsApp
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      {customers.length > 10 && (
        <Link to="/customers" className="block text-center text-xs text-orange-600 hover:text-orange-700 font-medium mt-2 pt-2 border-t">
          View all {customers.length} lapsed customers
        </Link>
      )}
    </div>
  );
}
