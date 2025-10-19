import { API, Logger, PlatformAccessory, PlatformConfig, Service as HbService, Characteristic as HbCharacteristic } from 'homebridge';
import type { ObisMeasurement } from 'smartmeter-obis';
import { HomebridgeObisDataAccessory, HomebridgeObisDevice } from '../PlatformTypes';

interface VoltageOptions {
  obisKey: string;
  name: string;
  serialSuffix: string;
}

export default class VoltageSensor implements HomebridgeObisDataAccessory {
  public Service: typeof HbService;
  public Characteristic: typeof HbCharacteristic;
  private voltageService!: HbService;
  private readonly obisKey: string;
  private readonly serialSuffix: string;

  constructor(
    _config: PlatformConfig,
    public readonly log: Logger,
    public readonly api: API,
    public accessory: PlatformAccessory,
    public device: HomebridgeObisDevice,
    opts: VoltageOptions,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;
    this.obisKey = opts.obisKey;
    this.serialSuffix = opts.serialSuffix;

    try {
      (this.accessory as unknown as { category?: number }).category = this.api.hap.Categories.SENSOR;
    } catch (_e) { /* noop */ }

    const info = this.accessory.getService(this.Service.AccessoryInformation);
    if (!info) {
      log.error('No service accessory provided');
      return;
    }
    info
      .setCharacteristic(this.Characteristic.Manufacturer, 'HomebridgeObis')
      .setCharacteristic(this.Characteristic.Model, `${this.device.product_name} Voltage`)
      .setCharacteristic(this.Characteristic.SerialNumber, `${this.device.serial}-${opts.serialSuffix}`);

    const subtype = `voltage-${this.serialSuffix}`;
    const legacy = this.accessory.getService(this.Service.LightSensor);
    const byId = this.accessory.getServiceById?.(this.Service.LightSensor, subtype);
    this.voltageService = byId || legacy || this.accessory.addService(this.Service.LightSensor, opts.name, subtype);
  }

  private floatOf(m?: ObisMeasurement): number {
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
          if (unit.includes('kv')) {
            v = v * 1000;
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
          if (u.includes('kv')) {
            return first.value * 1000;
          }
          return first.value;
        }
      }
    } catch (_e) { /* noop */ }
    return NaN;
  }

  public beatWithData(data: Record<string, ObisMeasurement>): void {
    const v = this.floatOf(data[this.obisKey]);
    const value = Number.isFinite(v) && v > 0 ? v : 0.0001;
    this.voltageService.setCharacteristic(this.Characteristic.CurrentAmbientLightLevel, value);
  }
}
