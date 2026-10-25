# WKLY Nuts Production Manager - Quick Start Guide

## Installation

1. **Install Node.js** (if not already installed)
   - Download from https://nodejs.org/
   - Version 16 or higher recommended

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Open in Browser**
   - Navigate to `http://localhost:5173`
   - The app will open automatically

## First Steps

### Step 1: Create Your First Vendor (2 minutes)

1. Click **"Vendor Management"** from the dashboard
2. Click **"Create Vendor"** button (green button, top right)
3. Fill in vendor details:
   - Name: "ABC Suppliers"
   - Phone: "9876543210"
   - Location: "Mumbai"
   - Email: "abc@example.com" (optional)

4. Add ingredients:
   - **Ingredient 1:**
     - Name: Almonds
     - Quantity: 100
     - Unit: kg
     - Price: 500 (₹500/kg)
     - Quality: 5 stars
   
   - **Ingredient 2:**
     - Name: Cashews
     - Quantity: 50
     - Unit: kg
     - Price: 700 (₹700/kg)
     - Quality: 5 stars
   
   - Click **"Add Ingredient"** after each
   
5. Click **"Save Vendor"**

### Step 2: Create Your First SKU (3 minutes)

1. Click **"SKU Management"** from sidebar
2. Click **"Create SKU"** button
3. Fill in SKU details:
   - Name: "Night Pack"
   - Description: "Evening wellness blend"

4. Build the recipe:
   - Select **"Almonds (ABC Suppliers)"** from dropdown
   - Enter **6** grams per sachet
   - Click **"Add to Recipe"**
   
   - Select **"Cashews (ABC Suppliers)"** from dropdown
   - Enter **8** grams per sachet
   - Click **"Add to Recipe"**

5. Review the calculations:
   - You'll see total per sachet: 14g
   - Weekly Pack (7 sachets): 98g total
   - Monthly Pack (28 sachets): 392g total
   - Raw material costs calculated automatically

6. Click **"Save SKU"**

### Step 3: Set Pricing (2 minutes)

1. Click **"Pricing Strategy"** from sidebar
2. Select **"Night Pack"** from SKU dropdown
3. Select pack type: **"Weekly Pack"**
4. Fill in costs:
   - Sachet Packaging: ₹2.00 per sachet
   - Pack Box: ₹15.00
   - Operating Cost: ₹10.00
   - Marketing: ₹5.00
   - Shipping: ₹20.00

5. Set profit margin:
   - Use slider to set **30%** profit margin
   - See suggested selling price automatically

6. Click **"Save Pricing Strategy"**

7. Repeat for **"Monthly Pack"**:
   - Same costs (adjust if needed)
   - Set profit margin
   - Save

### Step 4: Calculate Production (1 minute)

1. In **"SKU Management"**, click **"Production Calculator"**
2. Select **"Night Pack"**
3. Select **"Monthly Pack"**
4. Enter **80** packs
5. Click **"Calculate Requirements"**

You'll see:
- Total sachets: 2,240
- Ingredient breakdown per ingredient
- Total grams needed (e.g., Almonds: 13,440g = 13.44kg)
- Available stock from vendors
- Any shortages
- Total cost
- Cost per pack
- Recommended vendors

6. Click **"Export CSV"** or **"Print"** to save

### Step 5: Set Sales Target (2 minutes)

1. Click **"Sales & Revenue"** from sidebar
2. Select current month and year
3. Add target rows:
   - SKU: **Night Pack**
   - Pack Type: **Weekly**
   - Target Units: **50**
   - Click **"Add"**
   
   - SKU: **Night Pack**
   - Pack Type: **Monthly**
   - Target Units: **100**
   - Click **"Add"**

4. Fill in fixed costs:
   - Rent: ₹10,000
   - Salaries: ₹20,000
   - Utilities: ₹5,000
   - Other: ₹5,000

5. Click **"Save Monthly Targets"**

View your:
- Total revenue projection
- Total profit projection
- Break-even analysis
- Raw material requirements for the month

## Tips & Tricks

### 💡 Quick Navigation
- Use the sidebar to switch between modules
- Dashboard shows quick stats at a glance

### 💡 Search & Filter
- Use search bar in Vendor Management to quickly find suppliers
- Filter by location or vendor name

### 💡 Edit Anytime
- Click edit icon (pencil) to modify vendors or SKUs
- Pricing can be updated per pack type

### 💡 Export Data
- Production Calculator: Export ingredient requirements to CSV
- Sales Targets: Export monthly targets to CSV
- Print production orders for your team

### 💡 Pack Types
- **Weekly Pack**: 7 sachets - Good for first-time customers
- **Monthly Pack**: 28 sachets (4 weeks) - Better for subscriptions
- Set different pricing for each to optimize margins

### 💡 Production Planning
- Use Production Calculator before placing vendor orders
- Check for shortages in red
- System recommends cheapest vendor with sufficient stock

### 💡 Pricing Strategy
- Try both modes:
  - Margin mode: Set desired profit %
  - Manual mode: Enter target price, see if it's profitable
- Compare Weekly vs Monthly to find savings for customers

### 💡 Break-even Analysis
- Set realistic fixed costs
- See how many units you need to sell to break even
- Plan sales targets above break-even point

## Common Workflows

### 🔄 Weekly Production Planning
1. Go to Sales & Revenue → View monthly target
2. Go to SKU Management → Production Calculator
3. Select SKU and weekly pack
4. Calculate requirements
5. Export CSV
6. Send to procurement team

### 🔄 Monthly Review
1. Check Dashboard for overall stats
2. Review Sales & Revenue for monthly performance
3. Check break-even status
4. Plan next month's targets
5. Update vendor inventory if needed

### 🔄 New Product Launch
1. Add any new ingredients to vendors
2. Create new SKU with recipe
3. Set pricing for both pack types
4. Add to sales targets
5. Calculate production requirements

## Keyboard Shortcuts

- **Tab**: Navigate through form fields
- **Enter**: Submit forms (when focused on buttons)
- **Esc**: Close modals/forms (click X button)

## Data Persistence

⚠️ **Important**: All data is stored in memory. If you refresh the page, data will be lost.

For production use, you would need to:
- Add a backend (Node.js, Python, etc.)
- Use a database (MongoDB, PostgreSQL, etc.)
- Or use browser localStorage (can be added easily)

## Troubleshooting

### App won't start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Port already in use
- Vite will automatically use next available port
- Or specify port: `npm run dev -- --port 3000`

### Styling issues
```bash
# Rebuild Tailwind
npm run build
```

## Next Steps

1. ✅ Add more vendors and ingredients
2. ✅ Create all your product SKUs
3. ✅ Set pricing strategies
4. ✅ Plan sales targets for next 3 months
5. ✅ Use production calculator weekly
6. ✅ Track and adjust based on actual sales

## Support

For questions or issues:
1. Check the main README.md
2. Review this Quick Start guide
3. Contact development team

---

**Happy Production Planning! 🥜**
