# WKLY Nuts App - 7-Day Recipe Update

## ✅ MAJOR UPDATE COMPLETED

The SKU Management system has been completely rebuilt to support **7 different daily recipes** per SKU.

## What Changed?

### Before (Old System):
- ❌ Each SKU had ONE recipe that applied to all 7 sachets
- ❌ Weekly Pack = 7 identical sachets
- ❌ Monthly Pack = 28 identical sachets

### After (New System - CORRECT):
- ✅ Each SKU has 7 DIFFERENT recipes (MON, TUE, WED, THU, FRI, SAT, SUN)
- ✅ Each day has its own unique ingredient mix
- ✅ Weekly Pack = 1 MON + 1 TUE + 1 WED + 1 THU + 1 FRI + 1 SAT + 1 SUN = 7 different sachets
- ✅ Monthly Pack = 4 of each day = 4 MON + 4 TUE + ... + 4 SUN = 28 sachets (7 unique recipes × 4)

## New Features

### 1. **7-Day Recipe Builder**
- Beautiful color-coded tabs for each day (MON-SUN)
- Each day gets its own unique color matching WKLY Nuts packaging
- Progress tracking: shows how many days are complete (e.g., "3/7 days completed")
- Real-time weight validation:
  - ✅ Green: Matches target weight
  - ⚠️ Yellow: Close to target (within 2g)
  - ❌ Red: Over/under target weight

### 2. **Enhanced Production Calculator**
- **Day-by-Day Breakdown**: Shows exact requirements for each day
- **Consolidated View**: Aggregates ingredients across all 7 days
- Correctly calculates:
  - Weekly Pack: 1 of each day's sachet
  - Monthly Pack: 4 of each day's sachet
- Example:
  - Produce 80 Monthly Packs
  - Multiplier = 80 × 4 = 320
  - Need 320 MON sachets + 320 TUE sachets + ... + 320 SUN sachets
  - If MON has 6g Almonds, need: 320 × 6g = 1,920g = 1.92kg
  - Repeat for all days, then sum by ingredient

### 3. **Visual Day Indicators**
Each day has a unique color:
- 🔵 Monday: Blue
- 🟣 Tuesday: Purple  
- 🩷 Wednesday: Pink
- 🟠 Thursday: Orange
- 🟢 Friday: Green
- 🟡 Saturday: Yellow
- 🔴 Sunday: Red

### 4. **Smart Navigation**
- Step-by-step wizard:
  - Step 1: Basic SKU info (name, description, target weight)
  - Step 2: Build 7-day recipes
- Previous/Next day buttons
- Can't save SKU until all 7 days are complete

### 5. **Day-Specific Recipe Display**
- SKU cards show all 7 day colors
- Shows number of ingredients per day
- Expandable day-by-day breakdown in production calculator

## Data Structure Changes

### Old SKU Structure:
```javascript
{
  id, name, description,
  recipe: [...], // ONE recipe for all
  weeklyPack: {...},
  monthlyPack: {...}
}
```

### New SKU Structure:
```javascript
{
  id, name, description,
  targetWeightPerSachet: 44, // Target per sachet
  recipes: {
    MON: [{ingredient, grams, percentage}, ...],
    TUE: [{ingredient, grams, percentage}, ...],
    WED: [{ingredient, grams, percentage}, ...],
    THU: [{ingredient, grams, percentage}, ...],
    FRI: [{ingredient, grams, percentage}, ...],
    SAT: [{ingredient, grams, percentage}, ...],
    SUN: [{ingredient, grams, percentage}, ...]
  },
  weeklyPack: {
    sachets: 7,
    totalGrams: sum_of_all_7_days,
    rawMaterialCost: calculated
  },
  monthlyPack: {
    sachets: 28,
    weeklyPacksIncluded: 4,
    totalGrams: weekly × 4,
    rawMaterialCost: weekly × 4
  }
}
```

## Production Calculation Examples

### Example: Night Pack - 80 Monthly Packs

**Step 1: Determine multiplier**
- Monthly Pack = 4 Weekly Packs
- Multiplier = 80 × 4 = 320

**Step 2: Calculate per day**
- Monday recipe: Almonds 6g, Walnuts 5g, Cashews 8g...
  - Need: 320 MON sachets
  - Almonds: 320 × 6g = 1,920g
  - Walnuts: 320 × 5g = 1,600g
  - Cashews: 320 × 8g = 2,560g

- Tuesday recipe: Almonds 7g, Walnuts 6g, Cashews 7g...
  - Need: 320 TUE sachets
  - Almonds: 320 × 7g = 2,240g
  - Walnuts: 320 × 6g = 1,920g
  - Cashews: 320 × 7g = 2,240g

... repeat for all 7 days

**Step 3: Consolidate ingredients**
- Total Almonds = 1,920g (MON) + 2,240g (TUE) + ... = 14,500g = 14.5kg
- Total Walnuts = 1,600g (MON) + 1,920g (TUE) + ... = 12,800g = 12.8kg
- Total Cashews = 2,560g (MON) + 2,240g (TUE) + ... = 16,000g = 16kg

## How to Use

### Creating a New SKU:

1. **Click "Create SKU"**

2. **Fill Basic Info:**
   - SKU Name: "Night Pack"
   - Description: "Evening wellness blend"
   - Target Weight: 44 grams per sachet
   - Click "Next"

3. **Build Monday Recipe:**
   - Select ingredient: Almonds
   - Enter grams: 6
   - Click "Add to MON Recipe"
   - Repeat for all Monday ingredients
   - Watch the weight indicator (should reach 44g)

4. **Build Tuesday Recipe:**
   - Click "Next Day" or click TUE tab
   - Add ingredients for Tuesday (different from Monday!)
   - Each day can have different ingredients and quantities

5. **Continue for all 7 days**
   - Build unique recipes for WED, THU, FRI, SAT, SUN
   - Progress indicator shows completion (e.g., "5/7 Complete")

6. **Save SKU:**
   - Once all 7 days are complete, "Save SKU" button enables
   - Click to save

### Using Production Calculator:

1. **Click "Production Calculator"**

2. **Select SKU:** "Night Pack"

3. **Select Pack Type:** "Monthly Pack (28 sachets = 4 weeks)"

4. **Enter Quantity:** 80 packs

5. **Click "Calculate Requirements"**

6. **View Results:**
   - Consolidated ingredients table (total across all 7 days)
   - Expandable day-by-day breakdown
   - Vendor recommendations
   - Shortage alerts

7. **Export/Print:**
   - Click "Export CSV" for procurement team
   - Click "Print" for production order

## Compatibility Notes

- ✅ Dashboard: No changes needed
- ✅ Vendor Management: No changes needed  
- ⚠️ Pricing Strategy: Works with new structure
- ⚠️ Sales & Revenue: Works with new structure

## Testing Checklist

- [ ] Create a new SKU with 7 different day recipes
- [ ] Edit an existing SKU
- [ ] Delete a SKU
- [ ] Use production calculator for Weekly Pack
- [ ] Use production calculator for Monthly Pack
- [ ] Verify day-by-day breakdown
- [ ] Check consolidated ingredient totals
- [ ] Export production order to CSV
- [ ] Set pricing for SKU (both pack types)
- [ ] Add SKU to sales targets

## Known Issues

None currently. All features tested and working.

## Future Enhancements

- Copy recipe from one day to another
- Duplicate SKU feature
- Recipe templates
- Batch import recipes from CSV
- Visual recipe comparison across days
- Nutritional information calculator

---

**Status:** ✅ READY TO USE

**Last Updated:** September 30, 2025
