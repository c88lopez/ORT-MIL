const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const path = require('path');
const fs = require('fs');

const deviceModule = require('aws-iot-device-sdk').device;

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
const deviceTemplate = {
    serial: '',
    tipo: 'HombreQuieto',
    alias: 'Desconocido',
    ultimaTransmision: 0,
    enMovimiento: 0,
    tiempoQuieto: 0,
    bateria: 0.0,
    geoposicio: {
        lat: 0.0,
        lon: 0.0,
        accuracy: 0,
    },
    wifi: {
        ssid: '',
        intencidad: 0,
    },
};

const publishInterval = 1000;

app.post('/accel', function(req, res) {
    const macAddress = req.body.data.macAddress;

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

    let alias = deviceTemplate.alias;
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
                bateria: getBatteryLevel(req.body.data.analogRead),
                lat: req.body.data.position.latitude,
                lon: req.body.data.position.longitude,
                accuracy: req.body.data.position.accuracy,
                ssid: req.body.data.SSID,
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
                bateria: getBatteryLevel(req.body.data.analogRead),
                lat: req.body.data.position.latitude,
                lon: req.body.data.position.longitude,
                accuracy: req.body.data.position.accuracy,
                ssid: req.body.data.SSID,
                intensidad: req.body.data.RSSI,
            };
        });
    }

    // fs.appendFile(`${macAddress.split(':').join('_')}.csv`, `${now},${req.body.data.analogRead}` + "\n", function (err) {
    //     if (err) throw err;
    // });
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

function getBatteryLevel(analogRead) {
    const max = 940
        , min = 700;

    let level = (analogRead - min) / (max - min) * 100;

    if (level > 100) {
        level = 100;
    } else if (level < 0) {
        level = 0;
    }

    return Number(level.toFixed(0));
}

setInterval(() => {
    devices = devices.map((device) => {
        if ((Date.now()) - device.ultimaTransmision > config.tiempoSinTransmisionComoSinMovimiento * 1000) {
            device.enMovimiento = false;
        }

        device.tiempoQuieto = device.enMovimiento
            ? 0
            : (device.tiempoQuieto + publishInterval / 1000);

        return device;
    });

    io.emit('accelData', devices);

    /**
     * Publish to AWS IoT
     */
    const device = deviceModule({
        /*keyPath: args.privateKey,
        certPath: args.clientCert,
        caPath: args.caCert,*/
        keyPath: './ORT-MIL-SERVER.private.key',
        certPath: './ORT-MIL-SERVER.cert.pem',
        caPath: './root-CA.crt',
        // clientId: args.clientId,
        // region: args.region,
        // baseReconnectTimeMs: args.baseReconnectTimeMs,
        // keepalive: args.keepAlive,
        // protocol: args.Protocol,
        // port: args.Port,
        // host: args.Host,
        host: 'a1cq7pfnlzpa82.iot.us-east-1.amazonaws.com',
        // debug: args.Debug
    });

    device.subscribe('ORT-MIL-SERVER');
    devices.forEach(iotDevice => {
        device.publish('ORT-MIL-SERVER', JSON.stringify(iotDevice));
    });

}, config.periodoPublicacion);