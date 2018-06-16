#include <ESP8266WiFi.h>  // Biblioteca para las funciones WiFi
#include <Wire.h>         // Biblioteca de comunicación I2C
#include <ArduinoJson.h>  // Biblioteca para el manejo JSON
#include <ESP8266HTTPClient.h>

/**
 * Definiciones de algunas direcciones mas comunes del MPU6050.
 * Los registros pueden ser encontrados en el mada de registros de este componente.
 */
const int MPU_ADDR =      0x68; // Registro de configuración del dispositivo MPU6050 (0x68)
const int WHO_AM_I =      0x75; // Registro de identificación del dispositivo.
const int PWR_MGMT_1 =    0x6B; // Registro de la gestión de energía.
const int GYRO_CONFIG =   0x1B; // Registro de configuración del giroscopio.
const int ACCEL_CONFIG =  0x1C; // Registro de configuración del acelerómetro.
const int ACCEL_XOUT =    0x3B; // Registro de lectura del eje X del acelerómetro

const int sda_pin = D6; // Definición del pin I2C SDA
const int scl_pin = D5; // Definición del pin I2C SCL

// bool led_state = false;

// Variables de los datos sensados.
int16_t AcX, AcY, AcZ, Tmp, GyX, GyY, GyZ; 

String currentMacAddress = WiFi.macAddress();
String currentSSID       = WiFi.SSID();

int analogReadValue = 0;

int status = WL_IDLE_STATUS;
String jsonString = "{\n";
double latitude   = 0.0;
double longitude  = 0.0;
double accuracy   = 0.0;

WiFiClient client;

// Construimos el objeto JSON que luego se le agregarán los datos sensados.
StaticJsonBuffer<400> jsonBuffer;
JsonObject& object = jsonBuffer.createObject();

JsonObject& data = object.createNestedObject("data");

JsonObject& position = data.createNestedObject("position");
JsonObject& accel    = data.createNestedObject("accel");
JsonObject& gyro     = data.createNestedObject("gyro");

const int loopFreq = 1000;
int loopCount = 0;

/*********************
 * Manejo del cátodo *
 *********************/
const int redPin = D1, greenPin = D2, bluePin = D3;

void twinkleLed(String color, int times = 2) {
    if (color == "red") {
        ledRed(times);
    } else if (color == "yellow") {
        ledYellow(times);
    } else if (color == "green") {
        twinkleGreenLed(times);
    }
}

void ledRed(int twinkledTimes) {
    for (int i = 0 ; i < twinkledTimes ; i++) {
        digitalWrite(redPin, HIGH);
        delay(100);
        digitalWrite(redPin, LOW);
        delay(100);
    }
}

void twinkleGreenLed(int twinkledTimes) {
    for (int i = 0 ; i < twinkledTimes ; i++) {
        ledGreen(true); delay(100);
        ledGreen(false); delay(100);
    }
}

void twinkleRedLed(int twinkledTimes) {
    for (int i = 0 ; i < twinkledTimes ; i++) {
        ledRed(true); delay(100);
        ledRed(false); delay(100);
    }
}

void twinkleYellowLed(int twinkledTimes) {
    for (int i = 0 ; i < twinkledTimes ; i++) {
        ledYellow(true); delay(100);
        ledYellow(false); delay(100);
    }
}

void ledBlue(bool on) {
    digitalWrite(bluePin, on);
}

void ledGreen(bool on) {
    digitalWrite(greenPin, on);
}

void ledRed(bool on) {
    digitalWrite(redPin, on);
}

void ledYellow(bool on) {
    digitalWrite(redPin, on);
    digitalWrite(greenPin, on);
}
/*********************
 * Fin manejo cátodo *
 *********************/

/*
 * initI2C
 * Configurá los pines necesarios para la transmisión de los datos del acelerometro
 */
void initI2C() {
    Wire.begin(sda_pin, scl_pin);
}

/*
 * writeRegMPU
 * Obtenemos el valor según el registro
 */
