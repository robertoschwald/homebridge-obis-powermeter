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
    minutesValue = 10,
  ) {
    this.log = log;

    // Lazy require to avoid type issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fgFactory = require('fakegato-history') as (api: API) => FakegatoCtor;
    const FakeGatoHistoryService = fgFactory(api);

    // Provide a stable filename (avoid depending solely on accessory UUID)
    const safeName = accessory.displayName?.replace(/[^a-z0-9-_]/gi, '_') || 'powermeter';

    this.history = new FakeGatoHistoryService('energy', accessory, {
      storage: 'fs',
      path: storagePath,
      minutes: Number.isFinite(minutesValue) && minutesValue > 0 ? minutesValue : 10,
      filename: `history_${safeName}.json`,
      log: this.log,
      disableRepeatLastData: true,
    });
    this.log.debug?.(`Fakegato energy history initialized (minutes=${minutesValue}, file=history_${safeName}.json)`);
  }

  add(powerW: number, energykWh: number): void {
    if (!this.history) {
      return;
    }
    const entryPower = Number.isFinite(powerW) ? powerW : 0;
    const entryEnergy = Number.isFinite(energykWh) ? energykWh : 0;
    const time = Math.round(Date.now() / 1000);
    this.history.addEntry({
      time,
      power: entryPower,
      energy: entryEnergy,
    });
    // Debug trace to help diagnose persist issues
    this.log.debug?.(`Fakegato sample added: time=${time} power=${entryPower}W energy=${entryEnergy}kWh`);
  }
}

type FakegatoCtor = new (
  type: 'energy',
  accessory: PlatformAccessory,
  opts: { storage: 'fs'; path: string; minutes?: number; filename?: string; log?: Logger; disableRepeatLastData?: boolean }
) => {
  addEntry: (entry: { time: number; power?: number; energy?: number }) => void;
};