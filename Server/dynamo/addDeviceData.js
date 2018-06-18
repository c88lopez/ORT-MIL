var AWS = require("aws-sdk");

AWS.config.update({
  region: "us-west-2",
  endpoint: "http://localhost:8000"
});

var docClient = new AWS.DynamoDB.DocumentClient();

var table = "Devices";

var macAddress = 'a4:b3:f0:23:45';
var currentTime = 1528955284378;

var params = {
    TableName: table,
    Item:{
        macAddress: macAddress,
        currentTime: currentTime,
        data: {
            alias: 'Cristian',
            enMovimiento: true,
            bateria: 3,
            geoposicion: {
                lat: -34.565443,
                lon: -54.345673,
                precision: 30
            },
            wifi: {
                SSID: 'nombre AP / router',
                intensidad: -34,
            },
        },
    },
};

console.log("Adding a new item...");
docClient.put(params, function(err, data) {
    if (err) {
        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
        console.log("Added item:", JSON.stringify(data, null, 2));
    }
});
