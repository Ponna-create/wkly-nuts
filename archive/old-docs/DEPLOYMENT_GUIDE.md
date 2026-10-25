# 🚀 Deployment Guide - WKLY Nuts App

This guide covers deploying your React + Vite application to various free hosting platforms.

## 📋 Prerequisites

1. **GitHub Account** (required for all platforms)
2. **Your code pushed to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

---

## 🌟 Option 1: Vercel (Recommended - Easiest)

### Why Vercel?
- ✅ Zero configuration needed
- ✅ Automatic deployments on git push
- ✅ Free SSL certificate
- ✅ Global CDN
- ✅ Perfect for Vite/React apps

### Steps:

#### Method 1: GitHub Integration (Recommended)

1. **Go to [vercel.com](https://vercel.com)**
   - Sign up/login with your GitHub account

2. **Import Your Project**
   - Click "Add New Project"
   - Select your GitHub repository
   - Click "Import"

3. **Configure Project** (Usually auto-detected)
   - **Framework Preset**: Vite (should auto-detect)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Deploy**
   - Click "Deploy"
   - Wait 1-2 minutes
   - Your app will be live! 🎉

5. **Your App URL**
   - Vercel provides a URL like: `https://your-app-name.vercel.app`
   - You can add a custom domain later

#### Method 2: Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```
   - Follow the prompts
   - Login to Vercel when asked
   - Confirm settings

3. **Production Deploy**
   ```bash
   vercel --prod
   ```

---

## 🌐 Option 2: Netlify (Great Alternative)

### Why Netlify?
- ✅ Drag & drop deployment
- ✅ Free SSL
- ✅ Form handling
- ✅ Serverless functions support

### Steps:

#### Method 1: Drag & Drop (Easiest)

1. **Build your app locally**
   ```bash
   npm run build
   ```

2. **Go to [netlify.com](https://netlify.com)**
   - Sign up/login with GitHub

3. **Deploy**
   - Go to "Sites" → "Add new site"
   - Drag and drop the `dist` folder
   - Your app is live! 🎉

#### Method 2: GitHub Integration (Recommended)

1. **Go to Netlify**
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository

2. **Build Settings**
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

3. **Deploy**
   - Click "Deploy site"
   - Netlify will auto-deploy on every push

4. **Configure Redirects** (For React Router)
   - Create `netlify.toml` in project root:
   ```toml
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

---

## 📦 Option 3: GitHub Pages (Free but More Setup)

### Steps:

1. **Install gh-pages package**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Update package.json**
   ```json
   {
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     },
     "homepage": "https://YOUR_USERNAME.github.io/YOUR_REPO_NAME"
   }
   ```

3. **Update vite.config.js**
   ```js
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'

   export default defineConfig({
     plugins: [react()],
     base: '/YOUR_REPO_NAME/'  // Replace with your repo name
   })
   ```

4. **Deploy**
   ```bash
   npm run deploy
   ```

5. **Enable GitHub Pages**
   - Go to repo Settings → Pages
   - Source: `gh-pages` branch
   - Your app: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME`

---

## ☁️ Option 4: Cloudflare Pages (Fast & Free)

### Steps:

1. **Go to [dash.cloudflare.com](https://dash.cloudflare.com)**
   - Sign up/login
   - Go to "Pages"

2. **Connect GitHub**
   - Click "Create a project"
   - Connect your GitHub repository

3. **Build Settings**
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`

4. **Deploy**
   - Click "Save and Deploy"
   - Your app will be live!

---

## 🔧 Option 5: Render (Full-Stack Ready)

### Steps:

1. **Go to [render.com](https://render.com)**
   - Sign up with GitHub

2. **Create Static Site**
   - Click "New +" → "Static Site"
   - Connect your GitHub repo

3. **Settings**
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`

4. **Deploy**
   - Click "Create Static Site"
   - Your app will be live!

---

## 📝 Important Notes

### For React Router (If using client-side routing):

All platforms need a redirect rule to serve `index.html` for all routes. This is already configured in `vercel.json` for Vercel.

**For Netlify**, create `netlify.toml`:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**For GitHub Pages**, the base path in `vite.config.js` handles this.

### Environment Variables (If needed later):

- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site Settings → Build & Deploy → Environment Variables
- **Cloudflare Pages**: Settings → Environment Variables

### Custom Domain:

All platforms support custom domains:
- **Vercel**: Project Settings → Domains
- **Netlify**: Site Settings → Domain Management
- **Cloudflare Pages**: Settings → Custom Domains

---

## 🎯 Quick Comparison

| Platform | Ease | Speed | Features | Best For |
|----------|------|-------|----------|----------|
| **Vercel** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Excellent | React/Vite apps |
| **Netlify** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Very Good | General static sites |
| **Cloudflare Pages** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Good | Fast global CDN |
| **GitHub Pages** | ⭐⭐⭐ | ⭐⭐⭐ | Basic | Open source projects |
| **Render** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Good | Full-stack ready |

---

## ✅ Recommended: Vercel

**For this project, we recommend Vercel** because:
1. Zero configuration (just connect GitHub)
2. Auto-detects Vite projects
3. Fastest deployments
4. Best developer experience

---

## 🐛 Troubleshooting

### Build Fails
- Check build logs in the platform dashboard
- Ensure `npm run build` works locally first
- Check Node.js version (most platforms use Node 18+)

### Routes Not Working
- Ensure redirect rules are configured (see above)
- Check that `index.html` is served for all routes

### App Shows Blank Page
- Open browser console (F12) to check errors
- Verify all assets are loading correctly
- Check network tab for failed requests

---

## 🚀 Quick Start Command Summary

```bash
# 1. Build locally to test
npm run build

# 2. Test production build
npm run preview

# 3. Push to GitHub (if not done)
git push origin main

# 4. Deploy to Vercel (after connecting repo)
# Just push to GitHub - Vercel auto-deploys!

# OR use CLI:
npm i -g vercel
vercel --prod
```

---

## 📞 Need Help?

- **Vercel Docs**: https://vercel.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **Vite Deployment**: https://vitejs.dev/guide/static-deploy.html

