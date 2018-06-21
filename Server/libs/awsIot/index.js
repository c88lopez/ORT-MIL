const deviceModule = require('aws-iot-device-sdk').device;

module.exports = {
    deviceModule: null,
    topic: 'ORT-MIL-SERVER',

    init() {
        this.deviceModule = deviceModule({
            keyPath: './libs/awsIot/certs/ORT-MIL-SERVER.private.key',
            certPath: './libs/awsIot/certs/ORT-MIL-SERVER.cert.pem',
            caPath: './libs/awsIot/certs/root-CA.crt',
            host: 'a1cq7pfnlzpa82.iot.us-east-1.amazonaws.com',
        });

        this.deviceModule.subscribe(this.topic);
    },

    publishDevices(devices) {
        devices.forEach(device => {
            this.deviceModule.publish(this.topic, JSON.stringify(device));
        });
    },
}
