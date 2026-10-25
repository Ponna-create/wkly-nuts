# 🗄️ Supabase Database Setup Guide

This guide will help you set up a free Supabase database for persistent data storage.

## ✅ Why Supabase?

- **Free Tier**: 500MB database, 50K monthly active users
- **PostgreSQL Database**: Reliable and powerful
- **Real-time**: Optional real-time subscriptions
- **Easy Setup**: No server configuration needed
- **Secure**: Built-in authentication and security

---

## 📋 Step 1: Create Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click **"Start your project"** or **"Sign up"**
3. Sign up with GitHub (recommended) or email
4. Verify your email

---

## 🏗️ Step 2: Create a New Project

1. Click **"New Project"**
2. Fill in:
   - **Name**: `wkly-nuts-app` (or any name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free (Hobby)
3. Click **"Create new project"**
4. Wait 2-3 minutes for setup to complete

---

## 🔑 Step 3: Get Your API Keys

1. In your Supabase project dashboard, click **Settings** (gear icon)
2. Go to **API** section
3. Find these two values:

   - **Project URL**: Looks like `https://xxxxx.supabase.co`
   - **anon public key**: Long string starting with `eyJ...`

4. **Copy both** - you'll need them next!

---

## 📊 Step 4: Create Database Tables

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open the file `database/schema.sql` in this project
4. Copy **ALL** the SQL code from that file
5. Paste into Supabase SQL Editor
6. Click **"Run"** or press `Ctrl+Enter`
7. You should see: "Success. No rows returned"

Your database tables are now created! ✅

---

## 🔐 Step 5: Configure Environment Variables

### For Local Development:

1. Create a file named `.env` in the project root (same folder as `package.json`)

2. Add these lines (replace with YOUR values from Step 3):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

3. **Important**: Make sure `.env` is in `.gitignore` (it should be already)

### For Vercel Deployment:

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add two variables:
   - **Name**: `VITE_SUPABASE_URL`
     **Value**: `https://your-project-id.supabase.co`
   - **Name**: `VITE_SUPABASE_ANON_KEY`
     **Value**: `your-anon-key-here`
4. Select **Production**, **Preview**, and **Development**
5. Click **Save**

---

## ✅ Step 6: Verify Setup

1. **Restart your dev server** (if running):
   ```powershell
   # Stop server (Ctrl+C)
   # Start again
   npm run dev
   ```

2. **Test the app**:
   - Create a vendor
   - Create a SKU
   - Check if data persists after refresh

3. **Check Supabase Dashboard**:
   - Go to **Table Editor** in Supabase
   - You should see tables: `vendors`, `skus`, `pricing_strategies`, `sales_targets`
   - Click on a table to see your data!

---

## 🚀 Step 7: Deploy to Vercel

After setting environment variables in Vercel (Step 5):

1. Push your code to GitHub:
   ```powershell
   git add .
   git commit -m "Add Supabase database integration"
   git push origin main
   ```

2. Vercel will automatically redeploy
3. Your app will use the database! 🎉

---

## 🔍 Troubleshooting

### "Supabase not configured" warning
- Check `.env` file exists in project root
- Verify environment variable names are correct
- Restart dev server after creating `.env`

### Data not saving
- Check browser console for errors
- Verify Supabase URL and key are correct
- Check Supabase dashboard → Table Editor to see if tables exist

### "Permission denied" error
- Go to Supabase → Settings → API
- Check Row Level Security (RLS) policies
- Make sure policies in `schema.sql` were created

### Can't see tables in Supabase
- Go to SQL Editor and run `schema.sql` again
- Check if tables appear in Table Editor

---

## 📝 Database Structure

Your database has 4 main tables:

1. **vendors** - Vendor information and ingredients
2. **skus** - Product SKUs with recipes
3. **pricing_strategies** - Pricing configurations
4. **sales_targets** - Monthly sales targets

All data is stored as JSONB (flexible JSON format) for complex structures.

---

## 🔒 Security Notes

- The `anon` key is safe to use in frontend (it's designed for public use)
- Row Level Security (RLS) is enabled but currently allows all operations
- For production, you may want to add authentication and restrict access

---

## 🎉 Success!

Once setup is complete:
- ✅ Data persists across browser sessions
- ✅ Data is accessible from any device
- ✅ Data survives server restarts
- ✅ You can access data from Supabase dashboard

Your app now has a real database! 🚀

