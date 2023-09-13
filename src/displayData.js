#!javascript
// Helper program to read SML data from serial port
// node displayData.sh

var SmartmeterObis = require('smartmeter-obis');

var options = {
    'protocol': "SmlProtocol",
    'transport': "SerialResponseTransport",
    'transportSerialPort': "/dev/ttyUSB0",
    'requestInterval': 0.3,
    'obisNameLanguage': 'en',
    'obisFallbackMedium': 6,
    'debug': 0
};

function displayData(err, obisResult) {
        console.log("Start")
    if (err) {
        // handle error
        // if you want to cancel the processing because of this error call smTransport.stop() before returning
        // else processing continues
	console.log(err)
        return;
    }
    for (var obisId in obisResult) {
        console.log(
            obisResult[obisId].idToString() + ': ' +
            SmartmeterObis.ObisNames.resolveObisName(obisResult[obisId], options.obisNameLanguage).obisName + ' = ' +
            obisResult[obisId].valueToString()
        );
    }

}

var smTransport = SmartmeterObis.init(options, displayData);

smTransport.process();

setTimeout(smTransport.stop, 60000);
