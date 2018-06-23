const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const path = require('path');
const fs = require('fs');
const http = require('http');

const Timer = require('./libs/timer');

const config = require('./config');

const awsIot = require('./libs/awsIot');
awsIot.init(config.aws.iot);

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp(),
        printf(info => `[${info.timestamp}] - [${info.level}] - ${info.message}`)
    ),
    transports: [
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({}))
}

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

server.listen(3000, process.argv[2], function() {
    logger.log({
        level: 'info',
        message: `Server listening on ${server.address().address}:${server.address().port}...`
    });
});

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

const devicesAccel = {};
let devices = [];

app.post('/accel', function(req, res) {
    logger.log({
        level: 'info',
        message: 'received: ' + JSON.stringify(req.body.data)
    });

    // const macAddress = req.body.data.macAddress;
    const macAddress = "a4:b3:f0:23:45-1"; // @todo Hardcodeada para las pruebas

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

    if (devicesAccel.hasOwnProperty(macAddress)) {
        devicesAccel[macAddress].unshift(data);
        if (devicesAccel[macAddress].length > config.datosPorDispositivo) {
            devicesAccel[macAddress].pop();
            req.body.data.isMoving =
                isMoving(devicesAccel[macAddress], 'x')
                || isMoving(devicesAccel[macAddress], 'y')
                || isMoving(devicesAccel[macAddress], 'z');
        }
    } else {
        devicesAccel[macAddress] = [data];
    }

    let alias = 'Desconocido';
    if (config.dispositivos[macAddress]) {
        alias = config.dispositivos[macAddress].alias;
    }

    const now = Date.now();

    if (devices.length === 0 || !devices.some(d => d.serial === macAddress)) {
        devices.push(
            {
                serial: macAddress,
                alias: alias,
                readTime: now,
                enMovimiento: (req.body.data.isMoving) ? 1 : 0,
                tiempoQuieto: 0,
                cargarBateria: req.body.data.analogRead < 2500,
                lat: req.body.data.position.latitude,
                lon: req.body.data.position.longitude,
                precision: req.body.data.position.accuracy,
                SSID: req.body.data.SSID,
                intensidad: req.body.data.RSSI,
            }
        )
    } else {
        devices = devices.map((device) => {
            if (device.serial !== macAddress) {
                return device;
            }

            return {
                serial: device.serial,
                alias: alias,
                readTime: now,
                enMovimiento: (req.body.data.isMoving) ? 1 : 0,
                tiempoQuieto: device.tiempoQuieto,
                cargarBateria: req.body.data.analogRead < 2500,
                lat: req.body.data.position.latitude,
                lon: req.body.data.position.longitude,
                precision: req.body.data.position.accuracy,
                SSID: req.body.data.SSID,
                intensidad: req.body.data.RSSI,
            };
        });
    }
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

    return ((accelMax - accelMin) > config.sensibilidadDeteccionMovimiento) ? 1 : 0;
}

const publishDevices = () => {
    devices = devices.map((device) => {
        if ((Date.now()) - device.ultimaTransmision > config.tiempoSinTransmisionComoSinMovimiento * 1000) {
            device.enMovimiento = false;
        }

        device.tiempoQuieto = device.enMovimiento
            ? 0
            : (device.tiempoQuieto + config.pushTime / 1000);

        device.high    = config.sensors[0].high;
        device.highest = config.sensors[0].highest;
        device.low     = config.sensors[0].low;
        device.lowest  = config.sensors[0].lowest;

        return device;
    });

    logger.log({
        level: 'info',
        message: 'transmitting: ' + JSON.stringify(devices)
    });

    io.emit('accelData', devices);

    /**
     * Publish to AWS IoT
     */
    if (config.aws.iot.publish) {
        awsIot.publishDevices(devices);
    }
};

let publishTimer = null;

reconfigureTimer = new Timer(() => {
    const url = 'http://iotdev.expertaart.com.ar:8080/iot/raspy/getConfiguration/a4:b3:f0:23:45/879F22B9FBC5E50068212B54EC9F84C7C1C7F2295EDD70B24BF8C4706580B535';

    const responseJson = {
        pushTime: 1,
        reconfigureTime: 3600,
        sensors: [
            {
                delta: 0,
                high: 100,
                highest: 200,
                low: 0,
                lowest: 0,
                metric: "Segundos",
                nroSensor: 1,
                readTime: 5
            }
        ],
        serial: "a4:b3:f0:23:45"
    };

    config.sensors = responseJson.sensors;

    config.pushTime = responseJson.pushTime * 1000;
    if (publishTimer) {
        publishTimer.reset(config.pushTime);
    } else {
        publishTimer = new Timer(publishDevices, config.pushTime);
    }

    config.reconfigureTime = responseJson.reconfigureTime * 1000;

    reconfigureTimer.reset(config.reconfigureTime);

}, config.reconfigureTime);
