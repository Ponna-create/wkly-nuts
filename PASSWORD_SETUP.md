# 🔐 Password Setup Guide

## ✅ Recommended: Use Vercel Environment Variables Only

**No need to create local `.env` file!** Just set it in Vercel dashboard.

---

## 🚀 Setup in Vercel (Recommended)

### Step 1: Go to Vercel Dashboard
1. Open your project in Vercel
2. Go to **Settings** → **Environment Variables**

### Step 2: Add Password
1. Click **Add New**
2. **Key**: `VITE_APP_PASSWORD`
3. **Value**: Your secure password (e.g., `MySecurePass123!`)
4. **Environment**: Select all (Production, Preview, Development)
5. Click **Save**

### Step 3: Add Username (Optional)
1. Click **Add New** again
2. **Key**: `VITE_APP_USERNAME`
3. **Value**: Your username (e.g., `admin` or `wklynuts`)
4. **Environment**: Select all
5. Click **Save**

### Step 4: Redeploy
- Vercel will auto-redeploy, or click **Redeploy** button

---

## 🔄 How to Reset Password

### If You Forget Password:

1. **Go to Vercel Dashboard**
2. **Settings** → **Environment Variables**
3. Find `VITE_APP_PASSWORD`
4. Click **Edit** (or delete and recreate)
5. Enter new password
6. Click **Save**
7. **Redeploy** your app
8. New password will be active immediately

**That's it!** No code changes needed.

---

## 📝 Password Requirements

- **Minimum**: 8 characters (recommended)
- **Use**: Mix of letters, numbers, and symbols
- **Example**: `WKLYNuts2025!` or `MySecurePass123`

---

## 🔒 Security Notes

- ✅ Password stored in Vercel (encrypted)
- ✅ Not visible in code or GitHub
- ✅ Can be changed anytime without code changes
- ✅ Each environment can have different password

---

## 🧪 Testing

1. After setting password in Vercel and redeploying
2. Open your app URL
3. You should see login screen
4. Enter username (if set) and password
5. Click Login

---

## ❓ Troubleshooting

### "Password not configured" error?
- Check Vercel environment variables are set
- Make sure variable name is exactly: `VITE_APP_PASSWORD`
- Redeploy after adding variables

### Login not working?
- Verify password in Vercel matches what you're entering
- Check for typos (case-sensitive)
- Clear browser cache and try again

### Want to disable username?
- Just don't set `VITE_APP_USERNAME` in Vercel
- Or delete it if already set
- App will work with password only

---

## 💡 Tips

- **For Team**: Share password securely (password manager, secure chat)
- **For Security**: Change password every 3-6 months
- **For Backup**: Note password in secure location (password manager)
- **For Testing**: Use different passwords for Production vs Preview

