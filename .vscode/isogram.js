/* jshint esversion: 8 */
const crypto = require('crypto');
const https = require('https');

function loadGTM(i,s,o,g,r,a,m) {
  i.GoogleAnalyticsObject = r;
  i[r] = i[r] || function() {
    (i[r].q = i[r].q || []).push(arguments);
  };
  i[r].l = 1 * new Date();
  a = s.createElement(o);
  m = s.getElementsByTagName(o)[0];
  a.async = 1;
  a.src = g;
  m.parentNode.insertBefore(a, m);
}
  window.addEventListener('load', () => {
    loadGTM(window,document,'script','/assets/analytics.js','ga');
    ga('create', 'UA-146796841-2', 'auto'); 
    ga('create', 'UA-159453639-1', 'auto', {'name': 'Comviva'} );
  });

// Function to send data to Azure Sentinel (Log Analytics Data Collector API)
async function sendToSentinel(data, opts = {}) {
  const workspaceId = opts.workspaceId || process.env.LOG_WORKSPACE_ID || "YOUR_WORKSPACE_ID";
  const sharedKey = opts.sharedKey || process.env.LOG_SHARED_KEY || "YOUR_SHARED_KEY";
  const logType = opts.logType || "CustomLog";
  const apiVersion = '2016-04-01';

  if (!workspaceId || !sharedKey || workspaceId === "YOUR_WORKSPACE_ID" || sharedKey === "YOUR_SHARED_KEY") {
    throw new Error('Missing workspaceId or sharedKey for Log Analytics - provide via opts or env variables.');
  }

  const body = typeof data === 'string' ? data : JSON.stringify(data);
  const contentType = 'application/json';
  const rfc1123date = new Date().toUTCString();
  const contentLength = Buffer.byteLength(body, 'utf8');
  const method = 'POST';
  const resource = '/api/logs';
  const stringToSign = `${method}\n${contentLength}\n${contentType}\nx-ms-date:${rfc1123date}\n${resource}`;

  // SharedKey is base64; decode for HMAC key
  const decodedKey = Buffer.from(sharedKey, 'base64');
  const hmac = crypto.createHmac('sha256', decodedKey);
  hmac.update(stringToSign, 'utf8');
  const signature = hmac.digest('base64');
  const authorization = `SharedKey ${workspaceId}:${signature}`;

  const hostname = `${workspaceId}.ods.opinsights.azure.com`;
  const path = `${resource}?api-version=${apiVersion}`;

  const requestOptions = {
    hostname,
    port: 443,
    path,
    method,
    headers: {
      'Content-Type': contentType,
      'Content-Length': contentLength,
      'Authorization': authorization,
      'Log-Type': logType,
      'x-ms-date': rfc1123date
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body });
        } else {
          const err = new Error(`Log Analytics responded ${res.statusCode}: ${body}`);
          err.statusCode = res.statusCode;
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}