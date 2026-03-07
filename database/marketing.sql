-- ============================================
-- WKLY Nuts - Marketing & Influencer Tracking
-- ============================================

-- Marketing Contacts (Influencers, Partners)
CREATE TABLE IF NOT EXISTS marketing_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  platform VARCHAR(50), -- instagram, youtube, facebook, twitter, other
  handle VARCHAR(255),
  followers INTEGER DEFAULT 0,
  contact_date DATE,
  status VARCHAR(50) DEFAULT 'contacted', -- contacted, negotiated, active, inactive, declined
  fee DECIMAL(10,2) DEFAULT 0,
  commission_percent DECIMAL(5,2) DEFAULT 0,
  orders_generated INTEGER DEFAULT 0,
  revenue_generated DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketing Campaigns (Ads)
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name VARCHAR(255) NOT NULL,
  platform VARCHAR(50), -- meta, google, instagram, youtube, whatsapp
  budget DECIMAL(10,2) DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'active', -- draft, active, paused, completed
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  orders_attributed INTEGER DEFAULT 0,
  revenue_attributed DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE marketing_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Allow all operations (single-user app)
CREATE POLICY "Allow all on marketing_contacts" ON marketing_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on marketing_campaigns" ON marketing_campaigns FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_contacts_status ON marketing_contacts(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_platform ON marketing_campaigns(platform);
