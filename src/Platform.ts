/**
 * Homebridge SML Power Consumption Plugin
 * Reads power consumption data from a Smart Meter using SML protocol over a serial port.
 * Provides Homebridge accessories for power consumption and return.
 */

/**
 * Example output of readSml.js with a ZPA EHz Smart Meter:
 * Start
 * 1-0:96.50.1*1: Service entry (T1) previous Year = ZPA
 * 1-0:96.1.0*255: Serialnumber = 0a535350410001822222
 * 1-0:1.8.0*255: Time integral 1 Sum active power + (Total) = 11163.4213 kWh
 * 1-0:2.8.0*255: Time integral 1 Sum active power - (Total) = 0 kWh
 * 1-0:14.7.0*255: Instantaneous value Frequency (Total) = 50.03 Hz
 * 1-0:0.2.0*0: Firmware version = 01
 * 1-0:96.90.2*1: Service entry (T2) previous Year = 7249a01d
 * 1-0:97.97.0*255: Error message (Total) = 00000000
 * 1-0:96.5.0*255: Last average 1 Service entry (Total) = 001c0104
 * 1-0:16.7.0*255: Instantaneous value Total active power (Total) = 381 W
 * 1-0:36.7.0*255: Instantaneous value (Total) = 37 W
 * 1-0:56.7.0*255: Instantaneous value (Total) = 190 W
 * 1-0:76.7.0*255: Instantaneous value (Total) = 152 W
 * 1-0:32.7.0*255: Instantaneous value L1 voltage (Total) = 241.99 V
 * 1-0:52.7.0*255: Instantaneous value L2 voltage (Total) = 243.01 V
 * 1-0:72.7.0*255: Instantaneous value L3 voltage (Total) = 241.67 V
 * 1-0:31.7.0*255: Instantaneous value L1 current (Total) = 0.295 A
 * 1-0:51.7.0*255: Instantaneous value L2 current (Total) = 1.489 A
 * 1-0:71.7.0*255: Instantaneous value L3 current (Total) = 0.767 A
 * 1-0:81.7.1*255: Instantaneous value Angles (T1) = 122.1 °
 * 1-0:81.7.2*255: Instantaneous value Angles (T2) = 241 °
 * 1-0:81.7.4*255: Instantaneous value Angles (T4) = 306.6 °
 * 1-0:81.7.15*255: Instantaneous value Angles = 304.2 °
 * 1-0:81.7.26*255: Instantaneous value Angles = 328.7 °
 */
import {API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig} from 'homebridge';
import SmartMeterObis, {ObisMeasurement, ObisOptions} from 'smartmeter-obis';
import fs from 'fs';

import {HomebridgeObisDevice, HomebridgeObisPowerConsumptionAccessory} from './PlatformTypes';
import PowerConsumption from './Accessories/PowerConsumption';
import PowerReturn from './Accessories/PowerReturn';
import VoltageSensor from './Accessories/VoltageSensor';
import type { HomebridgeObisDataAccessory } from './PlatformTypes';
import EnergyImport from './Accessories/EnergyImport';

interface PluginConfig extends PlatformConfig {
    pollInterval?: number;
    serialPort: string;
    protocol?: 'SmlProtocol' | 'D0Protocol' | 'JsonEfrProtocol';
    serialBaudRate?: number;
    serialDataBits?: number; // 5,6,7,8
    serialStopBits?: number; // 1,2
    serialParity?: 'none' | 'even' | 'odd';
    hidePowerConsumptionDevice?: boolean;
    hidePowerReturnDevice?: boolean;
    debugLevel?: number; // optional extra logging for smartmeter-obis
}

type ObisSerialOptions = ObisOptions & { transportSerialPort?: string };

export class HomebridgeObisPowerConsumption implements DynamicPlatformPlugin {
  public Service: unknown;
  public Characteristic: unknown;
  public readonly accessories: PlatformAccessory[] = [];

  private readonly heartBeatInterval: number;
  private readonly REGISTER_PLUGIN_NAME = 'homebridge-obis-powermeter';
  private readonly PLATFORM_NAME = 'SML';
  private readonly UUID_NAMESPACE = 'homebridge-sml-power-consumption';

