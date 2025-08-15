import { API } from 'homebridge';
import { HomebridgeSmlPowerConsumption } from './Platform';

const PLUGIN_NAME = 'homebridge-obis-powermeter';
const PLATFORM_NAME = 'SML';

export = (api: API) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, HomebridgeSmlPowerConsumption);
};