void writeRegMPU(int reg, int val) {
    Wire.beginTransmission(MPU_ADDR);     // Iniciamos la comunicación con MPU6050
    Wire.write(reg);                      // Enviamos el registro con el que se trabajará
    Wire.write(val);                      // Escribimos el valor en el registro
    Wire.endTransmission(true);
}

/*
 * readRegMPU
 * Lectura de un registro dado
 */
uint8_t readRegMPU(uint8_t reg) {
    uint8_t data;

    Wire.beginTransmission(MPU_ADDR);     // Iniciamos la comunicación con MPU6050.
    Wire.write(reg);                      // Enviamos el registro con el que se trabajará.
    Wire.endTransmission(false);          // Termina con la transmición pero deja abierto el I2C.
    Wire.requestFrom(MPU_ADDR, 1);        // Configura para recibir 1 byte del registro elegido arriba
                      
    return Wire.read();                   // Leemos y retormamos el byte
}

/**
 * findMPU
 * Busca el sensor en la dirección de MPU_ADDR
 */
void findMPU(int mpu_addr) {
    Wire.beginTransmission(MPU_ADDR);
    int data = Wire.endTransmission(true);

    if (data == 0) {
        Serial.print("Dispositivo encontrado en la dirección: 0x");
        Serial.println(MPU_ADDR, HEX);
    } else {
        Serial.println("Dispositivo no encontrado!");
    }
}

/**
 * checkMPU
 * Verificación del estado de los sensores y sus respuestas.
 */
void checkMPU(int mpu_addr) {
    findMPU(MPU_ADDR);

    int data = readRegMPU(WHO_AM_I);

    if (data == 104) {
        Serial.println("Acelerómetro MPU6050 respondió OK! (104)");

        data = readRegMPU(PWR_MGMT_1);

        if (data == 64) {
            Serial.println("MPU6050 in SLEEP mode!");
        } else {
            Serial.println("MPU6050 in ACTIVE mode!"); 
        }
    } else {
        Serial.println("ERROR: Verifique dispositivo - MPU6050 NO está dispoinible");
    }
}

/**
 * initMPU
 * Inicio de los sensores.
 */
void initMPU() {
    setSleepOff();
    setGyroScale();
    setAccelScale();
}

/**
 * setSleepOff
 * Configuración del bit de la gestión de alimentación
 */
void setSleepOff() {
    writeRegMPU(PWR_MGMT_1, 0); 
}

/** 
 * setGyroScale
 * Configura la escala del giroscopio.
 *
 *   FS_SEL  Full Scale Range
 *     0        ± 250 °/s      0b00000000
 *     1        ± 500 °/s      0b00001000
 *     2        ± 1000 °/s     0b00010000
 *     3        ± 2000 °/s     0b00011000
 */
void setGyroScale() {
    writeRegMPU(GYRO_CONFIG, 0);
}

/**
 * setAccelScale
 * Configura la escala del acelerómetro.
 * 0 es 250°/s
 *
 * AFS_SEL ||  Full Scale Range
 *    0    ||       ± 2g            0b00000000
 *    1    ||       ± 4g            0b00001000
 *    2    ||       ± 8g            0b00010000
 *    3    ||       ± 16g           0b00011000
 */
void setAccelScale() {
    writeRegMPU(ACCEL_CONFIG, 0);
}

/**
 * readRawMPU
 * Funcion que lee los datos crudos del sensor.
 * Es un total de 14 bytes, 2 por cada dato (aceleración x, y, z y giroscopio x, y, z) y 2 para la temperatura
 *
 * 0x3B 59 ACCEL_XOUT[15:8]
 * 0x3C 60 ACCEL_XOUT[7:0]
 * 0x3D 61 ACCEL_YOUT[15:8]
 * 0x3E 62 ACCEL_YOUT[7:0]
 * 0x3F 63 ACCEL_ZOUT[15:8]
 * 0x40 64 ACCEL_ZOUT[7:0]
 *
 * 0x41 65 TEMP_OUT[15:8]
 * 0x42 66 TEMP_OUT[7:0]
 *
 * 0x43 67 GYRO_XOUT[15:8]
 * 0x44 68 GYRO_XOUT[7:0]
 * 0x45 69 GYRO_YOUT[15:8]
 * 0x46 70 GYRO_YOUT[7:0]
 * 0x47 71 GYRO_ZOUT[15:8]
 * 0x48 72 GYRO_ZOUT[7:0]
 */
