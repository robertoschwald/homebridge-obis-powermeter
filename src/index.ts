import { API } from 'homebridge';
import { HomebridgeObisPowerConsumption } from './Platform';

const PLUGIN_NAME = 'homebridge-obis-powermeter';
const PLATFORM_NAME = 'OBIS';

export = (api: API) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, HomebridgeObisPowerConsumption);
};