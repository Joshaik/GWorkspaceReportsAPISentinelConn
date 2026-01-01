# Code Citations

This file gathers short, attributed code examples used as references. Each snippet includes a source link and the license under which it was published. The file was moved from `__pycache__/# Code Citations*.md` and normalized for readability and correctness.

---

## License: MIT — download library

Source: https://github.com/kevva/download

```javascript
// Download files and save to local directory (handled errors)
const download = require('download');
const fs = require('fs');

async function downloadFiles() {
  try {
    // Single file download into folder
    await download('http://unicorn.com/foo.jpg', 'dist');

    // Alternative: Write directly to file
    const data = await download('http://unicorn.com/foo.jpg');
    fs.writeFileSync('dist/foo.jpg', data);

    // Pipe stream to file
    download('http://unicorn.com/foo.jpg').pipe(fs.createWriteStream('dist/foo.jpg'));
  } catch (err) {
    console.error('Download failed:', err);
  }
}

downloadFiles().catch(err => console.error('Unhandled download error:', err));
```

---

## License: MIT — Azure IoT Hub C2D Methods

Source: https://github.com/Azure-Samples/azure-iot-samples-node

```javascript
// Invoke direct methods on IoT devices
const Client = require('azure-iothub').Client;

const methodParams = {
  methodName: 'setTelemetryInterval',
  payload: 10,
  timeoutInSeconds: 30
};

function invokeDeviceMethod(deviceId, methodParams) {
  const client = Client.fromConnectionString(connectionString);

  client.invokeDeviceMethod(deviceId, methodParams, function (err, result) {
    if (err) {
      console.error(`Failed to invoke method '${methodParams.methodName}':`, err.message || err);
      return;
    }
    console.log(`${methodParams.methodName} on ${deviceId}:`);
    console.log(JSON.stringify(result, null, 2));
  });
}
```

---

## License: MIT — Azure IoT Hub Node Direct Methods

Source: https://github.com/Azure-Samples/azure-iot-samples-node/blob/master/iot-hub/Quickstarts/simulated-device.js

```javascript
// Direct method implementation on device side
const Client = require('azure-iot-device').Client;
const Protocol = require('azure-iot-device-mqtt').Mqtt;

const client = Client.fromConnectionString(deviceConnectionString, Protocol);

client.onDeviceMethod('setTelemetryInterval', (request, response) => {
  console.log('Executing setTelemetryInterval with payload:');
  console.log(JSON.stringify(request.payload, null, 2));

  if (request.payload && typeof request.payload === 'number') {
    telemetryInterval = request.payload;
    response.send(200, 'Telemetry interval updated', function (err) {
      if (err) console.error('Failed to send method response:', err);
    });
  } else {
    response.send(400, 'Invalid payload', function (err) {
      if (err) console.error('Failed to send method response:', err);
    });
  }
});
```

---

## License: GPL-3.0 — Google Analytics Tracking

Source: https://github.com/blynn/gitmagic

> Note: This snippet is licensed GPL-3.0 — ensure compatibility and attribution if reusing.

```javascript
// Google Tag Manager (GTM) initialization script
function loadGTM(i, s, o, g, r, a, m) {
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

// Initialize GTM on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    loadGTM(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');
    ga('create', 'UA-146796841-2', 'auto');
    ga('create', 'UA-159453639-1', 'auto', { name: 'Comviva' });
  });
}
```

---

## License: MIT — Data Structures Reference

Source: https://github.com/sturmer/sturmer.github.io

```javascript
// Common data structures implementation
class DataStructures {
  // Queue implementation
  constructor() {
    this.queue = [];
  }

  enqueue(element) {
    this.queue.push(element);
  }

  dequeue() {
    if (this.queue.length === 0) return null;
    return this.queue.shift();
  }

  peek() {
    return this.queue[0] || null;
  }

  isEmpty() {
    return this.queue.length === 0;
  }

  print() {
    console.log(this.queue.toString());
  }
}

const myQueue = new DataStructures();
myQueue.enqueue(1);
myQueue.enqueue(2);
myQueue.dequeue();
```

---

## Changes made
- Moved and normalized this content from `__pycache__/# Code Citations*.md` into `docs/CODE_CITATIONS.md`.
- Ensured each fenced code block specifies `javascript` as the language (fixes MD040).
- Made headings unique and descriptive (fixes MD024).
- Added basic error handling and improved logging where applicable.
- Standardized formatting and added explicit source links and license notes.

---

*If you'd like these citations split into per-license files, or to add an SPDX header for each snippet, tell me which option you prefer.*