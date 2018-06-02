const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const path = require('path');
const os = require('os');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

app.use(bodyParser.json())

app.use(express.static(path.join(__dirname, '/public')));

const devices = {};

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

app.post('/accel', function(req, res) {
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

    req.body.data.currentTime = Date.now();

    /**
     * Si el dispositivo no fue suscripto entonces se ignora.
     */
    if (!config.devices.hasOwnProperty(macAddress)) {
        return
    }

    if (devices.hasOwnProperty(macAddress)) {
        devices[macAddress].unshift(data);
        if (devices[macAddress].length > config.dataStoredPerDevice) {
            devices[macAddress].pop();
            req.body.data.isMoving = 
                isMoving(devices[macAddress], 'x') || isMoving(devices[macAddress], 'y') ||isMoving(devices[macAddress], 'z');
        }
    } else {
        devices[macAddress] = [data];
    }

    io.emit('accelData', req.body);
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