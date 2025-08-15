import {API, Logger, PlatformAccessory, PlatformConfig} from 'homebridge';
import {HomebridgeSmlPowerConsumptionAccessory, HomebridgeSmlDevice} from '../PlatformTypes';

export default class PowerReturn implements HomebridgeSmlPowerConsumptionAccessory {
  public Service: any;
  public Characteristic: any;
  private powerService: any;

  constructor(_config: PlatformConfig, public readonly log: Logger, public readonly api: API, public accessory: PlatformAccessory, public device: HomebridgeSmlDevice) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    const service = this.accessory.getService(this.Service.AccessoryInformation);
    if (!service) {
      log.error('No service accessory provided');
      return;
    }
    service.setCharacteristic(this.Characteristic.Manufacturer, 'HomebridgeSml')
      .setCharacteristic(this.Characteristic.Model, device.product_name)
      .setCharacteristic(this.Characteristic.SerialNumber, `${device.serial}-power-return`);

    this.powerService = this.accessory.getService(this.Service.LightSensor) || this.accessory.addService(this.Service.LightSensor);
  }

  public beat(consumption: number) {
    let newPowerConsumptionLevel = 0.0001;
    if (consumption < 0) {
      newPowerConsumptionLevel = consumption * -1;
    }
    this.powerService.setCharacteristic(this.Characteristic.CurrentAmbientLightLevel, newPowerConsumptionLevel);
  }
}