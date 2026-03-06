const { execSync } = require("child_process");
const fs = require("fs");
process.chdir("/home/domyn/vIVSR");

// Clean up stray files
try { fs.unlinkSync("src/app/api/vacs/auth/callback/page.tsx"); } catch {}
try { fs.rmSync("src/app/vacs", { recursive: true, force: true }); } catch {}

// Commit
console.log(execSync('git commit -m "feat: VACS WebRTC integration for G/G calls"', { encoding: "utf8" }));
