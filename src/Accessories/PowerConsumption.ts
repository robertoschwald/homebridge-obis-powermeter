import { API, Logger, PlatformAccessory, PlatformConfig, Service as HbService, Characteristic as HbCharacteristic } from 'homebridge';
import { HomebridgeObisDevice, HomebridgeObisPowerConsumptionAccessory } from '../PlatformTypes';

export default class PowerConsumption implements HomebridgeObisPowerConsumptionAccessory {
  public Service: typeof HbService;
  public Characteristic: typeof HbCharacteristic;
  private powerService!: HbService;

  constructor(
    _config: PlatformConfig,
    public readonly log: Logger,
    public readonly api: API,
    public accessory: PlatformAccessory,
    public device: HomebridgeObisDevice,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    // ensure HomeKit category is SENSOR (prevents light-bulb rendering in some clients)
    try {
      (this.accessory as unknown as { category?: number }).category = this.api.hap.Categories.SENSOR;
    } catch (_e) { /* noop: category not supported */ }

    if (!accessory) {
      log.error('No accessory provided');
      return;
    }

    // Use a stable subtype to avoid duplicate LightSensor service / characteristic errors
    const subtype = 'power-consumption';
    // Migration logic: if a legacy LightSensor service exists without subtype, reuse it
    const legacy = this.accessory.getService(this.Service.LightSensor);
    const byId = this.accessory.getServiceById?.(this.Service.LightSensor, subtype);
    this.powerService = byId || legacy || this.accessory.addService(this.Service.LightSensor, 'Power Consumption', subtype);

    const info = accessory.getService(this.Service.AccessoryInformation);
    if (!info) {
      log.error('No service accessory provided');
      return;
    }
    info
      .setCharacteristic(this.Characteristic.Manufacturer, 'HomebridgeObis')
      .setCharacteristic(this.Characteristic.Model, device.product_name)
      .setCharacteristic(
        this.Characteristic.SerialNumber,
        `${device.serial}-power-consumption`,
      );
  }

  public beat(consumption: number) {
    let newPowerConsumptionLevel = 0.0001;
    if (consumption > 0) {
      newPowerConsumptionLevel = consumption;
    }
    this.powerService.setCharacteristic(
      this.Characteristic.CurrentAmbientLightLevel,
      newPowerConsumptionLevel,
    );
  }
}