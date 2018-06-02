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

const weekday = new Array(7);
weekday[0] = "domingo";
weekday[1] = "lunes";
weekday[2] = "martes";
weekday[3] = "miercoles";
weekday[4] = "jueves";
weekday[5] = "viernes";
weekday[6] = "sabado";


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
    if (
        !config.dispositivos.hasOwnProperty(macAddress)
        || !isInWorkInterval(macAddress, req.body.data.currentTime)
    ) {
        return;
    }

    if (devices.hasOwnProperty(macAddress)) {
        devices[macAddress].unshift(data);
        if (devices[macAddress].length > config.datosPorDispositivo) {
            devices[macAddress].pop();
            req.body.data.isMoving = 
                isMoving(devices[macAddress], 'x') 
                || isMoving(devices[macAddress], 'y') 
                || isMoving(devices[macAddress], 'z');
        }
    } else {
        devices[macAddress] = [data];
    }

    req.body.data.alias = config.dispositivos[macAddress].alias;

    io.emit('accelData', req.body);
});

function isInWorkInterval(macAddress) {
    const currentTimeObject = new Date();

    let valido = false;

    if (config.dispositivos[macAddress].cronograma.hasOwnProperty(weekday[currentTimeObject.getDay()])) {
        config.dispositivos[macAddress].cronograma[weekday[currentTimeObject.getDay()]].forEach((horas) => {
            const currentTime = [
                addZeroPadding(currentTimeObject.getHours()), 
                addZeroPadding(currentTimeObject.getMinutes())
            ].join('');

            const configuredStart = horas.inicio.split(':').join('');
            const configuredEnd = horas.fin.split(':').join('');

            if (configuredStart <= currentTime && currentTime <= configuredEnd) {
                valido = true;
                return;
            }
        });
    }

    return valido;
}

function addZeroPadding(value) {
    return ('0' + value).substr(-2);
}

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