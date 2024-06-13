/**
 * Example output (ZPA EHz Smart Meter):
 * Start
 * 1-0:96.50.1*1: Service entry (T1) previous Year = ZPA
 * 1-0:96.1.0*255: Serialnumber = 0c022c22222222222222
 * 1-0:1.8.0*255: Time integral 1 Sum active power + (Total) = 2384.065 kWh
 * 1-0:2.8.0*255: Time integral 1 Sum active power - (Total) = 0 kWh
 * 1-0:14.7.0*255: Instantaneous value Frequency (Total) = 50.09 Hz
 * 1-0:0.2.0*0: Firmware version = 01
 * 1-0:96.90.2*1: Service entry (T2) previous Year = 7249a01a
 * 1-0:97.97.0*255: Error message (Total) = 00000000
 * 1-0:96.5.0*255: Last average 1 Service entry (Total) = 001c0104
 * 1-0:16.7.0*255: Instantaneous value Total active power (Total) = 874 W
 * 1-0:36.7.0*255: Instantaneous value (Total) = 61 W
 * 1-0:56.7.0*255: Instantaneous value (Total) = 223 W
 * 1-0:76.7.0*255: Instantaneous value (Total) = 589 W
 * 1-0:32.7.0*255: Instantaneous value L1 voltage (Total) = 240.2 V
 * 1-0:52.7.0*255: Instantaneous value L2 voltage (Total) = 239.65 V
 * 1-0:72.7.0*255: Instantaneous value L3 voltage (Total) = 240.19 V
 * 1-0:31.7.0*255: Instantaneous value L1 current (Total) = 0.359 A
 * 1-0:51.7.0*255: Instantaneous value L2 current (Total) = 1.322 A
 * 1-0:71.7.0*255: Instantaneous value L3 current (Total) = 2.515 A
 * 1-0:81.7.1*255: Instantaneous value Angles (T1) = 119.6 °
 * 1-0:81.7.2*255: Instantaneous value Angles (T2) = 240.9 °
 * 1-0:81.7.4*255: Instantaneous value Angles (T4) = 319.7 °
 * 1-0:81.7.15*255: Instantaneous value Angles = 317.3 °
 * 1-0:81.7.26*255: Instantaneous value Angles = 351.7 °
 */

import {
    API,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service,
    Characteristic,
} from 'homebridge';
import SmartMeterObis, {ObisOptions} from 'smartmeter-obis';

import {HomebridgeSmlPowerConsumptionAccessory, HomebridgeSmlDevice} from './PlatformTypes';
import PowerConsumption from './Accessories/PowerConsumption';
import PowerReturn from './Accessories/PowerReturn';

