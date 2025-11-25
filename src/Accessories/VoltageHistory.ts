import type { API, PlatformAccessory, Logger } from 'homebridge';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * VoltageHistory stores voltage samples using Fakegato 'custom' history type.
 * Uses default Fakegato hostname_accessory_persist.json naming.
 */
export class VoltageHistory {
  private history?: InstanceType<FakegatoCtor>;
  private readonly log: Logger;
  private readonly storagePath: string;
  private readonly api: API; // access globalFakeGatoTimer
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
    // Ensure directory exists
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

    // Do not set filename to keep default persist naming (<hostname>_<accessoryName>_persist.json)
    this.history = new FakeGatoHistoryService('custom', accessory, {
      storage: 'fs',
      path: storagePath,
      minutes: Number.isFinite(minutesValue) && minutesValue > 0 ? minutesValue : 10,
      log: this.log,
      disableRepeatLastData: true,
    });
    this.log.debug?.(`Fakegato voltage history initialized (minutes=${minutesValue}, default persist naming, path=${storagePath})`);

    // Delayed check for file creation after first flush window
    const checkDelayMs = (minutesValue <= 2 ? 150000 : minutesValue * 60 * 1000 + 30000);
    setTimeout(() => {
      try {
        const suffix = '_persist.json';
        const hostPrefix = os.hostname().split('.')[0];
        const expectedNamePart = `${hostPrefix}_${accessory.displayName}`;
        const files = fs.readdirSync(this.storagePath).filter(f => f.endsWith(suffix));
        const match = files.find(f => f.startsWith(expectedNamePart));
        if (!match) {
          this.log.warn(
            `[Fakegato] No voltage history persist file yet in '${this.storagePath}'. ` +
            `Expected startsWith='${expectedNamePart}', files: ${files.join(', ') || 'none'}`,
          );
        } else {
          this.log.debug?.(`[Fakegato] Detected voltage history file: ${path.join(this.storagePath, match)}`);
        }
      } catch (e) {
        this.log.warn(`[Fakegato] Error checking voltage history file existence: ${String(e)}`);
      }
    }, checkDelayMs);
  }

  add(voltage: number): void {
    if (!this.history) {
      return;
    }
    const time = Math.round(Date.now() / 1000);
    const value = Number.isFinite(voltage) ? voltage : 0;
    this.history.addEntry({ time, lux: value });
    this.log.debug?.(`Fakegato voltage sample queued: time=${time} voltage=${value}V`);

    if (!this.forcedInitialFlush) {
      this.forcedInitialFlush = true;
      try {
        const timer = (this.api as unknown as { globalFakeGatoTimer?: { executeCallbacks?: () => void } }).globalFakeGatoTimer;
        if (timer?.executeCallbacks) {
          timer.executeCallbacks();
          this.log.debug?.('[Fakegato] Forced initial voltage history flush executed');
        } else {
          setTimeout(() => {
            try {
              const lateTimer = (this.api as unknown as { globalFakeGatoTimer?: { executeCallbacks?: () => void } }).globalFakeGatoTimer;
              lateTimer?.executeCallbacks?.();
              this.log.debug?.('[Fakegato] Forced initial voltage history flush executed (delayed)');
            } catch (e) {
              this.log.debug?.(`[Fakegato] Delayed initial voltage flush failed: ${String(e)}`);
            }
          }, 2000);
        }
      } catch (e) {
        this.log.debug?.(`[Fakegato] Initial voltage flush attempt failed: ${String(e)}`);
      }
    }
  }
}

type FakegatoCtor = new (
  type: 'custom',
  accessory: PlatformAccessory,
  opts: { storage: 'fs'; path: string; minutes?: number; log?: Logger; disableRepeatLastData?: boolean }
) => { addEntry: (entry: { time: number; lux?: number }) => void };
