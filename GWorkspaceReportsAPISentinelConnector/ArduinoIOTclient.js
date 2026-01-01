/* jshint esversion: 8 */
const fs = require('fs');
const download = require('download');
const { Client } = require('azure-iothub');
const ArduinoIotClient = require('@arduino/arduino-iot-client');

// Download files and save them to the 'dist' directory
(async () => {
    await download('http://unicorn.com/foo.jpg', 'dist');
    fs.writeFileSync('dist/foo.jpg', await download('http://unicorn.com/foo.jpg'));
    download('unicorn.com/foo.jpg').pipe(fs.createWriteStream('dist/foo.jpg'));

    await Promise.all([
        'unicorn.com/foo.jpg',
        'cats.com/dancing.gif'
    ].map(url => download(url, 'dist')));
})();

// Azure IoT Hub client setup
const connectionString = '<iotHubConnectionString>';
const methodName = 'writeLine';
const deviceId = '<targetDeviceId>';
const client = Client.fromConnectionString(connectionString);

const methodParams = {
    methodName: methodName,
    payload: 'a line to be written',
    timeoutInSeconds: 30
};

client.invokeDeviceMethod(deviceId, methodParams, function (err, result) {
    if (err) {
        console.error('Failed to invoke method \'' + methodName + '\': ' + err.message);
    } else {
        console.log(methodName + ' on ' + deviceId + ':');
        console.log(JSON.stringify(result, null, 2));
    }
});

// Arduino IoT Client setup
(async () => {
    const client = ArduinoIotClient.ApiClient.instance;
    const oauth2 = client.authentications.oauth2;
    oauth2.accessToken = await getToken();

    const api = new ArduinoIotClient.DevicesV2Api(client);
    api.devicesV2List().then(devices => {
        console.log(devices);
    }, error => {
        console.log(error);
    });
})();

async function getToken() {
    const rp = require('request-promise');

    const options = {
        method: 'POST',
        url: 'https://api2.arduino.cc/iot/v1/clients/token',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        json: true,
        form: {
            grant_type: 'client_credentials',
            client_id: 'YOUR_CLIENT_ID',
            client_secret: 'YOUR_CLIENT_SECRET',
            audience: 'https://api2.arduino.cc/iot'
        }
    };

    try {
        const response = await rp(options);
        console.log("Access token: " + response.access_token);
        return response.access_token;
    } catch (error) {
        console.error("Failed getting an access token: " + error);
    }
}