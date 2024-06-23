import {API, Characteristic, CharacteristicValue, Logger, PlatformAccessory, PlatformConfig, Service} from 'homebridge';
import {HomebridgeSmlDevice, HomebridgeSmlPowerConsumptionAccessory} from '../PlatformTypes';

export default class PowerConsumption implements HomebridgeSmlPowerConsumptionAccessory {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
    private readonly powerService!: Service;

    constructor(public config: PlatformConfig, public readonly log: Logger, public readonly api: API, public accessory: PlatformAccessory, public device: HomebridgeSmlDevice) {
        if (!accessory) {
            log.error('No accessory provided');
            return;
        }
        this.powerService = this.accessory.getService(this.Service.LightSensor) || this.accessory.addService(this.Service.LightSensor);
        if (!this.powerService) {
            log.error('No power service provided');
            return;
        }

        const service = accessory.getService(this.Service.AccessoryInformation);
        if (!service) {
            log.error('No service accessory provided');
            return;
        }
        service.setCharacteristic(this.Characteristic.Manufacturer, 'HomebridgeSml')
            .setCharacteristic(this.Characteristic.Model, device.product_name)
            .setCharacteristic(this.Characteristic.SerialNumber, `${device.serial}-power-consumption`);
    }

    public beat(consumption: number) {
        let newPowerConsumptionLevel = 0.0001;
        if (consumption > 0) {
            newPowerConsumptionLevel = consumption;
        }
        this.powerService.setCharacteristic(this.Characteristic.CurrentAmbientLightLevel, newPowerConsumptionLevel);
    }
}