const AWS = require("aws-sdk");

const table = "Devices";

const AWSConfig = {};

module.exports = {
    init(newAWSConfig) {
        AWSConfig.region = newAWSConfig.region;
        AWSConfig.endpoint = newAWSConfig.endpoint;
    },

    putData(devices) {
        devices.forEach((device) => {
            AWS.config.update({
                region: AWSConfig.region,
                endpoint: AWSConfig.endpoint
            });

            const docClient = new AWS.DynamoDB.DocumentClient();

            docClient.put(
                {
                    TableName: table,
                    Item:{
                        serial: device.serial,
                        readTime: device.readTime,
                        data: {
                            alias: device.alias,
                            enMovimiento: device.enMovimiento,
                            tiempoQuieto: device.tiempoQuieto,
                            bateria: device.bateria,
                            lat: device.geoposicion.lat,
                            lon: device.geoposicion.lon,
                            precision: device.geoposicion.precision,
                            ssid: device.wifi.ssid,
                            intensidad: device.wifi.intensidad,
                        },
                    },
                }, 
                function(err, data) {
                    if (err) {
                        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
                    } else {
                        console.log("Added item:", JSON.stringify(data, null, 2));
                    }
                }
            );
        });
    }
}