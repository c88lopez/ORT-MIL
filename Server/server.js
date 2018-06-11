const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const path = require('path');
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
        config.suscripcionDispositivos
        && (
            !config.dispositivos.hasOwnProperty(macAddress)
            || !isInWorkInterval(macAddress, req.body.data.currentTime)
        )
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

    let alias = 'Unknown Device';
    if (config.dispositivos[macAddress]) {
        alias = config.dispositivos[macAddress].alias;
    }
    req.body.data.alias = alias;

    fs.appendFile(`${macAddress.split(':').join('_')}.csv`, `${req.body.data.currentTime},${req.body.data.analogRead}` + "\n", function (err) {
        if (err) throw err;
    });

    req.body.data.battery = getBatteryLevel(req.body.data.analogRead);

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

function getBatteryLevel(analogRead) {
    const max = 940
        , min = 700;

    let level = (analogRead - min) / (max - min) * 100;

console.log(analogRead);

    if (level > 100) {
        level = 100;
    } else if (level < 0) {
        level = 0;
    }

    return Number(level.toFixed(0));
;
}