import { Service, PlatformAccessory, PlatformConfig, Logger, API, Characteristic } from 'homebridge';
import { HomebridgeSmlDevice, HomebridgeSmlPowerConsumptionAccessory } from '../PlatformTypes';

export default class PowerConsumption implements HomebridgeSmlPowerConsumptionAccessory {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  private powerService: Service;

  constructor(public config: PlatformConfig, public readonly log: Logger, public readonly api: API, public accessory: PlatformAccessory, public device: HomebridgeSmlDevice) {
    this.accessory.getService(this.Service.AccessoryInformation)
      .setCharacteristic(this.Characteristic.Manufacturer, 'HomebridgeSml')
      .setCharacteristic(this.Characteristic.Model, device.product_name)
      .setCharacteristic(this.Characteristic.SerialNumber, `${device.serial}-power-consumption`);

    this.powerService = this.accessory.getService(this.Service.LightSensor) || this.accessory.addService(this.Service.LightSensor);
  }

  public beat(consumption: number) {
    const minimumLuxLevel = 0.0001;
    let newPowerConsumptionLevel = minimumLuxLevel;
    if (consumption > 0) {
      newPowerConsumptionLevel = consumption;
    }
    this.powerService.setCharacteristic(this.Characteristic.CurrentAmbientLightLevel, newPowerConsumptionLevel);
  }
}