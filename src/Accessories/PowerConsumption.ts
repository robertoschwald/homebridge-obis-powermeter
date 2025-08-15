import {API, Logger, PlatformAccessory, PlatformConfig} from 'homebridge';
import {HomebridgeObisDevice, HomebridgeObisPowerConsumptionAccessory} from '../PlatformTypes';

export default class PowerConsumption implements HomebridgeObisPowerConsumptionAccessory {
    public Service: any;
    public Characteristic: any;
    private powerService: any;

    constructor(_config: PlatformConfig, public readonly log: Logger, public readonly api: API, public accessory: PlatformAccessory, public device: HomebridgeObisDevice) {
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        // ensure HomeKit category is SENSOR (prevents light-bulb rendering in some clients)
        try { (this.accessory as any).category = this.api.hap.Categories.SENSOR; } catch (_e) { /* noop: category not supported */ }

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
        service.setCharacteristic(this.Characteristic.Manufacturer, 'HomebridgeObis')
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