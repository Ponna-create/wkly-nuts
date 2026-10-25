# 📦 GitHub Setup Guide - Step by Step

This guide will help you upload your project to GitHub and deploy it.

---

## Step 1: Create a GitHub Account (If you don't have one)

1. Go to [github.com](https://github.com)
2. Sign up for a free account
3. Verify your email

---

## Step 2: Install Git (If not installed)

### Check if Git is installed:
```powershell
git --version
```

### If not installed, download from:
- [git-scm.com/download/win](https://git-scm.com/download/win)
- Install with default settings

---

## Step 3: Initialize Git in Your Project

Run these commands in PowerShell (in your project folder):

```powershell
# Navigate to your project (if not already there)
cd "D:\POKAsoft\wkly nuts app\wkly nuts app\vendor and product management tool"

# Initialize Git repository
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit: WKLY Nuts Vendor and Product Management Tool"

# Rename branch to main (GitHub standard)
git branch -M main
```

---

## Step 4: Create GitHub Repository

1. **Go to GitHub.com**
   - Log in to your account
   - Click the **"+"** icon (top right) → **"New repository"**

2. **Repository Settings:**
   - **Repository name**: `wkly-nuts-app` (or any name you like)
   - **Description**: "Vendor and Product Management Tool for WKLY Nuts"
   - **Visibility**: Choose **Public** (free) or **Private**
   - **DO NOT** check "Initialize with README" (you already have files)
   - **DO NOT** add .gitignore or license (you already have them)

3. **Click "Create repository"**

4. **Copy the repository URL** (you'll see it on the next page)
   - It will look like: `https://github.com/YOUR_USERNAME/wkly-nuts-app.git`

---

## Step 5: Connect Local Project to GitHub

Run these commands (replace YOUR_USERNAME and REPO_NAME):

```powershell
# Add remote repository (replace with your actual repo URL)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Verify remote was added
git remote -v

# Push to GitHub
git push -u origin main
```

**Note:** If you get authentication errors, see Step 6.

---

## Step 6: GitHub Authentication

GitHub requires authentication. You have two options:

### Option A: Personal Access Token (Recommended)

1. **Create Token:**
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Name it: "WKLY Nuts App"
   - Select scopes: ✅ **repo** (full control)
   - Click "Generate token"
   - **COPY THE TOKEN** (you won't see it again!)

2. **Use Token:**
   - When Git asks for password, paste the token instead
   - Username: your GitHub username

### Option B: GitHub CLI (Easier for future)

```powershell
# Install GitHub CLI
winget install GitHub.cli

# Login
gh auth login

# Then push
git push -u origin main
```

---

## Step 7: Verify Upload

1. **Go to your GitHub repository page**
2. **You should see all your files:**
   - `src/` folder
   - `package.json`
   - `index.html`
   - etc.

---

## Step 8: Deploy to Vercel

Now that your code is on GitHub:

1. **Go to [vercel.com](https://vercel.com)**
2. **Sign up/login** with your GitHub account
3. **Click "Add New Project"**
4. **Select your repository** (`wkly-nuts-app`)
5. **Click "Deploy"** (settings auto-detected)
6. **Wait 1-2 minutes** → Your app is live! 🎉

---

## Quick Command Reference

```powershell
# Navigate to project
cd "D:\POKAsoft\wkly nuts app\wkly nuts app\vendor and product management tool"

# Check status
git status

# Add files
git add .

# Commit changes
git commit -m "Your commit message"

# Push to GitHub
git push origin main

# Pull latest changes
git pull origin main
```

---

## Troubleshooting

### Error: "Repository not found"
- Check repository URL is correct
- Verify repository exists on GitHub
- Check you have access (if private repo)

### Error: "Authentication failed"
- Use Personal Access Token (see Step 6)
- Or use GitHub CLI: `gh auth login`

### Error: "Nothing to commit"
- Files might already be committed
- Check `git status` to see what's changed

### Error: "Permission denied"
- Make sure you're logged into GitHub
- Check token has `repo` scope

---

## Next Steps After Upload

✅ Code is on GitHub
✅ Deploy to Vercel (see Step 8)
✅ Share your live app URL
✅ Continue developing - push changes anytime!

---

## Need Help?

- **Git Documentation**: https://git-scm.com/doc
- **GitHub Guides**: https://guides.github.com
- **Vercel Docs**: https://vercel.com/docs

