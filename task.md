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

## 📦 Phase 1: Inventory & Food Safety
- [ ] **Schema Update**: Update `inventory` table to support Batches. <!-- id: 8 -->
- [ ] **Batch Management**: UI to add stock with Expiry Date and Batch #. <!-- id: 9 -->
- [ ] **FIFO Consumption**: Logic to deduct from oldest batch first. <!-- id: 10 -->

## 🏭 Phase 2: Production Realities
- [ ] **Wastage Tracking**: UI to record scrap/waste during production. <!-- id: 11 -->
- [ ] **Cost Impact**: Factor wastage into Cost of Goods Sold (COGS). <!-- id: 12 -->
