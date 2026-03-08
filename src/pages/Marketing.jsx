import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Users, TrendingUp, DollarSign, Instagram, Youtube, Globe, Search, Megaphone } from 'lucide-react';
import { dbService } from '../services/supabase';

export default function Marketing() {
  const [tab, setTab] = useState('influencers');
  const [contacts, setContacts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Contact form
  const emptyContact = { name: '', platform: 'instagram', handle: '', followers: 0, contactDate: new Date().toISOString().split('T')[0], status: 'contacted', fee: 0, commissionPercent: 0, ordersGenerated: 0, revenueGenerated: 0, notes: '' };
  const emptyCampaign = { campaignName: '', platform: 'meta', budget: 0, spend: 0, startDate: new Date().toISOString().split('T')[0], endDate: '', status: 'active', impressions: 0, clicks: 0, ordersAttributed: 0, revenueAttributed: 0, notes: '' };

  const [contactForm, setContactForm] = useState(emptyContact);
  const [campaignForm, setCampaignForm] = useState(emptyCampaign);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [cRes, campRes] = await Promise.all([
      dbService.getMarketingContacts(),
      dbService.getMarketingCampaigns(),
    ]);
    setContacts(cRes.data || []);
    setCampaigns(campRes.data || []);
    setLoading(false);
  };

  // Summary metrics
  const totalInfluencerSpend = contacts.reduce((s, c) => s + (c.fee || 0), 0);
  const totalCampaignSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0);
  const totalMarketingSpend = totalInfluencerSpend + totalCampaignSpend;
  const totalOrders = contacts.reduce((s, c) => s + (c.ordersGenerated || 0), 0) + campaigns.reduce((s, c) => s + (c.ordersAttributed || 0), 0);
  const totalRevenue = contacts.reduce((s, c) => s + (c.revenueGenerated || 0), 0) + campaigns.reduce((s, c) => s + (c.revenueAttributed || 0), 0);
  const roi = totalMarketingSpend > 0 ? ((totalRevenue - totalMarketingSpend) / totalMarketingSpend * 100) : 0;

  const platformIcon = (platform) => {
    const icons = { instagram: Instagram, youtube: Youtube };
    return icons[platform] || Globe;
  };

  const statusColors = {
    contacted: 'bg-blue-100 text-blue-700', negotiated: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700', inactive: 'bg-gray-100 text-gray-700',
    declined: 'bg-red-100 text-red-700', draft: 'bg-gray-100 text-gray-700',
    paused: 'bg-yellow-100 text-yellow-700', completed: 'bg-teal-100 text-teal-700',
  };

  // CRUD handlers
  const handleSaveContact = async () => {
    if (!contactForm.name) return;
    if (editingItem) {
      await dbService.updateMarketingContact({ ...contactForm, id: editingItem.id });
    } else {
      await dbService.createMarketingContact(contactForm);
    }
    setShowForm(false);
    setEditingItem(null);
    setContactForm(emptyContact);
    loadData();
  };

  const handleSaveCampaign = async () => {
    if (!campaignForm.campaignName) return;
    if (editingItem) {
      await dbService.updateMarketingCampaign({ ...campaignForm, id: editingItem.id });
    } else {
      await dbService.createMarketingCampaign(campaignForm);
    }
    setShowForm(false);
    setEditingItem(null);
    setCampaignForm(emptyCampaign);
    loadData();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this item?')) return;
    if (tab === 'influencers') await dbService.deleteMarketingContact(id);
    else await dbService.deleteMarketingCampaign(id);
    loadData();
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    if (tab === 'influencers') setContactForm(item);
    else setCampaignForm(item);
    setShowForm(true);
  };

  const filteredContacts = contacts.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.handle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCampaigns = campaigns.filter(c =>
    c.campaignName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.platform?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketing</h1>
          <p className="text-gray-600 mt-1">Track influencers, campaigns & ROI</p>
        </div>
        <button
          onClick={() => { setEditingItem(null); setContactForm(emptyContact); setCampaignForm(emptyCampaign); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          {tab === 'influencers' ? 'Add Influencer' : 'Add Campaign'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-red-500" />
            <span className="text-xs text-gray-500">Total Spend</span>
          </div>
          <p className="text-xl font-bold text-gray-900">₹{totalMarketingSpend.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-500">Orders from Marketing</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalOrders}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500">Revenue Attributed</span>
          </div>
          <p className="text-xl font-bold text-gray-900">₹{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-gray-500">ROI</span>
          </div>
          <p className={`text-xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {roi.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('influencers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === 'influencers' ? 'border-teal-500 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Influencers ({contacts.length})
        </button>
        <button
          onClick={() => setTab('campaigns')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === 'campaigns' ? 'border-teal-500 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Ad Campaigns ({campaigns.length})
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={tab === 'influencers' ? 'Search influencers...' : 'Search campaigns...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-center text-gray-500 py-10">Loading...</p>
      ) : tab === 'influencers' ? (
        <div className="space-y-3">
          {filteredContacts.length === 0 ? (
            <p className="text-center text-gray-400 py-10">No influencers yet. Add your first one!</p>
          ) : filteredContacts.map(contact => {
            const PlatformIcon = platformIcon(contact.platform);
            return (
              <div key={contact.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                      <PlatformIcon className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{contact.name}</p>
                      <p className="text-sm text-gray-500">@{contact.handle || 'N/A'} · {(contact.followers || 0).toLocaleString()} followers</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[contact.status] || 'bg-gray-100 text-gray-700'}`}>
                      {contact.status}
                    </span>
                    <button onClick={() => handleEdit(contact)} className="p-1 hover:bg-gray-100 rounded"><Edit2 className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => handleDelete(contact.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                  <div><span className="text-gray-500">Fee:</span> <span className="font-medium">₹{(contact.fee || 0).toLocaleString()}</span></div>
                  <div><span className="text-gray-500">Orders:</span> <span className="font-medium">{contact.ordersGenerated || 0}</span></div>
                  <div><span className="text-gray-500">Revenue:</span> <span className="font-medium text-green-600">₹{(contact.revenueGenerated || 0).toLocaleString()}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCampaigns.length === 0 ? (
            <p className="text-center text-gray-400 py-10">No campaigns yet. Add your first one!</p>
          ) : filteredCampaigns.map(campaign => (
            <div key={campaign.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{campaign.campaignName}</p>
                  <p className="text-sm text-gray-500 capitalize">{campaign.platform} · {campaign.startDate} to {campaign.endDate || 'Ongoing'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[campaign.status] || 'bg-gray-100 text-gray-700'}`}>
                    {campaign.status}
                  </span>
                  <button onClick={() => handleEdit(campaign)} className="p-1 hover:bg-gray-100 rounded"><Edit2 className="w-4 h-4 text-gray-500" /></button>
                  <button onClick={() => handleDelete(campaign.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                </div>
              </div>
              {/* Budget Progress */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Spend: ₹{(campaign.spend || 0).toLocaleString()}</span>
                  <span>Budget: ₹{(campaign.budget || 0).toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${campaign.spend > campaign.budget ? 'bg-red-500' : 'bg-teal-500'}`}
                    style={{ width: `${Math.min((campaign.spend / (campaign.budget || 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 mt-3 text-sm">
                <div><span className="text-gray-500">Impr:</span> <span className="font-medium">{(campaign.impressions || 0).toLocaleString()}</span></div>
                <div><span className="text-gray-500">Clicks:</span> <span className="font-medium">{campaign.clicks || 0}</span></div>
                <div><span className="text-gray-500">Orders:</span> <span className="font-medium">{campaign.ordersAttributed || 0}</span></div>
                <div><span className="text-gray-500">Rev:</span> <span className="font-medium text-green-600">₹{(campaign.revenueAttributed || 0).toLocaleString()}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {editingItem ? 'Edit' : 'Add'} {tab === 'influencers' ? 'Influencer' : 'Campaign'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingItem(null); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {tab === 'influencers' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input type="text" value={contactForm.name} onChange={e => setContactForm(p => ({...p, name: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Influencer name" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                      <select value={contactForm.platform} onChange={e => setContactForm(p => ({...p, platform: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="instagram">Instagram</option>
                        <option value="youtube">YouTube</option>
                        <option value="facebook">Facebook</option>
                        <option value="twitter">Twitter/X</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Handle</label>
                      <input type="text" value={contactForm.handle} onChange={e => setContactForm(p => ({...p, handle: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="@username" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Followers</label>
                      <input type="number" value={contactForm.followers} onChange={e => setContactForm(p => ({...p, followers: parseInt(e.target.value) || 0}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select value={contactForm.status} onChange={e => setContactForm(p => ({...p, status: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="contacted">Contacted</option>
                        <option value="negotiated">Negotiated</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="declined">Declined</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Date</label>
                    <input type="date" value={contactForm.contactDate} onChange={e => setContactForm(p => ({...p, contactDate: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fee (₹)</label>
                      <input type="number" value={contactForm.fee} onChange={e => setContactForm(p => ({...p, fee: parseFloat(e.target.value) || 0}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Orders</label>
                      <input type="number" value={contactForm.ordersGenerated} onChange={e => setContactForm(p => ({...p, ordersGenerated: parseInt(e.target.value) || 0}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Revenue (₹)</label>
                      <input type="number" value={contactForm.revenueGenerated} onChange={e => setContactForm(p => ({...p, revenueGenerated: parseFloat(e.target.value) || 0}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea value={contactForm.notes} onChange={e => setContactForm(p => ({...p, notes: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows="2" />
                  </div>
                  <button onClick={handleSaveContact} className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
                    {editingItem ? 'Update Influencer' : 'Add Influencer'}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                    <input type="text" value={campaignForm.campaignName} onChange={e => setCampaignForm(p => ({...p, campaignName: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Campaign name" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                      <select value={campaignForm.platform} onChange={e => setCampaignForm(p => ({...p, platform: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="meta">Meta (FB/IG)</option>
                        <option value="google">Google Ads</option>
                        <option value="instagram">Instagram</option>
                        <option value="youtube">YouTube</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select value={campaignForm.status} onChange={e => setCampaignForm(p => ({...p, status: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Budget (₹)</label>
                      <input type="number" value={campaignForm.budget} onChange={e => setCampaignForm(p => ({...p, budget: parseFloat(e.target.value) || 0}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Spend (₹)</label>
                      <input type="number" value={campaignForm.spend} onChange={e => setCampaignForm(p => ({...p, spend: parseFloat(e.target.value) || 0}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <input type="date" value={campaignForm.startDate} onChange={e => setCampaignForm(p => ({...p, startDate: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                      <input type="date" value={campaignForm.endDate} onChange={e => setCampaignForm(p => ({...p, endDate: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Impressions</label>
                      <input type="number" value={campaignForm.impressions} onChange={e => setCampaignForm(p => ({...p, impressions: parseInt(e.target.value) || 0}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Clicks</label>
                      <input type="number" value={campaignForm.clicks} onChange={e => setCampaignForm(p => ({...p, clicks: parseInt(e.target.value) || 0}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Orders Attributed</label>
                      <input type="number" value={campaignForm.ordersAttributed} onChange={e => setCampaignForm(p => ({...p, ordersAttributed: parseInt(e.target.value) || 0}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Revenue (₹)</label>
                      <input type="number" value={campaignForm.revenueAttributed} onChange={e => setCampaignForm(p => ({...p, revenueAttributed: parseFloat(e.target.value) || 0}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea value={campaignForm.notes} onChange={e => setCampaignForm(p => ({...p, notes: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows="2" />
                  </div>
                  <button onClick={handleSaveCampaign} className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
                    {editingItem ? 'Update Campaign' : 'Add Campaign'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
