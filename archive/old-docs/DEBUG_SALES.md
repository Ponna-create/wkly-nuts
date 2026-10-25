# Sales & Revenue Debug Guide

## Issue: Blank white screen on Sales & Revenue page

## Possible Causes:
1. Port conflict (5173 vs 5175)
2. JavaScript error preventing render
3. Missing dependencies
4. Routing issue

## Solutions to Try:

### 1. Check Correct Port
The app is running on port 5175, not 5173.
- Try: http://localhost:5175/sales
- Or: http://localhost:5175 (then click Sales & Revenue)

### 2. Check Browser Console
1. Press F12 to open Developer Tools
2. Go to Console tab
3. Look for any red error messages
4. Take screenshot if errors found

### 3. Clear Browser Cache
1. Press Ctrl+Shift+R (hard refresh)
2. Or clear browser cache completely

### 4. Check Network Tab
1. Press F12 → Network tab
2. Refresh page
3. Look for failed requests (red entries)

### 5. Try Different Browser
- Chrome, Firefox, Edge
- Test in incognito/private mode

## Quick Fix Commands:

```bash
# Stop all servers
taskkill /f /im node.exe

# Start fresh
cd "D:\POKAsoft\wkly nuts app\wkly nuts app\vendor and product management tool"
npm run dev
```

## Expected Behavior:
- Sales & Revenue page should show:
  - Month/Year selection dropdowns
  - Add Target Row form
  - Break-even Analysis section
  - Fixed costs input fields

## If Still Not Working:
1. Check if other pages work (Dashboard, Vendors, SKUs)
2. Try creating a simple test page
3. Check for JavaScript errors in console
