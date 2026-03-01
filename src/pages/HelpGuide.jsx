import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, Truck, ShoppingCart, Receipt, Factory, Box, Warehouse, Package, BarChart3, FolderOpen, FileText, Users, Database, MessageCircle } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Sales Orders',
    icon: Truck,
    color: 'text-teal-600',
    content: [
      '**What it does:** Track every customer order from enquiry to delivery.',
      '**How to use:**',
      '1. Click "New Order" to create an order with customer details, items, and amounts',
      '2. Use status tabs to filter: Follow-up → Packing → Packed → Dispatched → In Transit → Delivered',
      '3. Click "Tracking" to enter courier tracking numbers for dispatched orders',
      '4. Click "Bulk WA" to send tracking messages to all dispatched customers via WhatsApp',
      '5. Click any order to view details, update status, send WhatsApp message, or print QR label',
      '6. "Scan" button scans QR codes printed on packages for quick order lookup',
      '7. "Import" button imports orders from Zoho Commerce CSV exports',
      '',
      '**WhatsApp Templates:** Messages are customizable. Click the gear icon next to any template to edit it. Templates are shared across all devices.',
      '**ST Courier Tracking:** Tracking link (stcourier.com/track/shipment) is auto-included in dispatched messages.',
    ],
  },
  {
    title: 'Purchase Orders',
    icon: ShoppingCart,
    color: 'text-blue-600',
    content: [
      '**What it does:** Track purchases from vendors (raw materials, packaging, etc.)',
      '**How to use:**',
      '1. Click "New PO" to create a purchase order with vendor name, items, quantities, and prices',
      '2. Track status: Draft → Ordered → Received → Cancelled',
      '3. Each PO can have multiple line items with individual GST calculations',
      '',
      '**Import Bill:** Click "Import Bill" to import purchase data from CSV.',
      'Upload a photo of the bill to ChatGPT/Gemini, use our AI prompt (click "Show AI Prompt"), and paste the CSV output.',
    ],
  },
  {
    title: 'Expenses',
    icon: Receipt,
    color: 'text-amber-600',
    content: [
      '**What it does:** Track every business expense with categories and payment status.',
      '**Categories:** Raw Materials, Packaging, Shipping, Advertising, Rent, Utilities, Equipment, Salary, Courier, Misc',
      '**How to use:**',
      '1. Click "Add Expense" to manually enter an expense',
      '2. Click "Import Bill" to bulk-import from CSV (use ChatGPT/Gemini to convert bill photos to CSV)',
      '3. Filter by category using the dropdown',
      '4. Each expense tracks: amount, GST, total, payment method, bill number',
    ],
  },
  {
    title: 'Production',
    icon: Factory,
    color: 'text-purple-600',
    content: [
      '**What it does:** Track production runs with SKU instance numbering.',
      '**How to use:**',
      '1. Click "New Run" to start a production batch',
      '2. Select SKU (DP/SO/SC/DB), pack type (weekly/monthly), and planned quantity',
      '3. Auto-generated batch number: e.g., DP-2026-0301-001',
      '4. Pipeline: Planned → Start Production → Send to QC → Complete',
      '5. Track ingredients used, packaging materials, and costs per run',
      '6. Quality check with pass/fail/partial status',
    ],
  },
  {
    title: 'Packaging Materials',
    icon: Box,
    color: 'text-orange-600',
    content: [
      '**What it does:** Track packaging inventory - boxes, sachets, labels, tape, nitrogen.',
      '**How to use:**',
      '1. View all materials with current stock levels',
      '2. Red highlight = stock below minimum level (needs reorder)',
      '3. Click "Stock In" to record purchases, "Stock Out" to record usage',
      '4. View full transaction history for each material',
      '5. Pre-loaded with WKLY Nuts packaging items (Weekly Box ₹11, Monthly Box ₹20, etc.)',
    ],
  },
  {
    title: 'Ingredients',
    icon: Warehouse,
    color: 'text-green-600',
    content: [
      '**What it does:** Track raw ingredient inventory with batch-level expiry tracking.',
      '**How to use:**',
      '1. Each ingredient shows total stock across all batches',
      '2. Expand to see individual batches with vendor, purchase date, and expiry',
      '3. Color coding: Green = good, Orange = expiring soon, Red = expired',
      '4. Add new batches when purchasing from vendors',
    ],
  },
  {
    title: 'SKU Items',
    icon: Package,
    color: 'text-indigo-600',
    content: [
      '**What it does:** Define product recipes - which ingredients go into each SKU per day.',
      '**4 SKUs:** Day Pack (DP), Soak Overnight (SO), Seed Cycle (SC), Date Bytes (DB)',
      '**How to use:**',
      '1. Each SKU has 7 day-wise recipes (Mon-Sun)',
      '2. Click a SKU to see/edit ingredient quantities for each day',
      '3. Used by production runs to calculate ingredient requirements',
    ],
  },
  {
    title: 'Reports & Analytics',
    icon: BarChart3,
    color: 'text-cyan-600',
    content: [
      '**What it does:** Business dashboard with sales, expenses, and production metrics.',
      '**Features:**',
      '1. Date range filters: Today, This Week, This Month, Last Month, This Year, All Time, Custom',
      '2. Revenue vs Expenses vs Production Cost → Net P&L',
      '3. Bar charts: Orders by status, by source, top customers, expenses by category, production by SKU',
      '4. Key metrics: Average order value, delivery rate, profit margin',
    ],
  },
  {
    title: 'Documents',
    icon: FolderOpen,
    color: 'text-pink-600',
    content: [
      '**What it does:** Store business documents - bills, receipts, invoices, contracts, photos.',
      '**How to use:**',
      '1. Drag & drop or click to upload files',
      '2. Filter by type: Bill, Receipt, Invoice, Label, Photo, Contract, License',
      '3. Click to preview images and PDFs',
      '4. Stored in Supabase Storage (cloud) - accessible from any device',
    ],
  },
  {
    title: 'Backup & Settings',
    icon: Database,
    color: 'text-gray-600',
    content: [
      '**What it does:** Export/import all your business data as a backup file.',
      '**How to use:**',
      '1. Click "Export Backup" to download all data as JSON file',
      '2. Save this file on your business laptop as master backup',
      '3. Click "Import Backup" to restore data from a backup file',
      '4. Recommended: Take backup weekly or before any major changes',
      '',
      '**When to use:** If Supabase is down, or when switching devices, or as a safety net.',
    ],
  },
  {
    title: 'WhatsApp Tracking',
    icon: MessageCircle,
    color: 'text-green-600',
    content: [
      '**What it does:** Send tracking notifications to customers via WhatsApp.',
      '**Template variables you can use:**',
      '• {customer_name} - Customer name',
      '• {order_number} - Order ID (e.g., SO-2026-00001)',
      '• {tracking_number} - ST Courier tracking number',
      '• {city} - Destination city from shipping address',
      '• {pincode} - Destination pincode',
      '• {total_amount} - Order total in rupees',
      '• {items} - List of ordered items',
      '• {tracking_url} - ST Courier tracking website URL',
      '',
      '**How to edit templates:** Open any order → click WhatsApp icon → click gear icon next to template name → edit → Save.',
    ],
  },
];