  private devices: HomebridgeObisPowerConsumptionAccessory[] = [];
  private dataDevices: HomebridgeObisDataAccessory[] = [];
  private device: HomebridgeObisDevice | null = null;
  private hbTimer?: NodeJS.Timeout;

  // prefer warn when plugin debugLevel is enabled so logs are visible even if child-bridge log level is warn
  private d(msg: string, level = 1) {
    const dl = Number(this.obisOptions.debug ?? 0);
    if (dl >= level) {
      this.log.warn(msg);
    } else {
      this.log.debug(msg);
    }
  }

  constructor(
        public readonly log: Logger,
        public readonly config: PluginConfig,
        public readonly api: API,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;
    this.heartBeatInterval = (this.config.pollInterval || 60) * 1000;

    // Configure debug level from config or env (SML_DEBUG). Coerce strings -> numbers and clamp 0..2.
    const envRaw = process.env.OBIS_DEBUG;
    const envNum = envRaw !== undefined && envRaw !== '' ? Number(envRaw) : NaN;
    const cfgNum = Number(this.config.debugLevel ?? NaN);
    const base = (Number.isFinite(envNum) && envNum >= 0)
      ? envNum
      : (Number.isFinite(cfgNum) && cfgNum >= 0 ? cfgNum : 0);
    const dbg: 0 | 1 | 2 = (base <= 0 ? 0 : base >= 2 ? 2 : 1);
    this.obisOptions.debug = dbg;

    this.api.on('didFinishLaunching', () => {
      this.initialize();
    });
  }

  public configureAccessory(accessory: PlatformAccessory) {
    this.accessories.push(accessory);
  }

  private validateConfig(): boolean {
    return this.config.serialPort.length > 0;
  }

  private obisOptions: ObisSerialOptions = {
    protocol: 'SmlProtocol',
    transport: 'SerialResponseTransport',
    transportSerialPort: '',
    requestInterval: 10,
    obisNameLanguage: 'en',
    obisFallbackMedium: 6,
    debug: 0,
    protocolSmlIgnoreInvalidCRC: false,
    protocolSmlInputEncoding: 'binary',
    // SML defaults for encoding/CRC are used
  };

  private syncObisOptionsFromConfig() {
    const protocol = this.config.protocol ?? 'SmlProtocol';
    this.obisOptions.protocol = protocol;
    // Choose sensible default transport per protocol
    if (protocol === 'D0Protocol') {
      this.obisOptions.transport = 'SerialRequestResponseTransport';
    } else {
      this.obisOptions.transport = 'SerialResponseTransport';
    }
  }

