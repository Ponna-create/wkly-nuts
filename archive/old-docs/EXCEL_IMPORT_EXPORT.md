# Excel Import/Export Guide - WKLY Nuts App

## 📊 NEW FEATURE: Excel Export & JSON Backup/Restore

You can now export all your data to Excel and create backup files that can be imported later!

## Where to Find It

1. Open the app: `http://localhost:5173`
2. Go to **Dashboard**
3. Look for the **"Data Management"** card (blue/teal card with Excel icon)
4. You'll see 4 buttons:
   - **Export Excel** - Export all data to Excel file (.xlsx)
   - **Backup (JSON)** - Create a complete backup file (.json)
   - **Import Backup** - Restore data from a backup file
   - **Clear All Data** - Delete everything and start fresh

## Features

### 1. Export to Excel (.xlsx)

**What it does:**
- Creates a professional Excel file with multiple sheets
- Separate sheets for: Vendors, SKUs, Pricing, Sales Targets
- Ready to view, edit, or share with your team

**What's included:**

**Vendors Sheet:**
- Vendor details (name, phone, location, email)
- All ingredients with quantities, prices, quality ratings
- Easy to filter and analyze

**SKUs Sheet:**
- SKU information (name, description, target weight)
- All 7-day recipes (MON-SUN)
- Ingredient details per day
- Vendor information for each ingredient

**Pricing Sheet:**
- All pricing strategies
- Cost breakdown (raw materials, packaging, operating, etc.)
- Profit margins and selling prices
- Both Weekly and Monthly pack pricing

**Sales Targets Sheet:**
- Monthly sales targets
- Revenue and profit projections
- Pack type and target units

**How to use:**
1. Click **"Export Excel"** button
2. Excel file downloads automatically
3. File name: `WKLY-Nuts-Data-YYYY-MM-DD.xlsx`
4. Open in Excel, Google Sheets, or any spreadsheet software

**When to use:**
- Share data with team members
- Analyze data in Excel
- Create reports and presentations
- Archive monthly data
- Send to procurement team

### 2. Backup (JSON) - Complete Backup File

**What it does:**
- Creates a complete backup of ALL your data
- Includes vendors, SKUs, pricing, sales targets
- Can be imported back to restore everything

**What's included:**
- All vendors with ingredients
- All SKUs with 7-day recipes
- All pricing strategies
- All sales targets
- Export timestamp

**How to use:**
1. Click **"Backup (JSON)"** button
2. JSON file downloads automatically
3. File name: `WKLY-Nuts-Backup-YYYY-MM-DD.json`
4. Keep this file safe!

**When to use:**
- Before making major changes
- Weekly/monthly backups
- Before updating the app
- Before clearing data
- To transfer data to another computer

### 3. Import Backup - Restore Your Data

**What it does:**
- Restores all data from a previously exported backup file
- Replaces current data with backup data

**How to use:**
1. Click **"Import Backup"** button
2. Select your backup .json file
3. Confirm the import (shows backup date)
4. Data is restored and page reloads
5. All your data is back!

**⚠️ Important:**
- Importing will REPLACE all current data
- Make sure you have a backup of current data first
- Only import files created by this app
- File must be in JSON format

**When to use:**
- Restore after accidental deletion
- Move data to a new computer
- Revert to a previous version
- Recover from mistakes

### 4. Clear All Data

**What it does:**
- Deletes ALL data from the app
- Cannot be undone!

**How to use:**
1. Click **"Clear All Data"** button
2. Confirm the action
3. Page reloads with empty app

**⚠️ Warning:**
- This DELETES everything permanently
- Export a backup first!
- Use only when you want to start completely fresh

## Complete Workflow Examples

### Example 1: Weekly Backup Routine

