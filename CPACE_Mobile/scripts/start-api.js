// Auto-starts the CPACE Mobile PHP backend (cpace-mobile-api) before Expo.
// Runs as the npm "prestart" hook: if the API already answers on port 8080
// it does nothing; otherwise it spawns the PHP built-in server detached in
// the background so it keeps running while you develop.

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 8080;
const PHP = 'C:\\xampp\\php\\php.exe';
const API_DIR = path.resolve(__dirname, '..', '..', 'cpace-mobile-api');

function ping() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api', timeout: 1500 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  if (await ping()) {
    console.log(`✓ CPACE Mobile API already running on port ${PORT}`);
    return;
  }

  if (!fs.existsSync(PHP)) {
    console.warn(`! PHP not found at ${PHP} — start the API manually (cpace-mobile-api\\start-api.bat)`);
    return;
  }
  if (!fs.existsSync(path.join(API_DIR, 'index.php'))) {
    console.warn(`! Backend not found at ${API_DIR} — start the API manually`);
    return;
  }

  const child = spawn(PHP, ['-S', `0.0.0.0:${PORT}`, 'index.php'], {
    cwd: API_DIR,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  // give it a moment, then confirm
  await new Promise((r) => setTimeout(r, 1200));
  if (await ping()) {
    console.log(`✓ CPACE Mobile API started on http://0.0.0.0:${PORT}/api`);
  } else {
    console.warn('! Could not confirm the API started — check MySQL is running in XAMPP');
  }
}

main();
