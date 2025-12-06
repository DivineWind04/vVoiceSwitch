# 🌐 Public Hosting Setup Guide

## 🚀 Option 1: Vercel (Recommended - Free)

### Step 1: Create GitHub Repository
1. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial vIVSR commit"
   ```

2. **Create GitHub Repository**:
   - Go to [GitHub.com](https://github.com)
   - Click "New Repository"
   - Name: `vIVSR` or `aviation-interface`
   - Make it **Public** (for free Vercel hosting)
   - Don't initialize with README (we already have one)

3. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy to Vercel
1. **Go to [Vercel.com](https://vercel.com)**
2. **Sign up/Login** with GitHub account
3. **Import Project**:
   - Click "New Project"
   - Select your GitHub repository
   - Click "Import"

4. **Configure Deployment**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

5. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes for build
   - Get your live URL: `https://your-app.vercel.app`

### Step 3: Custom Domain (Optional)
1. **Buy domain** (Namecheap, GoDaddy, etc.)
2. **In Vercel Dashboard**:
   - Go to Project Settings → Domains
   - Add your custom domain
   - Follow DNS setup instructions

---

## 🌐 Option 2: Netlify (Alternative Free Option)

### Step 1: Build Static Export
1. **Update next.config.js** for static export:
   ```javascript
   const config = {
     output: 'export',
     trailingSlash: true,
     images: {
       unoptimized: true
     }
   };
   ```

2. **Build static files**:
   ```bash
   npm run build
   ```

### Step 2: Deploy to Netlify
1. **Go to [Netlify.com](https://netlify.com)**
2. **Sign up/Login**
3. **Drag & Drop Deployment**:
   - Drag the `.next` folder to Netlify
   - Or connect GitHub repository

4. **Configure Settings**:
   - Build command: `npm run build`
   - Publish directory: `.next`

---

## 🖥️ Option 3: DigitalOcean (Self-Hosted)

### Step 1: Create Droplet
1. **Create DigitalOcean account**
2. **Create new Droplet**:
   - Ubuntu 20.04+ LTS
   - Basic plan ($5/month)
   - Add your SSH key

### Step 2: Server Setup
```bash
# Connect to server
ssh root@your_server_ip

# Update system
apt update && apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install nginx
apt install nginx -y

# Install PM2 (process manager)
npm install -g pm2
```

### Step 3: Deploy Application
```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME

# Install dependencies
npm install

# Build application
npm run build

# Start with PM2
pm2 start npm --name "vIVSR" -- start
pm2 startup
pm2 save
```

### Step 4: Configure Nginx
```bash
# Create nginx config
nano /etc/nginx/sites-available/vIVSR
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/vIVSR /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Setup SSL with Let's Encrypt
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your_domain.com
```

---

## 🎯 Post-Deployment Checklist

### ✅ Test Your Deployment
1. **Visit your live URL**
2. **Test all UI routes**:
   - `/vscs`
   - `/etvs` 
   - `/stvs`
   - `/ivsr`
   - `/rdvs`

3. **Test functionality**:
   - Audio permissions work
   - Position selection switches UI
   - WebSocket connection (needs local AFV)

### ✅ Share with Users
**User Instructions:**
1. Visit: `https://your-app.vercel.app` (or your domain)
2. Start AFV service locally on port 9002
3. Allow audio permissions in browser
4. Select facility position in settings
5. Interface automatically switches

### ✅ Monitor & Maintain
- **Vercel**: Automatic deployments on git push
- **Netlify**: Automatic deployments on git push  
- **DigitalOcean**: Manual updates via git pull + PM2 restart

---

## 🆘 Troubleshooting

### Common Issues:
1. **Build Fails**: Check `npm run build` locally first
2. **Audio Not Working**: User needs to allow audio permissions
3. **WebSocket Fails**: AFV service must run locally on user's machine
4. **UI Not Switching**: Check position data has `ui` or `panelType` fields

### Support Resources:
- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Netlify Docs**: [docs.netlify.com](https://docs.netlify.com)
- **Next.js Deployment**: [nextjs.org/docs/deployment](https://nextjs.org/docs/deployment)

Choose **Vercel** for the easiest setup with automatic deployments! 🚀