  private async validateSerialPort(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        this.syncObisOptionsFromConfig();
        this.obisOptions.transportSerialPort = this.config.serialPort;
        // forward optional serial settings
        const so = this.obisOptions as unknown as { [k: string]: unknown };
        if (this.config.serialBaudRate) {
          so['transportSerialBaudrate'] = this.config.serialBaudRate;
        }
        if (this.config.serialDataBits) {
          so['transportSerialDataBits'] = this.config.serialDataBits as 5 | 6 | 7 | 8;
        }
        if (this.config.serialStopBits) {
          so['transportSerialStopBits'] = this.config.serialStopBits as 1 | 2;
        }
        if (this.config.serialParity) {
          so['transportSerialParity'] = this.config.serialParity as 'none' | 'even' | 'mark' | 'odd' | 'space';
        }

        // Basic FS existence/perm check
        try {
          if (!fs.existsSync(this.obisOptions.transportSerialPort!)) {
            this.log.warn(`[SML] Serial device does not exist: ${this.obisOptions.transportSerialPort}`);
          } else {
            const stat = fs.statSync(this.obisOptions.transportSerialPort!);
            this.d(`[SML] Serial device exists. Mode: ${stat.mode.toString(8)} Size: ${stat.size}`, 2);
          }
        } catch (e) {
          this.d(`[SML] FS check failed for serial device: ${String(e)}`, 2);
        }

        // Log validation parameters split across lines to satisfy max-len
        const logHeader = `[SML] Validating serial port ${this.obisOptions.transportSerialPort}`;
        const logDetails = '('
          + `protocol=${this.obisOptions.protocol}, `
          + `transport=${this.obisOptions.transport}, `
          + `reqInterval=${this.obisOptions.requestInterval}, `
          + `debug=${this.obisOptions.debug}, `
          + `baud=${this.config.serialBaudRate ?? ''}, `
          + `dataBits=${this.config.serialDataBits ?? ''}, `
          + `stopBits=${this.config.serialStopBits ?? ''}, `
          + `parity=${this.config.serialParity ?? ''}`
          + ')';
        this.log.debug(logHeader);
        this.log.debug(logDetails);

        const summarize = (data?: Record<string, ObisMeasurement>) => {
          const keys = data ? Object.keys(data) : [];
          const preview = keys.slice(0, 5).join(', ');
          return `keys=${keys.length}${preview ? ` [${preview}]` : ''}`;
        };

        let settled = false;
        const smTransport = SmartMeterObis.init(
          this.obisOptions,
          (error: Error | null, data?: Record<string, ObisMeasurement>) => {
            if (settled) {
              return false;
            }

            if (error) {
              this.log.error(`[SML] SmartMeter error during validate: ${error.message}`);
              smTransport.stop?.();
              settled = true;
              resolve(false);
              return false;
            }

            try {
              this.d(`[SML] validate callback data: ${summarize(data)}`, 2);
              const hasAnyData = data && Object.keys(data).length > 0;
              if (hasAnyData) {
                const getStr = (k: string) => data?.[k]?.valueToString?.();
                this.device = {
                  product_name: getStr('1-0:96.50.1*1') ?? 'Unknown',
                  product_type: getStr('1-0:96.50.1*1') ?? 'Unknown',
                  serial: getStr('1-0:96.1.0*255') ?? '',
                  firmware_version: getStr('1-0:0.2.0*0') ?? '',
                  api_version: getStr('1-0:0.2.0*0') ?? '',
                };
                this.log.info('[SML] Serial validation succeeded (first frame received).');
                smTransport.stop?.();
                settled = true;
                resolve(true);
                return true;
              }

              return false;
            } catch (e) {
              this.log.warn(`[SML] Serial validation got data but parsing failed: ${String(e)}`);
              smTransport.stop?.();
              settled = true;
              resolve(true);
              return true;
            }
          },
        );

        this.d('[SML] Starting serial processing for validation...', 1);
        smTransport.process();

        setTimeout(() => {
          if (!settled) {
            this.log.error('[SML] Timeout while validating the serial port. No data received in time.');
            smTransport.stop?.();
            settled = true;
            resolve(false);
          }
        }, 130000);
      } catch (e) {
        this.log.error(`Failed to open serial port '${this.config.serialPort}': ${String(e)}`);
        resolve(false);
      }
    });
  }

  private async initialize() {
    if (!this.validateConfig()) {
      this.log.error('Configuration error. Please provide your Power‑Meter `serialPort`.');
      return;
    }

    const ok = await this.validateSerialPort();
    if (!ok) {
      this.log.error('Your Power‑meter\'s Serial Port seems to be incorrect. No connection possible.');
      return;
    }

    this.setupAccessoires();

    await this.heartBeat();

    if (this.hbTimer) {
      clearInterval(this.hbTimer);
    }
    this.hbTimer = setInterval(() => {
      this.heartBeat();
    }, this.heartBeatInterval);
  }

  private setupAccessoires() {
    // Power Consumption
    const powerConsumptionName = 'Power Consumption';
    const powerConsumptionUuid = this.api.hap.uuid.generate(`${this.UUID_NAMESPACE}:power-consumption`);
    const powerConsumptionExistingAccessory = this.accessories.find(
      (accessory) => accessory.UUID === powerConsumptionUuid,
    );

    if (this.config.hidePowerConsumptionDevice !== true) {
      if (powerConsumptionExistingAccessory) {
        this.devices.push(
          new PowerConsumption(this.config, this.log, this.api, powerConsumptionExistingAccessory, this.device!),
        );
      } else {
        this.log.info(`${powerConsumptionName} added as accessory`);
        const accessory = new this.api.platformAccessory(powerConsumptionName, powerConsumptionUuid);
        this.devices.push(new PowerConsumption(this.config, this.log, this.api, accessory, this.device!));
        this.api.registerPlatformAccessories(this.REGISTER_PLUGIN_NAME, this.PLATFORM_NAME, [accessory]);
      }
    } else if (powerConsumptionExistingAccessory) {
      this.api.unregisterPlatformAccessories(this.REGISTER_PLUGIN_NAME, this.PLATFORM_NAME, [
        powerConsumptionExistingAccessory,
      ]);
    }

    // Power Return
    const powerReturnName = 'Power Return';
    const powerReturnUuid = this.api.hap.uuid.generate(`${this.UUID_NAMESPACE}:power-return`);
    const powerReturnExistingAccessory = this.accessories.find(
      (accessory) => accessory.UUID === powerReturnUuid,
    );

    // Hidden by default: only show when explicitly configured as not hidden (false)
    if (this.config.hidePowerReturnDevice === false) {
      if (powerReturnExistingAccessory) {
        this.devices.push(new PowerReturn(this.config, this.log, this.api, powerReturnExistingAccessory, this.device!));
      } else {
        this.log.info(`${powerReturnName} added as accessory`);
        const accessory = new this.api.platformAccessory(powerReturnName, powerReturnUuid);
        this.devices.push(new PowerReturn(this.config, this.log, this.api, accessory, this.device!));
        this.api.registerPlatformAccessories(this.REGISTER_PLUGIN_NAME, this.PLATFORM_NAME, [accessory]);
      }
    } else if (powerReturnExistingAccessory) {
      this.api.unregisterPlatformAccessories(this.REGISTER_PLUGIN_NAME, this.PLATFORM_NAME, [powerReturnExistingAccessory]);
    }

    // Energy Import (Total, kWh)
    const eImpName = 'Energy Import (Total, kWh)';
    const eImpUuid = this.api.hap.uuid.generate(`${this.UUID_NAMESPACE}:energy-import`);
    const eImpExisting = this.accessories.find(a => a.UUID === eImpUuid);
    if (eImpExisting) {
      this.dataDevices.push(new EnergyImport(this.config, this.log, this.api, eImpExisting, this.device!));
    } else {
      this.log.info(`${eImpName} added as accessory`);
      const accessory = new this.api.platformAccessory(eImpName, eImpUuid);
      this.dataDevices.push(new EnergyImport(this.config, this.log, this.api, accessory, this.device!));
      this.api.registerPlatformAccessories(this.REGISTER_PLUGIN_NAME, this.PLATFORM_NAME, [accessory]);
    }

    // Voltage L1
    const v1Name = 'Voltage L1';
    const v1Uuid = this.api.hap.uuid.generate(`${this.UUID_NAMESPACE}:voltage-l1`);
    const v1Existing = this.accessories.find(a => a.UUID === v1Uuid);
    if (v1Existing) {
      this.dataDevices.push(new VoltageSensor(this.config, this.log, this.api, v1Existing, this.device!, {
        obisKey: '1-0:32.7.0*255', name: v1Name, serialSuffix: 'voltage-l1',
      }));
    } else {
      this.log.info(`${v1Name} added as accessory`);
      const accessory = new this.api.platformAccessory(v1Name, v1Uuid);
      this.dataDevices.push(new VoltageSensor(this.config, this.log, this.api, accessory, this.device!, {
        obisKey: '1-0:32.7.0*255', name: v1Name, serialSuffix: 'voltage-l1',
      }));
      this.api.registerPlatformAccessories(this.REGISTER_PLUGIN_NAME, this.PLATFORM_NAME, [accessory]);
    }

    // Voltage L2
    const v2Name = 'Voltage L2';
    const v2Uuid = this.api.hap.uuid.generate(`${this.UUID_NAMESPACE}:voltage-l2`);
    const v2Existing = this.accessories.find(a => a.UUID === v2Uuid);
    if (v2Existing) {
      this.dataDevices.push(new VoltageSensor(this.config, this.log, this.api, v2Existing, this.device!, {
        obisKey: '1-0:52.7.0*255', name: v2Name, serialSuffix: 'voltage-l2',
      }));
    } else {
      this.log.info(`${v2Name} added as accessory`);
      const accessory = new this.api.platformAccessory(v2Name, v2Uuid);
      this.dataDevices.push(new VoltageSensor(this.config, this.log, this.api, accessory, this.device!, {
        obisKey: '1-0:52.7.0*255', name: v2Name, serialSuffix: 'voltage-l2',
      }));
      this.api.registerPlatformAccessories(this.REGISTER_PLUGIN_NAME, this.PLATFORM_NAME, [accessory]);
    }

    // Voltage L3
    const v3Name = 'Voltage L3';
    const v3Uuid = this.api.hap.uuid.generate(`${this.UUID_NAMESPACE}:voltage-l3`);
    const v3Existing = this.accessories.find(a => a.UUID === v3Uuid);
    if (v3Existing) {
      this.dataDevices.push(new VoltageSensor(this.config, this.log, this.api, v3Existing, this.device!, {
        obisKey: '1-0:72.7.0*255', name: v3Name, serialSuffix: 'voltage-l3',
      }));
    } else {
      this.log.info(`${v3Name} added as accessory`);
      const accessory = new this.api.platformAccessory(v3Name, v3Uuid);
      this.dataDevices.push(new VoltageSensor(this.config, this.log, this.api, accessory, this.device!, {
        obisKey: '1-0:72.7.0*255', name: v3Name, serialSuffix: 'voltage-l3',
      }));
      this.api.registerPlatformAccessories(this.REGISTER_PLUGIN_NAME, this.PLATFORM_NAME, [accessory]);
    }
  }

  private async heartBeat() {
    this.d('[SML] Heartbeat: starting read cycle...', 1);
    let settled = false;

    try {
      this.syncObisOptionsFromConfig();
      const summarize = (data?: Record<string, ObisMeasurement>) => {
        const keys = data ? Object.keys(data) : [];
        const preview = keys.slice(0, 3).join(', ');
        return `keys=${keys.length}${preview ? ` [${preview}]` : ''}`;
      };

      const smTransport = SmartMeterObis.init(
        this.obisOptions,
        (error: Error | null, data?: Record<string, ObisMeasurement>) => {
          if (settled) {
            return false;
          }

          if (error) {
            this.log.error(`[SML] SmartMeter read error: ${error.message}`);
            smTransport.stop?.();
            settled = true;
            return false;
          }

          try {
            this.d(`[SML] Heartbeat data: ${summarize(data)}`, 2);
            // update voltage sensors first (does not depend on power)
            try {
              if (data) {
                this.dataDevices.forEach(d => d.beatWithData(data as Record<string, ObisMeasurement>));
              }
            } catch (e) {
              this.d(`[SML] Voltage update failed: ${String(e)}`, 1);
            }

            const { value, src } = this.computeActivePower(data as Record<string, ObisMeasurement>);
            if (!Number.isFinite(value)) {
              const available = data ? Object.keys(data).slice(0, 10).join(', ') : '';
              throw new Error(`Active power not available. Known keys: ${available}`);
            }

            this.devices.forEach((device: HomebridgeObisPowerConsumptionAccessory) => {
              device.beat(value);
            });

            this.d(`[SML] Heartbeat value=${value} (src=${src})`, 1);
            smTransport.stop?.();
            settled = true;
            return true;
          } catch (e) {
            this.log.error(`[SML] Cannot read active power consumption: ${String(e)}`);
            smTransport.stop?.();
            settled = true;
            return false;
          }
        },
      );

      this.d('[SML] Starting serial processing for heartbeat...', 1);
      smTransport.process();

      setTimeout(() => {
        if (!settled) {
          this.log.error('[SML] Timeout reading active power. Check the Power‑meter Serial Port name.');
          smTransport.stop?.();
          settled = true;
        }
      }, 30000);
    } catch (error) {
      this.log.error('[SML] Something went wrong in heartbeat; please double‑check the Power‑meter Serial Port name.');
      this.log.debug(String(error));
    }
  }

  public shutdown() {
    if (this.hbTimer) {
      clearInterval(this.hbTimer);
      this.hbTimer = undefined;
    }
  }

  private floatOf(m?: ObisMeasurement): number {
    if (!m) {
      return NaN;
    }
    try {
      // Prefer parsing from valueToString so we can detect units
      if (typeof m.valueToString === 'function') {
        const s = String(m.valueToString());
        const match = s.match(/-?\d+(?:[.,]\d+)?/);
        if (match) {
          let v = Number(match[0].replace(',', '.'));
          const unit = s.toLowerCase();
          if (unit.includes('kw')) {
            v = v * 1000;
          }
          // treat plain numbers or 'w' as watts
          if (Number.isFinite(v)) {
            return v;
          }
        }
      }
      // Fallback to first numeric value in the measurement values
      const vals = typeof m.getValues === 'function' ? m.getValues() : m.values;
      if (Array.isArray(vals) && vals.length > 0) {
        const { value, unit } = vals[0] as unknown as { value: number; unit: string };
        if (Number.isFinite(value)) {
          const u = String(unit || '').toLowerCase();
          if (u.includes('kw')) {
            return value * 1000;
          }
          return value;
        }
      }
    } catch (_e) {
      // ignore parse errors
    }
    return NaN;
  }

  private computeActivePower(data?: Record<string, ObisMeasurement>): { value: number; src: string } {
    if (!data) {
      return { value: NaN, src: 'none' };
    }

    const has = (k: string) => Object.prototype.hasOwnProperty.call(data, k);
    const get = (k: string) => this.floatOf(data[k]);

    // 1) Direct net power total (16.7.0)
    const netCandidates = ['1-0:16.7.0*255', '1-0:16.7.0'];
    for (const k of netCandidates) {
      if (has(k)) {
        const v = get(k);
        if (Number.isFinite(v)) {
          return { value: v, src: k };
        }
      }
    }

    // 2) Import/export totals (1.7.0 import, 2.7.0 export)
    const importCandidates = ['1-0:1.7.0*255', '1-0:1.7.0'];
    const exportCandidates = ['1-0:2.7.0*255', '1-0:2.7.0'];
    let imp = NaN; let exp = NaN;
    for (const k of importCandidates) {
      if (has(k)) {
        const v = get(k); if (Number.isFinite(v)) {
          imp = v; break;
        }
      }
    }
    for (const k of exportCandidates) {
      if (has(k)) {
        const v = get(k); if (Number.isFinite(v)) {
          exp = v; break;
        }
      }
    }
    if (Number.isFinite(imp) || Number.isFinite(exp)) {
      const iv = Number.isFinite(imp) ? imp : 0;
      const ev = Number.isFinite(exp) ? exp : 0;
      return { value: iv - ev, src: '1.7-2.7' };
    }

    // 3) Per-phase import/export sums
    const phaseImport = ['1-0:21.7.0*255', '1-0:41.7.0*255', '1-0:61.7.0*255', '1-0:21.7.0', '1-0:41.7.0', '1-0:61.7.0'];
    const phaseExport = ['1-0:22.7.0*255', '1-0:42.7.0*255', '1-0:62.7.0*255', '1-0:22.7.0', '1-0:42.7.0', '1-0:62.7.0'];
    const sumKeys = (keys: string[]) => keys.reduce((acc, k) => acc + (Number.isFinite(get(k)) ? get(k) : 0), 0);
    const impSum = sumKeys(phaseImport);
    const expSum = sumKeys(phaseExport);
    if (impSum > 0 || expSum > 0) {
      return { value: impSum - expSum, src: 'phase-import-export' };
    }

    // 4) Fallback: some meters expose L1/L2/L3 instantaneous as 36/56/76
    const phaseAlt = ['1-0:36.7.0*255', '1-0:56.7.0*255', '1-0:76.7.0*255', '1-0:36.7.0', '1-0:56.7.0', '1-0:76.7.0'];
    const altSum = sumKeys(phaseAlt);
    if (altSum !== 0) {
      return { value: altSum, src: 'phases-sum-alt' };
    }

    return { value: NaN, src: 'not-found' };
  }
}
