const fs = require('fs');
const path = '\\\\wsl.localhost\\Ubuntu\\tmp\\vvscs-extracted\\dist\\assets\\index-Br6TnVzZ.js';
const code = fs.readFileSync(path, 'utf8');
const out = [];

// Find WebSocket URLs
const wsUrls = [...code.matchAll(/wss?:\/\/[^"'`\s,;)}\]]+/g)].map(m => m[0]);
out.push('=== WebSocket URLs ===');
[...new Set(wsUrls)].forEach(u => out.push(u));

// Find STUN/TURN servers  
const stunUrls = [...code.matchAll(/(?:stun|turn)[:](?:\/\/)?[^"'`\s,;)}\]]+/g)].map(m => m[0]);
out.push('', '=== STUN/TURN URLs ===');
[...new Set(stunUrls)].forEach(u => out.push(u));

// Find http/https URLs that might be signaling/API endpoints (non-CDN)
const httpUrls = [...code.matchAll(/https?:\/\/[^"'`\s,;)}\]]+/g)].map(m => m[0]);
const filtered = [...new Set(httpUrls)].filter(u => !u.includes('cdn') && !u.includes('fonts.') && !u.includes('unpkg') && !u.includes('github'));
out.push('', '=== HTTP URLs (filtered) ===');
filtered.forEach(u => out.push(u));

// Find RTCPeerConnection usage context
const rtcMatches = [...code.matchAll(/.{0,80}RTCPeerConnection.{0,80}/g)].map(m => m[0]);
out.push('', '=== RTCPeerConnection contexts ===');
rtcMatches.forEach((m, i) => out.push(i + ': ' + m));

// Find WebSocket connection context
const wsMatches = [...code.matchAll(/.{0,60}new WebSocket.{0,100}/g)].map(m => m[0]);
out.push('', '=== new WebSocket contexts ===');
wsMatches.forEach((m, i) => out.push(i + ': ' + m));

// Find signaling references  
const sigMatches = [...code.matchAll(/.{0,60}(?:signaling|signalling).{0,60}/gi)].map(m => m[0]);
out.push('', '=== Signaling contexts ===');
sigMatches.slice(0, 20).forEach((m, i) => out.push(i + ': ' + m));

const outPath = '\\\\wsl.localhost\\Ubuntu\\tmp\\vvscs_analysis.txt';
fs.writeFileSync(outPath, out.join('\n'), 'utf8');
console.log('Analysis written to ' + outPath);
console.log(out.join('\n'));
