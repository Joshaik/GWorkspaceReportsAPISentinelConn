# MIT — Code Citations

This file contains code snippets that are published under the MIT license. Each snippet includes a source link and an SPDX header.

---

## License: MIT — download library

Source: https://github.com/kevva/download

```javascript
// SPDX-License-Identifier: MIT
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
// SPDX-License-Identifier: MIT
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
// SPDX-License-Identifier: MIT
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

## License: MIT — Data Structures Reference

Source: https://github.com/sturmer/sturmer.github.io

```javascript
// SPDX-License-Identifier: MIT
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
