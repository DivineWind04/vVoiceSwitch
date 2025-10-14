# 🚀 vIVSR Web App - Production Deployment Checklist

## ✅ Pre-Deployment Setup

### 1. Install Additional Dependencies
```bash
npm install --save-dev @svgr/webpack
```

### 2. Verify Audio Files
Ensure these files exist in `/public/`:
- ✅ `Ringback.wav`
- ✅ `GGChime.mp3` 
- ✅ `Override.mp3`
- ✅ `Override_Term.wav`
- ✅ `RDVS_Chime.m4a`

### 3. Verify Position Data
- ✅ `/public/zoa_position.json` exists
- ✅ Position objects have `ui` or `panelType` fields

### 4. Test Local Build
```bash
npm run build
npm run start
```

## 🌐 Deployment Options

### Option A: Vercel (Recommended)
1. Push to GitHub repository
2. Connect to Vercel
3. Deploy automatically
4. Custom domain: `your-domain.com`

### Option B: Netlify
1. Run `npm run build`
2. Drag `.next` folder to Netlify
3. Configure as SPA

### Option C: Self-Hosted Server
1. Run deployment script: `./deploy.bat` (Windows) or `./deploy.sh` (Linux/Mac)
2. Configure reverse proxy (nginx/Apache)
3. SSL certificate setup

## 📋 User Instructions

### For End Users:
1. **Start AFV Service**: Ensure AFV is running on `ws://localhost:9002`
2. **Open Browser**: Navigate to your deployed URL
3. **Enable Audio**: Allow audio permissions when prompted
4. **Select Position**: Use settings menu to choose facility position
5. **Automatic UI Switch**: Interface changes based on position type

### Direct UI Access:
- **VSCS**: `https://yourapp.com/vscs`
- **ETVS**: `https://yourapp.com/etvs` 
- **STVS**: `https://yourapp.com/stvs`
- **IVSR**: `https://yourapp.com/ivsr`
- **RDVS**: `https://yourapp.com/rdvs`

## 🔧 Technical Requirements

### Server Requirements:
- Node.js 18+
- 1GB RAM minimum
- 2GB disk space

### Client Requirements:
- Modern browser (Chrome 80+, Firefox 74+, Safari 13+, Edge 80+)
- Local AFV service on port 9002
- Audio permissions enabled

## 🎯 Features Enabled

✅ **Position-Based UI Selection**: Select facility position → automatic UI switch
✅ **Dynamic Audio System**: Different sounds per UI type  
✅ **URL-Based Navigation**: Direct links to specific UIs
✅ **Real-time WebSocket**: Live connection to AFV service
✅ **Responsive Design**: Works on different screen sizes
✅ **Production Optimized**: Compressed assets, caching headers

## 🔍 Testing Checklist

- [ ] Build completes without errors
- [ ] All UI types render correctly
- [ ] Position selection switches UI and audio
- [ ] WebSocket connects to AFV service
- [ ] Audio files play correctly
- [ ] URL navigation works for all UIs
- [ ] Settings modal functions properly

## 📞 Support

For deployment issues:
1. Check browser console for errors
2. Verify AFV service is running
3. Confirm audio files are accessible
4. Test WebSocket connection manually

Your vIVSR web application is now ready for production deployment! 🎉