const AWS = require("aws-sdk");

AWS.config.update({
  region: "us-west-2",
  endpoint: "http://localhost:8000"
});

const dynamodb = new AWS.DynamoDB();

const params = {
    TableName : "Devices",
    KeySchema: [
        { AttributeName: "serial", KeyType: "HASH"},   // Partition key
        { AttributeName: "ultimaTransmision", KeyType: "RANGE" } // Sort key
    ],
    AttributeDefinitions: [
        { AttributeName: "serial", AttributeType: "S" },
        { AttributeName: "ultimaTransmision", AttributeType: "N" }
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
    }
};

dynamodb.createTable(params, function(err, data) {
    if (err) {
        console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
    } else {
        console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
    }
});