void readRawMPU() {  
    Wire.beginTransmission(MPU_ADDR);       // inicia comunicação com endereço do MPU6050
    Wire.write(ACCEL_XOUT);                 // envia o registro com o qual se deseja trabalhar, começando com registro 0x3B (ACCEL_XOUT_H)
    Wire.endTransmission(false);            // termina transmissão mas continua com I2C aberto (envia STOP e START)
    Wire.requestFrom(MPU_ADDR, 14);         // configura para receber 14 bytes começando do registro escolhido acima (0x3B)

    GyX = Wire.read() << 8;                 // Leemos primero el byte más significativo
    GyX |= Wire.read();                     // y luego el menos significativo
    GyY = Wire.read() << 8;
    GyY |= Wire.read();
    GyZ = Wire.read() << 8;
    GyZ |= Wire.read();

    Tmp = Wire.read() << 8;
    Tmp |= Wire.read();

    AcX = Wire.read() << 8;
    AcX |= Wire.read();
    AcY = Wire.read() << 8;
    AcY |= Wire.read();
    AcZ = Wire.read() << 8;
    AcZ |= Wire.read(); 

    // led_state = !led_state;
    // digitalWrite(LED_BUILTIN, led_state); // Parpadea el LED en cada transmisión

    delay(50);
}

/*
 * reconnectWiFi
 * Reintenta conectarse al WiFi
 */
void reconnectWiFi() {
    if (WiFi.status() == WL_CONNECTED) {
        return;
    }

    WiFi.begin(SSID, PASSWORD);

    while (WiFi.status() != WL_CONNECTED) {
        delay(100);
        Serial.print(".");
    }

    Serial.println();
    Serial.print("Conexón de red exitosa: ");
    Serial.println(SSID);
    Serial.print("IP obtenida (Se recomienda hacer la reservación en el servidor DHCP): ");
    Serial.println(WiFi.localIP());

    currentMacAddress = WiFi.macAddress();
    currentSSID       = WiFi.SSID();
}

/**
 * initWiFi
 */
void initWiFi() {
    delay(10);

    Serial.print("Conectando a la red: ");
    Serial.println(SSID);
    Serial.println("Aguarde");

    reconnectWiFi();
}

/*
 * populateJSON
 * Funcion que guarda los datos en el JSON.
 */
void populateJSON() {
    data["macAddress"] = currentMacAddress;

    data["SSID"] = currentSSID;
    data["RSSI"] = WiFi.RSSI();

    data["analogRead"] = analogReadValue;

    data["position"]["latitude"] = latitude;
    data["position"]["longitude"] = longitude;
    data["position"]["accuracy"] = accuracy;

    data["accel"]["x"] = AcX;
    data["accel"]["y"] = AcY;
    data["accel"]["z"] = AcZ;

    data["gyro"]["x"] = GyX;
    data["gyro"]["y"] = GyY;
    data["gyro"]["z"] = GyZ;

    object.printTo(Serial);
    Serial.println();
}

void getAnalogRead() {
    int i = 0;

    analogReadValue = 0;
    for ( ; i < 5 ; i++) {
        analogReadValue += analogRead(A0);
    }

    analogReadValue /=  i;
}

/*
 * makePOST
 * Realiza el request POST al servidor con los datos del acelerómetro y temperatura.
 */
void makePOST() {
    if (!client.connect(rpiHost, 3000)) {
        Serial.println("No se pudo conectar con el servidor!\n");
        twinkleRedLed(3);
    } else { 
        Serial.println("Conectado al servidor");

        // HTTP POST request
        client.println("POST /accel HTTP/1.1");
        client.println("Host: 192.168.1.198");
        client.println("Content-Type: application/json");
        client.print("Content-Length: ");
        client.println(object.measureLength());
        client.println();
        object.printTo(client); // Envía el JSON

        twinkleLed("green");
    }
}

