const fs = require('fs');
const path = '\\\\wsl.localhost\\Ubuntu\\tmp\\vvscs-extracted\\dist\\assets\\index-Br6TnVzZ.js';
const code = fs.readFileSync(path, 'utf8');
const out = [];

// Look at register emit context  
const regMatch = [...code.matchAll(/.{0,200}emit\(["']register["'].{0,300}/g)].map(m => m[0]);
out.push('=== register emit context ===');
regMatch.forEach((m, i) => out.push(i + ': ' + m));

// Look at 'registered' event handler
const regdMatch = [...code.matchAll(/.{0,100}["']registered["'].{0,300}/g)].map(m => m[0]);
out.push('\n=== registered event context ===');
regdMatch.forEach((m, i) => out.push(i + ': ' + m));

// Look at facility-roster event  
const rosterMatch = [...code.matchAll(/.{0,100}["']facility-roster["'].{0,300}/g)].map(m => m[0]);
out.push('\n=== facility-roster event context ===');
rosterMatch.forEach((m, i) => out.push(i + ': ' + m));

// Look at how webrtc-offer is emitted
const offerEmit = [...code.matchAll(/.{0,150}emit\(["']webrtc-offer["'].{0,200}/g)].map(m => m[0]);
out.push('\n=== webrtc-offer emit context ===');
offerEmit.forEach((m, i) => out.push(i + ': ' + m));

// Look at how webrtc-offer is received  
const offerRcv = [...code.matchAll(/.{0,100}["']webrtc-offer["'].{0,300}/g)].map(m => m[0]);
out.push('\n=== webrtc-offer receive context ===');
offerRcv.forEach((m, i) => out.push(i + ': ' + m));

// Look for open-override emit
const overrideEmit = [...code.matchAll(/.{0,100}emit\(["']open-override["'].{0,300}/g)].map(m => m[0]);
out.push('\n=== open-override emit context ===');
overrideEmit.forEach((m, i) => out.push(i + ': ' + m));

// Look for activate-shout / join-shout  
const shoutEmit = [...code.matchAll(/.{0,100}emit\(["'](?:activate|join|leave)-shout["'].{0,300}/g)].map(m => m[0]);
out.push('\n=== shout emit context ===');
shoutEmit.forEach((m, i) => out.push(i + ': ' + m));

// Look for "dg" function which seems to be the Socket.IO connection setup
const dgMatch = [...code.matchAll(/.{0,50}function dg.{0,500}/g)].map(m => m[0]);
out.push('\n=== dg function (socket.io setup) ===');
dgMatch.forEach((m, i) => out.push(i + ': ' + m));

// Look for position/facilityId/callsign references near socket context
const posMatch = [...code.matchAll(/.{0,80}(?:facilityId|position|callsign).{0,80}/g)].map(m => m[0]);
const posNearSocket = posMatch.filter(m => m.includes('socket') || m.includes('emit') || m.includes('register'));
out.push('\n=== position/facility near socket context ===');
posNearSocket.slice(0, 20).forEach((m, i) => out.push(i + ': ' + m));

console.log(out.join('\n'));
