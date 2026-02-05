# vIVSR - Air Traffic Control Interface

A web-based aviation interface supporting multiple UI types (VSCS, ETVS, STVS, IVSR, RDVS) with position-based automatic switching and dynamic audio systems.

## 🌐 Live Demo
- **Main Interface**: https://v-voice-switch.vercel.app/


## ✈️ Features
- **Position-Based UI Selection**: Automatic interface switching based on facility position
- **Dynamic Audio System**: UI-specific audio files (ringback, chimes, overrides)
- **Real-time WebSocket**: Live connection to local AFV service
- **Multiple Interface Types**: VSCS, ETVS, STVS, IVSR, RDVS support
- **Responsive Design**: Works on desktop and mobile devices

## 🔧 Requirements
- **Local AFV Service**: Must be running on `ws://localhost:9002`
- **Modern Browser**: Chrome 80+, Firefox 74+, Safari 13+, Edge 80+
- **Audio Permissions**: Enable audio playback in browser

## 🚀 Quick Start
1. Visit the web application URL
2. Ensure AFV service is running locally (port 9002)
3. Allow audio permissions when prompted
4. Select your facility position in settings
5. Interface automatically switches to correct UI type

## 📋 UI Types
- **VSCS**: Voice Switching Control System
- **ETVS**: Enhanced Terminal Voice Switch
- **STVS**: Standard Terminal Voice Switch  
- **IVSR**: Integrated Voice Switch Radio
- **RDVS**: Remote Digital Voice Switch

## 🔊 Audio Configuration
Each UI type uses specific audio files:
- **VSCS/RDVS**: `Ringback.wav`, `GGChime.mp3`, `Override.mp3`
- **ETVS/STVS/IVSR**: `Override_Term.wav`, `RDVS_Chime.m4a`

## 🛠️ Development
```bash
npm install
npm run dev
```

## 📦 Production Build
```bash
npm run build
npm run start
```

Built with Next.js, TypeScript, and Zustand for state management.

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.
