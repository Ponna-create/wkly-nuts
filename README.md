# WKLY Nuts Production Management Application

A comprehensive production management web application built for WKLY Nuts brand to manage vendors, SKUs, pricing, and sales targets.

## Features

### 0. Data Management (NEW! 🎉)
- **Export to Excel (.xlsx)** - Export all data to professional Excel file
- **Backup (JSON)** - Create complete backup file
- **Import Backup** - Restore data from backup file
- **Clear All Data** - Start fresh
- Automatic localStorage persistence
- See `EXCEL_IMPORT_EXPORT.md` for complete guide

### 1. Dashboard
- Quick overview of all metrics
- Total vendors, SKUs, ingredients, and pricing strategies
- Monthly revenue targets
- Quick access to all modules
- Data Management card with export/import options

### 2. Vendor Management
- Create and manage ingredient suppliers
- Add multiple ingredients per vendor with:
  - Quantity available
  - Price per unit
  - Quality ratings (1-5 stars)
  - Notes
- Search and filter vendors
- Track total inventory value per vendor
- Edit and delete vendors

### 3. SKU Management
- Create product SKUs with custom recipes
- Recipe builder with ingredient quantities per sachet
- Automatic calculations for:
  - **Weekly Pack**: 7 sachets
  - **Monthly Pack**: 28 sachets (4 weeks)
- Production Calculator:
  - Select SKU and pack type
  - Enter number of packs to produce
  - Calculates ingredient requirements
  - Shows available stock and shortages
  - Recommends best vendors (cheapest with sufficient stock)
  - Displays total costs and cost per pack
- Export production requirements to CSV
- Print production orders

### 4. Pricing Strategy
- Set pricing for both Weekly and Monthly packs
- Cost breakdown:
  - Raw material cost (auto-calculated)
  - Sachet packaging cost
  - Pack box/bag cost
  - Labor/operating costs
  - Marketing costs
  - Shipping/delivery costs
  - Other costs
- Two pricing modes:
  - **Profit Margin Mode**: Set desired margin % and get suggested price
  - **Manual Pricing Mode**: Enter selling price and see profit/margin
- Comparison view:
  - Weekly vs Monthly pack pricing
  - Customer savings when buying monthly
  - Profit comparison

### 5. Sales Target & Revenue
- Set monthly sales targets by SKU and pack type
- Automatic revenue and profit projections
- Monthly summary:
  - Total weekly and monthly packs
  - Total revenue and profit
  - Average profit margin
- Break-even analysis:
  - Fixed costs (rent, salaries, utilities)
  - Break-even units for weekly and monthly packs
  - Break-even revenue
- Raw material planning:
  - Total ingredients needed based on targets
  - Recommended vendors for procurement
  - Total procurement cost
- Annual overview of all saved targets
- Export to CSV

## Technology Stack

- **React 18** - UI library with functional components and hooks
- **React Router 6** - Client-side routing
- **Tailwind CSS 3** - Utility-first styling with custom WKLY Nuts theme
- **Vite** - Fast build tool and dev server
- **Lucide React** - Modern icon library
- **Context API** - Global state management
- **XLSX (SheetJS)** - Excel export/import functionality
- **localStorage API** - Data persistence

## Design Theme

- **Primary Color**: Teal/Green (#2D8B7B) - WKLY Nuts brand color
- **Secondary Color**: Warm coral/salmon (#FF9580) for accents
- **Typography**: Sans-serif, clean and modern
- **UI Style**: Rounded corners, card-based layout, professional yet approachable

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Preview production build:
```bash
npm run preview
```

## Usage Guide

### Getting Started

1. **Add Vendors**: Start by creating vendors and adding their available ingredients
2. **Create SKUs**: Build product recipes by selecting ingredients and setting quantities
3. **Set Pricing**: Calculate costs and set profit margins for both pack types
4. **Plan Sales**: Set monthly targets and track revenue projections

### Example Workflow

1. Create a vendor "ABC Suppliers" with ingredients:
   - Almonds: 100 kg @ ₹500/kg
   - Cashews: 50 kg @ ₹700/kg
   
2. Create SKU "Night Pack" with recipe:
   - Almonds: 6g per sachet
   - Cashews: 8g per sachet
   - Total: 14g per sachet
   
3. Set pricing for Night Pack:
   - Weekly Pack (7 sachets = 98g total)
   - Monthly Pack (28 sachets = 392g total)
   - Add packaging, operating, and other costs
   - Set 30% profit margin
   
4. Production Calculator:
   - Select "Night Pack" and "Monthly Pack"
   - Enter 80 packs to produce
   - Get ingredient requirements (80 × 28 = 2,240 sachets)
   - See total ingredient needs and costs
   
5. Set monthly sales target:
   - Night Pack Weekly: 50 units
   - Night Pack Monthly: 100 units
   - View projected revenue and profit

## Data Structure

All data is stored in memory using React Context API. No backend required.

### Key Data Models

- **Vendor**: name, phone, location, email, ingredients[]
- **Ingredient**: name, quantity, unit, price, quality rating
- **SKU**: name, description, recipe[], weeklyPack{}, monthlyPack{}
- **Pricing**: skuId, packType, costs, margins, sellingPrice
- **Sales Target**: month, year, targets[], fixedCosts

## Features

- ✅ Fully responsive (mobile, tablet, desktop)
- ✅ Form validation
- ✅ Toast notifications
- ✅ Confirmation dialogs
- ✅ Export to CSV and Excel
- ✅ Backup and restore (JSON import/export)
- ✅ Print functionality
- ✅ Real-time calculations
- ✅ Search and filter
- ✅ localStorage persistence (data survives page refresh)
- ✅ No backend required

## Key Calculations

### SKU Calculations
- Total grams per sachet = Sum of all ingredient grams
- Weekly pack total = Grams per sachet × 7
- Monthly pack total = Grams per sachet × 28

### Production Calculator
- Total sachets = Number of packs × Sachets per pack (7 or 28)
- Ingredient needed = Grams per sachet × Total sachets
- Total cost = Ingredient needed × Price per gram

### Pricing
- Total cost = Raw material + Packaging + Operating + Marketing + Shipping + Other
- Selling price = Total cost × (1 + Profit margin %)
- Profit amount = Selling price - Total cost

### Break-even
- Break-even units = Fixed costs / Profit per unit
- Break-even revenue = Break-even units × Selling price

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

Proprietary - WKLY Nuts

## Support

For issues or questions, contact the development team.
