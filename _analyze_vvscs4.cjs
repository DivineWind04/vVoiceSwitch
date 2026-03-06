const fs = require('fs');
const path = '\\\\wsl.localhost\\Ubuntu\\tmp\\vvscs-extracted\\dist\\assets\\index-Br6TnVzZ.js';
const code = fs.readFileSync(path, 'utf8');
const out = [];

// Look at cloud-auth-login
const authMatch = [...code.matchAll(/.{0,100}cloud-auth-login.{0,200}/g)].map(m => m[0]);
out.push('=== cloud-auth-login ===');
authMatch.forEach((m, i) => out.push(i + ': ' + m));

// Look further at shout-active handler
const shoutActive = [...code.matchAll(/.{0,100}shout-active.{0,300}/g)].map(m => m[0]);
out.push('\n=== shout-active ===');
shoutActive.forEach((m, i) => out.push(i + ': ' + m));

// What does the facility roster contain?
const rosterData = [...code.matchAll(/.{0,50}roster.{0,150}/g)].map(m => m[0]);
const rosterFiltered = rosterData.filter(m => m.includes('socket') || m.includes('position') || m.includes('facility'));
out.push('\n=== roster content ===');
rosterFiltered.slice(0, 15).forEach((m, i) => out.push(i + ': ' + m));

// Look at how websocket-peer-disconnected is handled
const peerDisc = [...code.matchAll(/.{0,100}webrtc-peer-disconnected.{0,200}/g)].map(m => m[0]);
out.push('\n=== webrtc-peer-disconnected ===');
peerDisc.forEach((m, i) => out.push(i + ': ' + m));

// Search for "Js" function which is the socket.io connect call
const jsFunc = [...code.matchAll(/Js\(.{0,200}/g)].map(m => m[0]);
out.push('\n=== socket.io connect call (Js) ===');
jsFunc.slice(0, 5).forEach((m, i) => out.push(i + ': ' + m));

// Search for auth header / token auth in socket connection
const authHeader = [...code.matchAll(/.{0,100}(?:auth|token|credential|password).{0,100}/g)].map(m => m[0]);
const socketAuth = authHeader.filter(m => m.includes('socket') || m.includes('io') || m.includes('connect'));
out.push('\n=== auth near socket/connect ===');
socketAuth.slice(0, 15).forEach((m, i) => out.push(i + ': ' + m));

console.log(out.join('\n'));