/**
 * getGoogleGeolocation
 * Obtiene la ubicación segun la conexión WiFi y el servicio.
 */
void getGoogleGeolocation() {
    char bssid[6];
    DynamicJsonBuffer jsonBuffer; 

    // WiFi.scanNetworks devolverá la cantidad de redes encontradas
    int n = WiFi.scanNetworks();

    // En este punto se construye el JSONString para hacer el API call a Google Geolocation API.
    jsonString="{\n";
    jsonString +="\"homeMobileCountryCode\": 722,\n";
    jsonString +="\"homeMobileNetworkCode\": 1,\n";
    jsonString +="\"radioType\": \"gsm\",\n";
    jsonString +="\"carrier\": \"Movistar\",\n";
    jsonString +="\"wifiAccessPoints\": [\n";
    for (int j = 0; j < n; ++j) {
        jsonString +="{\n";
        jsonString +="\"macAddress\" : \"";    
        jsonString +=(WiFi.BSSIDstr(j));      // Campo Obligatorio -  La dirección MAC del nodo WiFi. Los separadores deben ser : (dos puntos).
        jsonString +="\",\n";                  
        jsonString +="\"signalStrength\": ";   
        jsonString +=WiFi.RSSI(j);          // La potencia actual de la señal medida en dBm.
        jsonString +="\n";

        if (j < n-1) {
            jsonString +="},\n";
        } else {
            jsonString +="}\n";  
        }
    }

    jsonString +=("]\n");
    jsonString +=("}\n");

    WiFiClientSecure client;

    if (client.connect(Host, 443)) {
        client.println("POST " + thisPage + key + " HTTP/1.1");
        client.println("Host: "+ (String)Host);
        client.println("Connection: close");
        client.println("Content-Type: application/json");
        client.println("User-Agent: Arduino/1.0");
        client.print("Content-Length: ");
        client.println(jsonString.length());    
        client.println();
        client.print(jsonString);  

        delay(500);
    }

    //Leer y parsear el JSON de respuesta de Google Geolocation API 
    while (client.available()) {
        String line = client.readStringUntil('\r');

        JsonObject& root = jsonBuffer.parseObject(line);
        if (root.success()) {
            latitude  = root["location"]["lat"];
            longitude = root["location"]["lng"];
            accuracy  = root["accuracy"];
        }
    }
}

//Para implementar el TCP cleanup
struct tcp_pcb;
extern struct tcp_pcb* tcp_tw_pcbs;
extern "C" void tcp_abort (struct tcp_pcb* pcb);

void tcpCleanup () {
    while (tcp_tw_pcbs != NULL) {
        tcp_abort(tcp_tw_pcbs);
    }
}

// First run
void setup() {
    pinMode(redPin, OUTPUT);
    pinMode(greenPin, OUTPUT);
    pinMode(bluePin, OUTPUT);
    pinMode(LED_BUILTIN, false);
    
    ledBlue(false);
    ledGreen(false);
    ledRed(false);

    ledYellow(true);

    Serial.begin(9600);

    Serial.println("\nIniciando configuración de WiFi\n");
    initWiFi();

    Serial.println("\nIniciando configuración de MPU6050\n");
    initI2C();
    initMPU();
    checkMPU(MPU_ADDR);

    // Obtengo la ubicación al conectarse.
    getGoogleGeolocation();

    ledYellow(false);

    Serial.println("\nConfiguración finalizada iniciando loop\n");
}

// Run on every iteration
void loop() {
    readRawMPU();    // Lee los datos del acelerómetro

    if ((getPositionPeriod / loopFreq) < loopCount ) {
        // API call a Google Location API para obtener coordenas de geolocalizacion del dispositivo.
        getGoogleGeolocation();

        loopCount = 0;
    }

    getAnalogRead();

    populateJSON();  // Crea el objeto JSON con los datos del acelerómetro
    makePOST();      // Hace el POST en el NodeJS server

    if ((30000 / loopFreq) < loopCount ) {
        tcpCleanup();    // Cleanup de las conexiones TCP al sistema remoto para evitar el memory leak
    }

    loopCount++;
    delay(loopFreq);
}