**Every Friday:**
1. Go to Dashboard
2. Click **"Backup (JSON)"**
3. Save file to: `D:\Backups\WKLY-Nuts\`
4. Click **"Export Excel"** 
5. Email Excel file to team

### Example 2: Moving to a New Computer

**On Old Computer:**
1. Go to Dashboard
2. Click **"Backup (JSON)"**
3. Copy file to USB drive

**On New Computer:**
1. Install and run the app
2. Go to Dashboard
3. Click **"Import Backup"**
4. Select the backup file from USB
5. All data restored!

### Example 3: Monthly Data Archive

**End of Each Month:**
1. Export Excel file
2. Rename: `WKLY-Nuts-January-2025.xlsx`
3. Save to: `D:\Archives\`
4. Create JSON backup as well
5. Keep for historical records

### Example 4: Share with Procurement Team

**Before placing orders:**
1. Use Production Calculator
2. Export production requirements CSV (from Production Calculator)
3. Go to Dashboard
4. Export Excel for complete data reference
5. Email both files to procurement

### Example 5: Testing New Features

**Before testing:**
1. Click **"Backup (JSON)"** - save current data
2. Test new features
3. If something goes wrong:
   - Click **"Import Backup"**
   - Select your backup
   - Everything restored!

## File Formats Explained

### Excel Format (.xlsx)
- **Type**: Microsoft Excel format
- **Can open in**: Excel, Google Sheets, LibreOffice
- **Best for**: Viewing, analyzing, sharing
- **Contains**: Formatted data in multiple sheets
- **Can edit**: Yes, but can't import back
- **Size**: Larger (includes formatting)

### JSON Format (.json)
- **Type**: JavaScript Object Notation
- **Can open in**: Text editors, browsers
- **Best for**: Backup and restore
- **Contains**: Raw data structure
- **Can edit**: Not recommended (might break format)
- **Size**: Smaller (no formatting)

## Data Management Best Practices

### Daily Use
- ✅ App automatically saves to localStorage
- ✅ Create vendors, SKUs normally
- ✅ Data persists across sessions

### Weekly Routine
- 📅 Friday: Export JSON backup
- 📊 Export Excel for team review
- 📧 Share Excel with relevant teams

### Monthly Routine
- 📁 Archive previous month's data
- 💾 Create dated backup files
- 🗑️ (Optional) Clear test data

### Before Major Changes
- 💾 Always create a backup first!
- 🧪 Test changes
- ↩️ Restore if needed

## Troubleshooting

### Q: Export buttons are disabled/grayed out
**A:** You don't have any data yet. Create vendors or SKUs first.

### Q: Import doesn't work
**A:** Make sure you're importing a .json file created by this app. Check the file isn't corrupted.

### Q: Excel file won't open
**A:** Make sure you have Excel, Google Sheets, or LibreOffice installed. Try opening in a different program.

### Q: Can I edit the Excel file and import it back?
**A:** No, Excel export is for viewing/sharing only. To modify data, edit in the app, then export again.

### Q: Lost my backup file, can I recover data?
**A:** If data is still in the app (localStorage), export a new backup immediately. Otherwise, data cannot be recovered.

### Q: Import replaced my data by accident!
**A:** If you had a previous backup, import that. Otherwise, data is lost. Always backup before importing!

### Q: How often should I backup?
**A:** Weekly is recommended. Before major changes always backup.

### Q: Where should I save backup files?
**A:** 
- Local: `D:\Backups\WKLY-Nuts\`
- Cloud: Google Drive, OneDrive, Dropbox
- Both for extra safety!

### Q: Can I use Excel export for importing?
**A:** No, only JSON backups can be imported. Excel is for viewing/sharing only.

## File Naming Conventions

**Recommended naming:**
- Daily: `WKLY-Nuts-Backup-2025-01-15.json`
- Weekly: `WKLY-Nuts-Week-03-2025.json`
- Monthly: `WKLY-Nuts-January-2025.xlsx`
- Before Changes: `WKLY-Nuts-Before-Update.json`

## Security Notes

⚠️ **Important Security Considerations:**

1. **Backup files contain sensitive data:**
   - Vendor contact information
   - Pricing strategies
   - Sales targets
   - Keep files secure!

2. **Don't share backup files publicly:**
   - Contains business data
   - Share only with authorized team members

3. **Use secure storage:**
   - Password-protected folders
   - Encrypted drives
   - Secure cloud storage with 2FA

4. **Excel exports for sharing:**
   - Review data before sharing
   - Remove sensitive sheets if needed
   - Share read-only or password-protected

## Summary

✅ **Export Excel**: Share data with team, analyze in Excel
✅ **Backup JSON**: Create complete backup for restore
✅ **Import Backup**: Restore previous data
✅ **Clear Data**: Start fresh (backup first!)

**Remember:**
- 💾 Backup regularly (weekly recommended)
- 📊 Export Excel for team sharing
- 🔒 Keep backup files secure
- ⚠️ Always backup before importing or clearing

---

**Last Updated**: September 30, 2025

Happy data managing! 📊🥜

