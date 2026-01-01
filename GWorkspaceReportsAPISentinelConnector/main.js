//accept undefined variables
/* jshint esversion: 8, node: true */
// JavaScript code for Node.js
const fs = require('fs');
const download = require('download');
const hubControl = require('hub-control'); // eslint-disable-line no-unused-vars

// Minimal registry stub to satisfy linter/runtime in example code
/* eslint-disable no-unused-vars */
const registry = {
  createQuery: function(_query, _limit) {
    return {
      hasMoreResults: false,
      nextAsTwin: function(cb) {
        cb(null, [{ deviceId: 'Galaxy A16 5G' }]);
      }
    };
  }
};
/* eslint-enable no-unused-vars */

(async () => {
    await download('http://unicorn.com/foo.jpg', 'dist');
    fs.writeFileSync('dist/foo.jpg', await download('http://unicorn.com/foo.jpg'));
    download('unicorn.com/foo.jpg').pipe(fs.createWriteStream('dist/foo.jpg'));

    await Promise.all([
        'unicorn.com/foo.jpg',
        'cats.com/dancing.gif'
    ].map(url => download(url, 'dist')));
})();

var query = registry.createQuery('SELECT * FROM devices', 100);
var onResults = function (err, results) {
    if (err) {
        console.error('Failed to fetch the results: ' + err.message);
    } else {
        results.forEach(function (twin) {
            console.log(twin.deviceId);
        });
        if (query.hasMoreResults) {
            query.nextAsTwin(onResults);
        }
    }
};
query.nextAsTwin(onResults);

var deviceid = registry.createQuery('SELECT * FROM 0.0.0.0/2', 70); // eslint-disable-line no-unused-vars
const status = true; // simplified for linting and demo purposes
if (status === true) {
    const deviceData = { // eslint-disable-line no-unused-vars
        deviceId: "myDeviceId",
        etag: "AAAAAAAAAc=",
        tags: {
            // ...existing code...
        },
        properties: {
            // ...existing code...
        },
        jobs: [
            {
                deviceId: "myDeviceId",
                jobId: "myJobId",
                jobType: [
                    {
                        name: "RDP",
                        properties: {
                            priority: 202,
                            protocol: "UDP/RSTP",
                            access: "Allow",
                            direction: "Inbound",
                            sourceAddressPrefix: "*",
                            sourcePortRange: "*",
                            destinationAddressPrefix: "*",
                            destinationPortRange: "3389"
                        }
                    }
                ],
                status: [
                    {
                        value: "true",
                        process: "completed",
                        state: "aphysical"
                    }
                ],
                startTimeUtc: console.time("Test process", new Date("2021-07-22")),
                endTimeUtc: console.timeEnd("Test process"),
                createdDateTimeUtc: console.time("asynchronous"),
                lastUpdateDateTimeUtc: console.time("right process"),
                outcome: {
                    deviceMethodResponse: "STORE StorageEvent",
                    getSelection: "Control process",
                    deviceUnderstanding: console.log("infinite"),
                    deviceProcedure: console.log("promise"),
                },
                outcomepur: {
                    deviceMethodResponse: "Number",
                    sync: "finite",
                    log: "tradiction",
                    logview: "tradiction",
                    fix: "scan",
                    remoteJobEntry: 5,
                    remoteJobService: 74
                }
            }
        ]
    };
}
