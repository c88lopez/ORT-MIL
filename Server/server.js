const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const path = require('path');
const os = require('os');
// const fs = require('fs');

app.use(bodyParser.json())

app.use(express.static(path.join(__dirname, '/public')));

const interfaces = os.networkInterfaces();
const addresses = [];
for (var k in interfaces) {
    for (var k2 in interfaces[k]) {
        if (interfaces[k][k2].family === 'IPv4' && !interfaces[k][k2].internal) {
            addresses.push(interfaces[k][k2].address);
        }
    }
}

const devices = {};
const dataStoredPerDevice = 2;

server.listen(3000, process.argv[2], function() {
    console.log(
        "Server listening on %s:%s...", 
        server.address().address, 
        server.address().port
    );
});

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/location', function(req, res) {
    location = req.body
    io.emit('location', location);	
    console.log(req.body.city)
});

app.post('/accel', function(req, res) {
    const currentTime = Date.now();
    const macAddress = req.body.data.macAddress;

    const data = {
        accel: {
            x: req.body.data.accel.x,
            y: req.body.data.accel.y,
            z: req.body.data.accel.z,
        },
        gyro: {
            x: req.body.data.gyro.x,
            y: req.body.data.gyro.y,
            z: req.body.data.gyro.z,
        },
    }

    if (devices.hasOwnProperty(macAddress)) {
        devices[macAddress].unshift(data);
        if (devices[macAddress].length > dataStoredPerDevice) {
            devices[macAddress].pop();
            req.body.data.isMoving = 
            isMoving(devices[macAddress], 'x') || isMoving(devices[macAddress], 'y') ||isMoving(devices[macAddress], 'z');
        }
    } else {
        devices[macAddress] = [data];
    }

    io.emit('accelData', req.body);

    // fs.appendFileSync(`./${macAddress}.csv`, `${accelX},${accelY},${accelZ},${gyroX},${gyroY},${gyroZ}\n`)
});

io.on('connection', function (socket) {
    socket.on('location', function (data) {
        console.log(data);
    });

    //socket.on('accelData', function (data) {
        //console.log(data);
    //});
});

function isMoving(data, axis) {
    let accelMax;
    let accelMin;

    data.forEach(element => {
        if (typeof accelMax == 'undefined') {
            accelMax = accelMin = element.accel[axis]
        } else {
            if (element.accel[axis] > accelMax) {
                accelMax = element.accel[axis]
            }

            if (element.accel[axis] < accelMin) {
                accelMin = element.accel[axis]
            }
        }
    });

    return (accelMax - accelMin) > 1000
}