export class HomebridgeSmlPowerConsumption implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
    public readonly accessories: PlatformAccessory[] = [];
    private readonly heartBeatInterval: number;
    private devices: HomebridgeSmlPowerConsumptionAccessory[] = [];
    private device: HomebridgeSmlDevice = {} as HomebridgeSmlDevice;
    // Fix this

    private obisOptions = {
        'protocol': 'SmlProtocol',
        'transport': 'SerialResponseTransport',
        'transportSerialPort': '',
        'requestInterval': 10,
        'obisNameLanguage': 'en',
        'obisFallbackMedium': 6,
        'debug': 0,
        'protocolSmlIgnoreInvalidCRC': false,
        'protocolSmlInputEncoding': 'ascii'
    };


    constructor(public readonly log: Logger, public readonly config: PlatformConfig, public readonly api: API) {
        this.heartBeatInterval = (config.pollInterval || 60) * 1000;
        this.api.on('didFinishLaunching', () => {
            this.initialize();
        });
    }

    public configureAccessory(accessory: PlatformAccessory) {
        this.accessories.push(accessory);
    }

    private validateConfig(): boolean {
        return !!this.config.ip;
    }

    private async validateSerialPort(): Promise<boolean> {
        try {
            this.obisOptions.transportSerialPort = this.config.serialPort;
            const smTransport = SmartMeterObis.init(this.obisOptions as ObisOptions, (error: Error, data) => {
                if (error) {
                    console.error('Error:', error);
                    return false;
                }
                const deviceData = {
                    product_name: data['1-0:96.50.1*1'],
                    product_type: data['1-0:96.50.1*1'],
                    serial: data['1-0:96.1.0*255'],
                    firmware_version: data['1-0:0.2.0*0'],
                    api_version: data['1-0:0.2.0*0']
                }

                this.device = deviceData as HomebridgeSmlDevice;
                return true;
            });
            smTransport.process();

            if (!this.device) {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    private async initialize() {
        if (!this.validateConfig()) {
            this.log.error('Configuration error. Please provide your Power-Meter connected serial port');
            return;
        }

        if (!await this.validateSerialPort()) {
            this.log.error('Your Power-meter\'s Serial Port seems to be incorrect. No connection possible');
            return;
        }

        this.setupAccessoires();

        await this.heartBeat();

        setInterval(() => {
            this.heartBeat();
        }, this.heartBeatInterval);
    }

    private setupAccessoires() {

        const powerConsumptionName = 'Power Consumption';
        const powerConsumptionUuid = this.api.hap.uuid.generate('homewizard-power-consumption');
        const powerConsumptionExistingAccessory = this.accessories.find(accessory => accessory.UUID === powerConsumptionUuid);
        if (this.config.hidePowerConsumptionDevice !== true) {
            if (powerConsumptionExistingAccessory) {
                this.devices.push(new PowerConsumption(this.config, this.log, this.api, powerConsumptionExistingAccessory, this.device));
            } else {
                this.log.info(`${powerConsumptionName} added as accessory`);
                const accessory = new this.api.platformAccessory(powerConsumptionName, powerConsumptionUuid);
                this.devices.push(new PowerConsumption(this.config, this.log, this.api, accessory, this.device));
                this.api.registerPlatformAccessories('homebridge-homewizard-power-consumption', 'HomewizardPowerConsumption', [accessory]);
            }
        } else {
            if (powerConsumptionExistingAccessory) {
                this.api.unregisterPlatformAccessories(
                    powerConsumptionUuid,
                    'homebridge-homewizard-power-consumption',
                    [powerConsumptionExistingAccessory],
                );
            }
        }

        const powerReturnName = 'Power Return';
        const powerReturnUuid = this.api.hap.uuid.generate('homebridge-sml-power-return');
        const powerReturnExistingAccessory = this.accessories.find(accessory => accessory.UUID === powerReturnUuid);
        if (this.config.hidePowerReturnDevice !== true) {
            if (powerReturnExistingAccessory) {
                this.devices.push(new PowerReturn(this.config, this.log, this.api, powerReturnExistingAccessory, this.device));
            } else {
                this.log.info(`${powerReturnName} added as accessory`);
                const accessory = new this.api.platformAccessory(powerReturnName, powerReturnUuid);
                this.devices.push(new PowerReturn(this.config, this.log, this.api, accessory, this.device));
                this.api.registerPlatformAccessories('homebridge-sml-power-consumption', 'HomebridgeSmlPowerConsumption', [accessory]);
            }
        } else {
            if (powerReturnExistingAccessory) {
                this.api.unregisterPlatformAccessories(powerReturnUuid, 'homebridge-sml-power-consumption', [powerReturnExistingAccessory]);
            }
        }
    }

    private async heartBeat() {
        let activePowerConsumption: number;
        const smTransport = SmartMeterObis.init(this.obisOptions as ObisOptions, (error: Error, data) => {
            if (error) {
                console.error('Error:', error);
                return false;
            }
            try {
                activePowerConsumption = data['1-0:16.7.0*255'] as number;
            } catch (error) {
                console.error('Cannot read or cast active power consumption. Error:', error);
                return false;
            }
        })
        try {
            smTransport.process();
            if (!activePowerConsumption) {
                this.log.error('Cannot read active power consumption. Please double check the Power Meter Serial Port name');
                return;
            }
            this.devices.forEach((device: HomebridgeSmlPowerConsumptionAccessory) => {
                device.beat(activePowerConsumption);
            });
            this.log.debug('heart beat', activePowerConsumption);
        } catch (error) {
            this.log.error('Something went wrong, please double check the Power Meter Serial Port name');
            this.log.debug('${error}');
        }
    }
}