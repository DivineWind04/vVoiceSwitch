const fs = require('fs');
const path = '\\\\wsl.localhost\\Ubuntu\\tmp\\vvscs-extracted\\dist\\assets\\index-Br6TnVzZ.js';
const code = fs.readFileSync(path, 'utf8');
const out = [];

// Search for atlcru context
const atlcru = [...code.matchAll(/.{0,150}atlcru.{0,150}/g)].map(m => m[0]);
out.push('=== atlcru.art context ===');
atlcru.forEach((m, i) => out.push(i + ': ' + m));

// Search for socket.io event names (emit/on patterns)
const emitMatches = [...code.matchAll(/\.emit\(["']([^"']+)["']/g)].map(m => m[1]);
out.push('\n=== socket.emit event names ===');
[...new Set(emitMatches)].forEach(e => out.push(e));

const onMatches = [...code.matchAll(/\.on\(["']([^"']+)["']/g)].map(m => m[1]);
out.push('\n=== socket.on event names ===');
[...new Set(onMatches)].forEach(e => out.push(e));

// RTCPeerConnection context wider
const rtc2 = [...code.matchAll(/.{0,200}RTCPeerConnection.{0,200}/g)].map(m => m[0]);
out.push('\n=== RTCPeerConnection wider context ===');
rtc2.forEach((m, i) => out.push(i + ': ' + m));

// Search for offer/answer/candidate patterns (WebRTC signaling)
const offerMatch = [...code.matchAll(/.{0,100}(?:createOffer|createAnswer|ice.candidate|addIceCandidate|setRemoteDescription|setLocalDescription).{0,100}/g)].map(m => m[0]);
out.push('\n=== WebRTC offer/answer/ICE context ===');
offerMatch.forEach((m, i) => out.push(i + ': ' + m));

// Look for call/invite/ring patterns
const callMatch = [...code.matchAll(/.{0,80}(?:call_invite|call_accept|call_end|incoming.?call|outgoing.?call|ring|chime).{0,80}/gi)].map(m => m[0]);
out.push('\n=== Call lifecycle patterns ===');
[...new Set(callMatch)].slice(0, 30).forEach((m, i) => out.push(i + ': ' + m));

// Look for lineId / remoteSocket references
const lineIdMatch = [...code.matchAll(/.{0,100}lineId.{0,100}/g)].map(m => m[0]);
out.push('\n=== lineId context ===');
lineIdMatch.slice(0, 20).forEach((m, i) => out.push(i + ': ' + m));

fs.writeFileSync('\\\\wsl.localhost\\Ubuntu\\tmp\\vvscs_analysis2.txt', out.join('\n'), 'utf8');
console.log(out.join('\n'));
