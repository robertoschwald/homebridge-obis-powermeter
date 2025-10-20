import type {API, PlatformAccessory, Logger} from 'homebridge';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * EnergyHistory class to manage energy history using Fakegato.
 * Uses default Fakegato hostname_accessory_persist.json naming for continuity.
 */
export class EnergyHistory {
  private history?: InstanceType<FakegatoCtor>;
  private readonly log: Logger;
  private readonly storagePath: string;
  private readonly api: API; // store to access globalFakeGatoTimer
  private forcedInitialFlush = false;

  constructor(
    api: API,
    accessory: PlatformAccessory,
    log: Logger,
    storagePath: string,
    minutesValue = 10,
  ) {
    this.log = log;
    this.storagePath = storagePath;
    this.api = api;

    // Ensure storage path exists (Fakegato silently fails writes if the path is missing)
    try {
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
        this.log.warn(`[Fakegato] Created missing history storage directory: ${storagePath}`);
      }
    } catch (e) {
      this.log.error(`[Fakegato] Cannot create history storage directory '${storagePath}': ${String(e)}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fgFactory = require('fakegato-history') as (api: API) => FakegatoCtor;
    const FakeGatoHistoryService = fgFactory(api);

    // Do NOT override filename so the default <hostname>_<accessoryName>_persist.json is used.
    this.history = new FakeGatoHistoryService('energy', accessory, {
      storage: 'fs',
      path: storagePath,
      minutes: Number.isFinite(minutesValue) && minutesValue > 0 ? minutesValue : 10,
      log: this.log,
      disableRepeatLastData: true,
    });
    this.log.debug?.(`Fakegato energy history initialized (minutes=${minutesValue}, default persist naming, path=${storagePath})`);

    // Schedule a check to warn if file still not present after first expected flush window
    const checkDelayMs = (minutesValue <= 2 ? 150000 : minutesValue * 60 * 1000 + 30000); // minutes + 30s grace
    setTimeout(() => {
      try {
        const expectedSuffix = '_persist.json';
        const hostPrefix = os.hostname().split('.')[0];
        const expectedNamePart = `${hostPrefix}_${accessory.displayName}`; // Fakegato uses raw accessoryName with spaces
        const files = fs.readdirSync(this.storagePath).filter(f => f.endsWith(expectedSuffix));
        const match = files.find(f => f.startsWith(expectedNamePart));
        if (!match) {
          this.log.warn(
            `[Fakegato] No energy history persist file detected yet in '${this.storagePath}'. ` +
            `Expected startsWith='${expectedNamePart}', files present: ${files.join(', ') || 'none'}`,
          );
        } else {
          this.log.debug?.(`[Fakegato] Detected energy history file: ${path.join(this.storagePath, match)}`);
        }
      } catch (e) {
        this.log.warn(`[Fakegato] Error checking energy history file existence: ${String(e)}`);
      }
    }, checkDelayMs);
  }

  add(powerW: number, energykWh: number): void {
    if (!this.history) {
      return;
    }
    const entryPower = Number.isFinite(powerW) ? powerW : 0;
    const entryEnergy = Number.isFinite(energykWh) ? energykWh : 0;
    const time = Math.round(Date.now() / 1000);
    this.history.addEntry({ time, power: entryPower, energy: entryEnergy });
    this.log.debug?.(`Fakegato energy sample queued: time=${time} power=${entryPower}W energy=${entryEnergy}kWh`);

    // Force a one-time immediate flush after first sample
    if (!this.forcedInitialFlush) {
      this.forcedInitialFlush = true;
      try {
        const timer = (this.api as unknown as { globalFakeGatoTimer?: { executeCallbacks?: () => void } }).globalFakeGatoTimer;
        if (timer?.executeCallbacks) {
          timer.executeCallbacks();
          this.log.debug?.('[Fakegato] Forced initial energy history flush executed');
        } else {
          // Retry shortly if timer not yet set up
          setTimeout(() => {
            try {
              const lateTimer = (this.api as unknown as { globalFakeGatoTimer?: { executeCallbacks?: () => void } }).globalFakeGatoTimer;
              lateTimer?.executeCallbacks?.();
              this.log.debug?.('[Fakegato] Forced initial energy history flush executed (delayed)');
            } catch (e) {
              this.log.debug?.(`[Fakegato] Delayed initial energy flush failed: ${String(e)}`);
            }
          }, 2000);
        }
      } catch (e) {
        this.log.debug?.(`[Fakegato] Initial energy flush attempt failed: ${String(e)}`);
      }
    }
  }
}

type FakegatoCtor = new (
  type: 'energy',
  accessory: PlatformAccessory,
  opts: { storage: 'fs'; path: string; minutes?: number; log?: Logger; disableRepeatLastData?: boolean }
) => { addEntry: (entry: { time: number; power?: number; energy?: number }) => void };