export default function HelpGuide() {
  const [expandedSection, setExpandedSection] = useState(null);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Help Guide</h1>
        <p className="text-gray-600 mt-1">How to use each feature in WKLY Nuts Business OS</p>
      </div>

      {/* Quick Start */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-teal-900 mb-2">Quick Start - Daily Workflow</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-teal-800">
          <li><strong>Morning:</strong> Check Sales Orders → Pack pending orders → Print QR labels</li>
          <li><strong>Afternoon:</strong> Update order status to "Packed" → Hand over to ST Courier</li>
          <li><strong>Evening (after 9:30 PM):</strong> Enter tracking numbers → Click "Bulk WA" to send all tracking messages</li>
          <li><strong>Weekly:</strong> Check Reports → Review P&L → Take data backup</li>
          <li><strong>When buying supplies:</strong> Create Purchase Order → Record in Expenses → Upload bill photo to Documents</li>
        </ol>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {SECTIONS.map((section, idx) => {
          const isExpanded = expandedSection === idx;
          const Icon = section.icon;

          return (
            <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedSection(isExpanded ? null : idx)}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition"
              >
                <Icon className={`w-5 h-5 ${section.color} flex-shrink-0`} />
                <span className="text-sm font-semibold text-gray-900 flex-1 text-left">{section.title}</span>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                  <div className="pl-8 space-y-1">
                    {section.content.map((line, i) => {
                      if (line === '') return <div key={i} className="h-2" />;
                      // Bold text between ** **
                      const parts = line.split(/\*\*(.*?)\*\*/g);
                      return (
                        <p key={i} className="text-sm text-gray-700">
                          {parts.map((part, j) =>
                            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                          )}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Support */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
        <p className="text-sm text-gray-600">
          Need help? Contact Ponna for technical support.
        </p>
        <p className="text-xs text-gray-400 mt-1">WKLY Nuts Business OS v1.0</p>
      </div>
    </div>
  );
}
