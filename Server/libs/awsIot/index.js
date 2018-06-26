const deviceModule = require('aws-iot-device-sdk').device;

module.exports = {
    deviceModule: null,
    topic: '',

    init(awsIotConfig) {
        this.deviceModule = deviceModule({
            keyPath: `./libs/awsIot/certs/${awsIotConfig.certFolder}/private.key`,
            certPath: `./libs/awsIot/certs/${awsIotConfig.certFolder}/cert.pem`,
            caPath: `./libs/awsIot/certs/${awsIotConfig.certFolder}/root-CA.crt`,
            host: awsIotConfig.endpoint,
        });

        this.topic = awsIotConfig.topic;

        this.deviceModule.subscribe(this.topic);
    },

    publishDevices(devices) {
        devices.forEach(device => {
            const parsedDevice = Object.assign({}, device);

            lastComunication = new Date(parsedDevice.readTime - 60 * 60 * 3 * 1000);

            // YYYYMMddhhmmss
            parsedDevice.readTime = lastComunication.getFullYear()
            + ('0' + (lastComunication.getMonth() + 1)).substr(-2)
            + ('0' + lastComunication.getDate()).substr(-2)
            + ('0' + lastComunication.getHours()).substr(-2)
            + ('0' + lastComunication.getMinutes()).substr(-2)
            + ('0' + lastComunication.getSeconds()).substr(-2);

            this.deviceModule.publish(this.topic, JSON.stringify(parsedDevice));
        });
    },
}
