import { API, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';
import type { ObisMeasurement } from 'smartmeter-obis';
import { HomebridgeSmlDataAccessory, HomebridgeSmlDevice } from '../PlatformTypes';

export default class EnergyImport implements HomebridgeSmlDataAccessory {
  public Service: any;
  public Characteristic: any;
  private svc: any;
  private readonly obisKeys = ['1-0:1.8.0*255', '1-0:1.8.0'];

  constructor(_config: PlatformConfig, public readonly log: Logger, public readonly api: API, public accessory: PlatformAccessory, public device: HomebridgeSmlDevice) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    try { (this.accessory as any).category = this.api.hap.Categories.SENSOR; } catch {}

    const info = this.accessory.getService(this.Service.AccessoryInformation);
    if (!info) {
      log.error('No service accessory provided');
      return;
    }
    info.setCharacteristic(this.Characteristic.Manufacturer, 'HomebridgeSml')
      .setCharacteristic(this.Characteristic.Model, `${this.device.product_name} Energy Import`)
      .setCharacteristic(this.Characteristic.SerialNumber, `${this.device.serial}-energy-import-kwh`);

    // Use LightSensor for numeric display; most clients render a sensor tile with value
    const name = 'Energy Import (Total, kWh)';
    this.svc = this.accessory.getService(this.Service.LightSensor) || this.accessory.addService(this.Service.LightSensor, name);
  }

  private floatKwh(m?: ObisMeasurement): number {
    if (!m) { return NaN; }
    try {
      if (typeof m.valueToString === 'function') {
        const s = String(m.valueToString());
        const match = s.match(/-?\d+(?:[.,]\d+)?/);
        if (match) {
          let v = Number(match[0].replace(',', '.'));
          const unit = s.toLowerCase();
          // Expect kWh, but also handle Wh
          if (unit.includes('wh') && !unit.includes('kwh')) { v = v / 1000; }
          return v;
        }
      }
      const vals = typeof (m as any).getValues === 'function' ? (m as any).getValues() : (m as any).values;
      if (Array.isArray(vals) && vals.length > 0) {
        const { value, unit } = vals[0] as unknown as { value: number; unit: string };
        if (Number.isFinite(value)) {
          const u = String(unit || '').toLowerCase();
          if (u.includes('wh') && !u.includes('kwh')) { return value / 1000; }
          return value;
        }
      }
    } catch {}
    return NaN;
  }

  public beatWithData(data: Record<string, ObisMeasurement>): void {
    let m: ObisMeasurement | undefined;
    for (const k of this.obisKeys) {
      if (Object.prototype.hasOwnProperty.call(data, k)) { m = data[k]; break; }
    }
    const v = this.floatKwh(m);
    // HomeKit LightSensor requires >= 0.0001 and <= 100000. Clamp safely.
    let value = Number.isFinite(v) && v > 0 ? v : 0.0001;
    if (value > 100000) { value = 100000; }
    this.svc.setCharacteristic(this.Characteristic.CurrentAmbientLightLevel, value);
  }
}
