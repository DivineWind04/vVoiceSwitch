# vIVSR Web Application

## 🚀 Deployment Guide

### Local Development
```bash
npm run dev
# or
yarn dev
```
Open [http://localhost:3001](http://localhost:3001)

### Production Build
```bash
npm run build
npm run start
# or
yarn build
yarn start
```

### Environment Setup
1. Ensure AFV service is running on `ws://localhost:9002`
2. Place position data in `/public/zoa_position.json`
3. Ensure audio files are in `/public/` directory

## 🌐 Deployment Options

### Option 1: Vercel (Recommended)
1. Push code to GitHub
2. Connect repository to Vercel
3. Deploy automatically

### Option 2: Netlify
1. Build locally: `npm run build`
2. Upload `out` folder to Netlify
3. Configure as SPA

### Option 3: Self-hosted
1. Build: `npm run build`
2. Run: `npm run start`
3. Use nginx/Apache as reverse proxy

## 🎯 User Access

After deployment, users can:
- **Main App**: `https://yourapp.com`
- **VSCS Interface**: `https://yourapp.com/vscs`
- **ETVS Interface**: `https://yourapp.com/etvs`
- **STVS Interface**: `https://yourapp.com/stvs`
- **IVSR Interface**: `https://yourapp.com/ivsr`
- **RDVS Interface**: `https://yourapp.com/rdvs`

## 🔧 Requirements

**User Setup:**
1. AFV service running locally (port 9002)
2. Modern web browser (Chrome, Firefox, Edge)
3. Audio permissions enabled

**Browser Compatibility:**
- Chrome 80+
- Firefox 74+
- Safari 13+
- Edge 80+