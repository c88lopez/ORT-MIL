const AWS = require("aws-sdk");

const table = "Devices";

const AWSConfig = {};

module.exports = {
    init(newAWSConfig) {
        console.log(newAWSConfig);

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
                        ultimaTransmision: device.ultimaTransmision,
                        data: {
                            alias: device.alias,
                            enMovimiento: device.enMovimiento,
                            tiempoQuieto: device.tiempoQuieto,
                            bateria: device.bateria,
                            geoposicion: {
                                lat: device.geoposicion.lat,
                                lon: device.geoposicion.lon,
                                precision: device.geoposicion.precision
                            },
                            wifi: {
                                ssid: device.wifi.ssid,
                                intensidad: device.wifi.intensidad,
                            },
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