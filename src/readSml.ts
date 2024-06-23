#!javascript
// Example program to read SML data from serial port
// node readSml.js

import SmartMeterObis, {ObisLanguage, ObisMeasurement, ObisOptions} from 'smartmeter-obis';

const options = {
    'protocol': 'SmlProtocol',
    'transport': 'SerialResponseTransport',
    'transportSerialPort': '/dev/ttyUSB0',
    'requestInterval': 10,
    'obisNameLanguage': 'en' as ObisLanguage,
    'obisFallbackMedium': 6,
    'debug': 0,
};

function displayData(err, obisResult: { [p: string]: ObisMeasurement }) {
    console.log('Start');
    if (err) {
        // handle error
        // if you want to cancel the processing because of this error call smTransport.stop() before returning
        // else processing continues
        console.log(err);
        return;
    }
    for (const obisId in obisResult) {
        console.log(
            obisResult[obisId].idToString() + ': ' +
            SmartMeterObis.ObisNames.resolveObisName(obisResult[obisId], options.obisNameLanguage).obisName + ' = ' +
            obisResult[obisId].valueToString(),
        );
    }

}

const smTransport = SmartMeterObis.init(options as ObisOptions, displayData);

smTransport.process();

setTimeout(smTransport.stop, 60000);