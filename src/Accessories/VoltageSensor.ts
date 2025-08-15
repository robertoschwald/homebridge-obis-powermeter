import { API, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';
import type { ObisMeasurement } from 'smartmeter-obis';
import { HomebridgeSmlDataAccessory, HomebridgeSmlDevice } from '../PlatformTypes';

interface VoltageOptions {
  obisKey: string;
  name: string;
  serialSuffix: string;
}

export default class VoltageSensor implements HomebridgeSmlDataAccessory {
  public Service: any;
  public Characteristic: any;
  private voltageService: any;
  private readonly obisKey: string;

  constructor(_config: PlatformConfig, public readonly log: Logger, public readonly api: API, public accessory: PlatformAccessory, public device: HomebridgeSmlDevice, opts: VoltageOptions) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;
    this.obisKey = opts.obisKey;

    try { (this.accessory as any).category = this.api.hap.Categories.SENSOR; } catch {}

    const info = this.accessory.getService(this.Service.AccessoryInformation);
    if (!info) {
      log.error('No service accessory provided');
      return;
    }
    info.setCharacteristic(this.Characteristic.Manufacturer, 'HomebridgeSml')
      .setCharacteristic(this.Characteristic.Model, `${this.device.product_name} Voltage`)
      .setCharacteristic(this.Characteristic.SerialNumber, `${this.device.serial}-${opts.serialSuffix}`);

    // Use LightSensor to display numeric value in most clients
    this.voltageService = this.accessory.getService(this.Service.LightSensor) || this.accessory.addService(this.Service.LightSensor, opts.name);
  }

  private floatOf(m?: ObisMeasurement): number {
    if (!m) { return NaN; }
    try {
      if (typeof m.valueToString === 'function') {
        const s = String(m.valueToString());
        const match = s.match(/-?\d+(?:[.,]\d+)?/);
        if (match) {
          let v = Number(match[0].replace(',', '.'));
          const unit = s.toLowerCase();
          if (unit.includes('kv')) { v = v * 1000; }
          return v;
        }
      }
      const vals = typeof (m as any).getValues === 'function' ? (m as any).getValues() : (m as any).values;
      if (Array.isArray(vals) && vals.length > 0) {
        const { value, unit } = vals[0] as unknown as { value: number; unit: string };
        if (Number.isFinite(value)) {
          const u = String(unit || '').toLowerCase();
          if (u.includes('kv')) { return value * 1000; }
          return value;
        }
      }
    } catch {}
    return NaN;
  }

  public beatWithData(data: Record<string, ObisMeasurement>): void {
    const v = this.floatOf(data[this.obisKey]);
    const value = Number.isFinite(v) && v > 0 ? v : 0.0001; // HomeKit min
    this.voltageService.setCharacteristic(this.Characteristic.CurrentAmbientLightLevel, value);
  }
}

