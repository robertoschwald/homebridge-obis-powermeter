import type {API, PlatformAccessory, Logger} from 'homebridge';

/**
 * EnergyHistory class to manage energy history using Fakegato.
 * It uses the 'fakegato-history' library to store energy data.
 * The history is stored in the file system at the specified path.
 */
export class EnergyHistory {
  private history?: InstanceType<FakegatoCtor>;
  private readonly log: Logger;

  constructor(
    api: API,
    accessory: PlatformAccessory,
    log: Logger,
    storagePath: string,
  ) {
    this.log = log;

    // Lazy require to avoid type issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fgFactory = require('fakegato-history') as (api: API) => FakegatoCtor;
    const FakeGatoHistoryService = fgFactory(api);

    this.history = new FakeGatoHistoryService('energy', accessory, {
      storage: 'fs',
      path: storagePath,
    });
    this.log.debug?.('Fakegato energy history initialized');
  }

  add(powerW: number, energykWh: number): void {
    if (!this.history) {
      return;
    }
    // time is seconds since epoch, power in W, energy in kWh
    this.history.addEntry({
      time: Math.round(Date.now() / 1000),
      power: Number.isFinite(powerW) ? powerW : 0,
      energy: Number.isFinite(energykWh) ? energykWh : 0,
    });
  }
}

type FakegatoCtor = new (
  type: 'energy',
  accessory: PlatformAccessory,
  opts: { storage: 'fs'; path: string }
) => {
  addEntry: (entry: { time: number; power?: number; energy?: number }) => void;
};