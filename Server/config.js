module.exports = {
    "datosPorDispositivo": 2,
    "tiempoSinTransmisionComoSinMovimiento": 5,
    "pushTime": 1000,
    "sensibilidadDeteccionMovimiento": 1000,
    "reconfigureTime": 1000,
    "aws": {
        "iot": {
            "publish": false,
            "certFolder": "sidney",
            "topic": "ORT-MIL-SERVER",
            "endpoint": "a1cq7pfnlzpa82.iot.us-east-1.amazonaws.com",

            // "certFolder": "experta",
            // "topic": "iot/QMDev",
            // "endpoint": "a14ifzhh6b83pg.iot.us-east-1.amazonaws.com",
        },
    },
    "suscripcionDispositivos": false,
    "dispositivos": {
        "60:01:94:1F:88:0B_falso": {
            "alias": "Cris",
            "calibracionBateria": {
                "voltaje": 2500
            },
        },
    },
}
