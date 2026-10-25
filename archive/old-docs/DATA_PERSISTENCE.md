# Data Persistence - WKLY Nuts App

## ✅ DATA IS NOW AUTOMATICALLY SAVED!

Your data is automatically saved to your browser's localStorage and will persist across:
- ✅ Page refreshes
- ✅ Browser restarts
- ✅ Server restarts
- ✅ App updates

## What Data is Saved?

All your important data is saved automatically:
- **Vendors** - All vendor information and ingredients
- **SKUs** - All products with their 7-day recipes
- **Pricing Strategies** - All pricing configurations
- **Sales Targets** - All monthly targets and projections

## How It Works

### Automatic Save
Every time you:
- Create a vendor
- Add/edit ingredients
- Create/edit a SKU
- Update pricing
- Set sales targets

...the data is **immediately saved** to localStorage!

### Automatic Load
When you:
- Open the app
- Refresh the page
- Restart the browser

...all your data is **automatically loaded**!

## Clear All Data

If you want to start fresh:
1. Go to **Dashboard**
2. Click **"Clear All Data"** button (top-right, red button)
3. Confirm the action
4. All data will be deleted and page will reload

## Data Location

Your data is stored in your browser's localStorage at:
- **Key**: `wklyNutsAppData`
- **Location**: Browser's localStorage (local to your computer)
- **Format**: JSON

## View Your Data (Developer Tools)

To view your saved data:
1. Press **F12** to open Developer Tools
2. Go to **Application** tab
3. Click **Local Storage** → `http://localhost:5173`
4. Find **wklyNutsAppData**
5. Click to view the JSON data

## Export Your Data

### Method 1: Use Export Features
Each module has export buttons:
- **Production Calculator**: Export CSV
- **Sales Targets**: Export CSV

### Method 2: Backup localStorage
1. Open Developer Tools (F12)
2. Go to Console tab
3. Type: `localStorage.getItem('wklyNutsAppData')`
4. Copy the output
5. Save to a file for backup

### Method 3: Manual Backup
```javascript
// In browser console (F12)
const data = localStorage.getItem('wklyNutsAppData');
console.log(data);
// Copy and save to a file
```

## Import/Restore Data

To restore a backup:
1. Open Developer Tools (F12)
2. Go to Console tab
3. Type:
```javascript
localStorage.setItem('wklyNutsAppData', 'YOUR_BACKUP_JSON_HERE');
location.reload();
```

## Limitations

### localStorage Limits
- **Size Limit**: ~5-10MB per domain (varies by browser)
- **Browser-Specific**: Data is only available in the browser where you saved it
- **Device-Specific**: Data doesn't sync across devices
- **Not Secure**: Don't store sensitive information

### What This Means
- If you switch browsers (Chrome → Firefox), data won't transfer
- If you use a different computer, data won't be there
- If you clear browser data, localStorage will be deleted

## Tips

### Regular Backups
Even though data persists, it's good practice to:
- Export important production orders to CSV
- Periodically backup your localStorage (see above)
- Keep screenshots of important configurations

### Multiple Devices
If you need to use the app on multiple devices:
1. Export data from Device A (copy localStorage)
2. Import data to Device B (paste localStorage)

Or use the CSV export features for specific data.

### Browser Clearing
Be careful when clearing browser data:
- **"Clear cookies"** → localStorage is safe
- **"Clear site data"** → localStorage will be deleted! ⚠️
- **"Clear all browsing data"** → localStorage will be deleted! ⚠️

## Troubleshooting

### Data Not Saving
1. Check browser console (F12) for errors
2. Verify localStorage is enabled in your browser
3. Check if you're in Private/Incognito mode (localStorage may not work)
4. Try clearing old data and starting fresh

### Data Not Loading
1. Check if localStorage has data:
   ```javascript
   localStorage.getItem('wklyNutsAppData')
   ```
2. If null, data was never saved or was cleared
3. Check browser console for errors

### Corrupted Data
If the app crashes or shows errors:
1. Go to Dashboard
2. Click "Clear All Data"
3. Start fresh

Or manually clear:
```javascript
localStorage.removeItem('wklyNutsAppData');
location.reload();
```

## Future Enhancements

Potential improvements (not yet implemented):
- Cloud sync across devices
- Backend database integration
- Automatic cloud backups
- Import/Export UI in the app
- Data versioning and migration
- Conflict resolution for multi-device use

## Summary

✅ **Your data now persists automatically!**
✅ **No more losing vendor details on refresh!**
✅ **All SKUs, pricing, and targets are saved!**
⚠️ **Remember to backup important data regularly!**

---

**Last Updated**: September 30, 2025

Enjoy using WKLY Nuts Production Manager without worrying about losing your data! 🎉

