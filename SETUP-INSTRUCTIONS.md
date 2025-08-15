# 🚀 Sukejuru Calendar - Complete Setup Instructions

## Step 1: Create Supabase Project

1. **Visit** [supabase.com](https://supabase.com)
2. **Sign up** with GitHub (recommended) or email
3. **Create New Project**:
   - Project Name: `sukejuru-calendar`
   - Database Password: Generate strong password (save it!)
   - Region: Choose closest to your users
   - Wait for project to initialize (~2 minutes)

## Step 2: Set Up Database

1. **Go to SQL Editor** in your Supabase dashboard
2. **Copy and paste** the entire contents of `database-schema.sql`
3. **Click "Run"** to execute the SQL
4. **Verify** tables were created in Table Editor:
   - `profiles` - User profile information
   - `events` - Calendar events

## Step 3: Get Supabase Credentials

1. **Go to Settings > API** in Supabase dashboard
2. **Copy these values**:
   - Project URL (starts with `https://`)
   - `anon public` API key

## Step 4: Configure Your App

1. **Open** `public/supabase-auth.js`
2. **Replace** these lines at the top:
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL'
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'
   ```
   
   **With your actual values:**
   ```javascript
   const SUPABASE_URL = 'https://your-project-id.supabase.co'
   const SUPABASE_ANON_KEY = 'your-actual-anon-key'
   ```

## Step 5: Test Locally

1. **Start local server** (any of these):
   ```bash
   # Python 3
   python -m http.server 8000 --directory public
   
   # Python 2
   python -m SimpleHTTPServer 8000
   
   # Node.js (if you have it)
   npx serve public
   ```

2. **Open** http://localhost:8000
3. **Create test account** and verify it works
4. **Add some events** via chatbot or manually

## Step 6: Deploy to Vercel

### Option A: GitHub (Recommended)
1. **Push your code** to GitHub repository
2. **Go to** [vercel.com](https://vercel.com)
3. **Sign up** with GitHub
4. **Import** your repository
5. **Configure**:
   - Framework Preset: Other
   - Root Directory: `./`
   - Build Command: (leave empty)
   - Output Directory: `public`
6. **Deploy**

### Option B: Drag & Drop
1. **Go to** [vercel.com](https://vercel.com)
2. **Drag the `public` folder** onto the Vercel homepage
3. **Wait for deployment**

## Step 7: Set Custom Domain

1. **In Vercel dashboard**, go to your project
2. **Go to Settings > Domains**
3. **Add domain**: `sukejuru.vercel.app`
4. **Wait for DNS** to propagate (~5 minutes)

## ✅ Final Checklist

- [ ] Supabase project created
- [ ] Database schema executed
- [ ] Supabase credentials added to code
- [ ] Local testing successful
- [ ] Code pushed to GitHub
- [ ] Vercel deployment successful
- [ ] Domain `sukejuru.vercel.app` working

## 🎉 Your App is Live!

**Features:**
- ✅ User registration & authentication
- ✅ Personal calendar events saved to cloud
- ✅ AI chatbot for event creation
- ✅ Google Calendar export
- ✅ Real-time sync across devices
- ✅ Mobile responsive design

## 🔧 Troubleshooting

**Can't sign up?**
- Check Supabase credentials in `supabase-auth.js`
- Check browser console for errors

**Events not saving?**
- Verify database schema was executed
- Check Supabase Row Level Security policies

**Deployment issues?**
- Make sure `public` folder contains all files
- Check Vercel build logs

**Need help?** Check the browser console for error messages!

---
**🎯 You now have a professional calendar app running at sukejuru.vercel.app!**
