import { API, Logger, PlatformAccessory, PlatformConfig, Service as HbService, Characteristic as HbCharacteristic } from 'homebridge';
import type { ObisMeasurement } from 'smartmeter-obis';
import { HomebridgeObisDataAccessory, HomebridgeObisDevice } from '../PlatformTypes';

export default class EnergyImport implements HomebridgeObisDataAccessory {
  public Service: typeof HbService;
  public Characteristic: typeof HbCharacteristic;
  private svc!: HbService;
  private readonly obisKeys = ['1-0:1.8.0*255', '1-0:1.8.0'];

  constructor(
    _config: PlatformConfig,
    public readonly log: Logger,
    public readonly api: API,
    public accessory: PlatformAccessory,
    public device: HomebridgeObisDevice,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    try {
      (this.accessory as unknown as { category?: number }).category = this.api.hap.Categories.SENSOR;
    } catch (_e) { /* noop */ }

    const info = this.accessory.getService(this.api.hap.Service.AccessoryInformation);
    if (!info) {
      log.error('No service accessory provided');
      return;
    }
    info
      .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'HomebridgeObis')
      .setCharacteristic(this.api.hap.Characteristic.Model, `${this.device.product_name} Energy Import`)
      .setCharacteristic(this.api.hap.Characteristic.SerialNumber, `${this.device.serial}-energy-import-kwh`);

    const name = 'Energy Import';
    const subtype = 'energy-import';
    const legacy = this.accessory.getService(this.api.hap.Service.LightSensor);
    const byId = this.accessory.getServiceById?.(this.api.hap.Service.LightSensor, subtype);
    this.svc = byId || legacy || this.accessory.addService(this.api.hap.Service.LightSensor, name, subtype);
  }

  private floatKwh(m?: ObisMeasurement): number {
    if (!m) {
      return NaN;
    }
    try {
      if (typeof m.valueToString === 'function') {
        const s = String(m.valueToString());
        const match = s.match(/-?\d+(?:[.,]\d+)?/);
        if (match) {
          let v = Number(match[0].replace(',', '.'));
          const unit = s.toLowerCase();
          if (unit.includes('wh') && !unit.includes('kwh')) {
            v = v / 1000;
          }
          return v;
        }
      }
      const maybe = m as unknown as {
        getValues?: () => Array<{ value: number; unit?: string }>;
        values?: Array<{ value: number; unit?: string }>;
      };
      const vals = typeof maybe.getValues === 'function' ? maybe.getValues() : maybe.values;
      if (Array.isArray(vals) && vals.length > 0) {
        const first = vals[0];
        if (Number.isFinite(first?.value)) {
          const u = String(first.unit || '').toLowerCase();
          if (u.includes('wh') && !u.includes('kwh')) {
            return first.value / 1000;
          }
          return first.value;
        }
      }
    } catch (_e) {
      // noop
    }
    return NaN;
  }

  public beatWithData(data: Record<string, ObisMeasurement>): void {
    let m: ObisMeasurement | undefined;
    for (const k of this.obisKeys) {
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        m = data[k];
        break;
      }
    }
    const v = this.floatKwh(m);
    let value = Number.isFinite(v) && v > 0 ? v : 0.0001;
    if (value > 100000) {
      value = 100000;
    }
    this.svc.setCharacteristic(this.api.hap.Characteristic.CurrentAmbientLightLevel, value);
  }
}
