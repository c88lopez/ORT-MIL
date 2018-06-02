/**
 * Archivo de configuración.
 * En este se deberá ingresar los datos para el correcto funcionamient.
 */

// Definición de la red Wifi.
const char* SSID = "Telecentro-3380";
const char* PASSWORD = "tele-3189996";

// IP del servidor al cual se realizan los request con los datos sensados.
const char* rpiHost = "192.168.0.12";

//Credenciales para Google GeoLocation API... 
// IMPORTANTE: Versión gratiuta admite 2500 consultas x día.
const char* Host = "www.googleapis.com";
String thisPage = "/geolocation/v1/geolocate?key=";
String key = "AIzaSyDjqF5jLsWhLChhiKtHN3tsDpGQo8f1pUo";

/**
 * Este valor indica cada cuantos milisegundos se quiere pedir por la ubicación
 */
int getPositionPeriod = 10000;