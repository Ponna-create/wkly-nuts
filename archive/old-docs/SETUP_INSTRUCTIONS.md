# 🚀 Setup Instructions - Security & Invoice System

## ✅ Step 1: Database Setup (COMPLETED)
You've successfully run `database/schema_secure.sql` in Supabase. Your database now has:
- ✅ Customer table
- ✅ Invoice table
- ✅ All triggers and functions

## 🔐 Step 2: Set Password (REQUIRED - 2 minutes)

### For Local Development:

1. **Create `.env` file** in project root:
   ```bash
   # In project root directory
   touch .env
   ```

2. **Add password to `.env` file**:
   ```env
   VITE_APP_PASSWORD=your_secure_password_here
   ```
   Replace `your_secure_password_here` with your actual password.

3. **Restart dev server**:
   ```bash
   npm run dev
   ```

### For Vercel Deployment:

1. Go to **Vercel Dashboard** → Your Project
2. Click **Settings** → **Environment Variables**
3. Click **Add New**
4. Add:
   - **Key**: `VITE_APP_PASSWORD`
   - **Value**: Your secure password
   - **Environment**: Select all (Production, Preview, Development)
5. Click **Save**
6. **Redeploy** your app (or it will auto-deploy)

## 🧪 Step 3: Test Authentication

1. Open your app (local or Vercel URL)
2. You should see a **login screen** with password field
3. Enter your password
4. Click **Login**
5. You should be logged in and see the app

**Default password** (if not set): `wklynuts2025`

⚠️ **IMPORTANT**: Change the default password immediately!

## 📋 Step 4: What's Next?

After authentication is working, we'll add:

1. **Customer Management** - Add/edit/delete customers
2. **Invoice Management** - Create invoices, mark as paid
3. **PDF Generation** - Professional invoice PDFs
4. **Integration** - Link invoices with SKUs and pricing

## 🔒 Security Notes

- Password is stored in environment variable (not in code)
- Session stored in localStorage (clears on logout)
- For production, consider implementing Supabase Auth later
- Current setup is good for internal use

## ❓ Troubleshooting

### Login not working?
- Check `.env` file exists and has `VITE_APP_PASSWORD`
- Restart dev server after adding `.env`
- Check Vercel environment variables are set
- Clear browser cache and try again

### Database errors?
- Make sure you ran `schema_secure.sql` completely
- Check Supabase dashboard for table creation
- Verify RLS policies are created

### Need help?
- Check `IMPLEMENTATION_PLAN.md` for full roadmap
- Review error messages in browser console (F12)

