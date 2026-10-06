// Adapted from everything-claude-code scripts/lib/utils.js @ ef648e01 (c) 2026 Affaan Mustafa, MIT. Modifications (c) 2026 the site factory studio, MIT.
// Subset: only the five exports suggest-compact.cjs imports (getTempDir, writeFile,
// readStdinJson, log, output) plus ensureDir, which writeFile needs. The upstream
// file requires agent-data-home and ~/.claude helpers that are not vendored.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function getTempDir() {
  return os.tmpdir();
}

function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    // EEXIST is fine (race condition with another process creating it)
    if (err.code !== 'EEXIST') {
      throw new Error(`Failed to create directory '${dirPath}': ${err.message}`);
    }
  }
  return dirPath;
}

async function readStdinJson(options = {}) {
  const { timeoutMs = 5000, maxSize = 1024 * 1024 } = options;

  return new Promise((resolve) => {
    let data = '';
    let settled = false;
    let overflowed = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        process.stdin.removeAllListeners('data');
        process.stdin.removeAllListeners('end');
        process.stdin.removeAllListeners('error');
        if (process.stdin.unref) process.stdin.unref();
        if (overflowed) {
          resolve({});
          return;
        }
        try {
          resolve(data.trim() ? JSON.parse(data) : {});
        } catch {
          resolve({});
        }
      }
    }, timeoutMs);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      if (settled) return;
      if (overflowed) return;
      if (data.length + chunk.length > maxSize) {
        overflowed = true;
        data = '';
        process.stderr.write(
          `[readStdinJson] stdin exceeded ${maxSize} bytes; input truncated and treated as empty\n`
        );
        return;
      }
      data += chunk;
    });

    process.stdin.on('end', () => {
      if (settled) {
        clearTimeout(timer);
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (overflowed) {
        resolve({});
        return;
      }
      try {
        resolve(data.trim() ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });

    process.stdin.on('error', () => {
      if (settled) {
        clearTimeout(timer);
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({});
    });
  });
}

function log(message) {
  console.error(message);
}

function output(data) {
  if (typeof data === 'object') {
    console.log(JSON.stringify(data));
  } else {
    console.log(data);
  }
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

module.exports = { getTempDir, ensureDir, readStdinJson, log, output, writeFile };
