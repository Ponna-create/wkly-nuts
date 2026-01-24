# 📋 WKLY Nuts Upgrade Tasks

## 🚨 Critical Security (Immediate)
- [x] **Delete Credentials File**: Remove `superbase data base.txt` from root. <!-- id: 0 -->
- [ ] **Rotate Keys**: User to rotate Supabase keys (Manual Action). <!-- id: 1 -->

## 📈 Feature: Vendor Price History (New Request)
- [x] **Database Schema**: Create `price_history` table (vendor_id, ingredient_name, price, date). <!-- id: 2 -->
- [x] **Log Price Changes**: Update `updateVendor` service to insert record into `price_history` whenever price changes. <!-- id: 3 -->
- [x] **UI - Price Trend**: Show a sparkline/chart of price trends in Vendor details. <!-- id: 4 -->
- [x] **Volatility Buffer**:
    - [x] Calculate % volatility (Standard Deviation or Max-Min). <!-- id: 5 -->
    - [x] Add "Safety Buffer %" field to `PricingStrategy`. <!-- id: 6 -->
    - [ ] Auto-suggest buffer based on historical volatility. <!-- id: 7 -->

## 📦 Phase 2: Inventory & Batch Tracking (Active)
- [x] **Schema Update**: Create `ingredients` and `ingredient_batches` tables. <!-- id: 8 -->
- [x] **Data Migration**: Migrate existing vendor stock to "Opening Balance" batches. <!-- id: 9 -->
- [x] **Backend Services**: Update `supabase.js` to read/write `ingredient_batches`. <!-- id: 10 -->
- [x] **UI - Inventory Page**: Create new Inventory Dashboard showing Batches. <!-- id: 13 -->
- [ ] **FIFO Logic**: Update production calculator to consume from oldest batch. <!-- id: 14 -->

## 🏭 Phase 3: Production Realities
- [ ] **Wastage Tracking**: UI to record scrap/waste during production. <!-- id: 11 -->
- [ ] **Cost Impact**: Factor wastage into Cost of Goods Sold (COGS). <!-- id: 12 -->
