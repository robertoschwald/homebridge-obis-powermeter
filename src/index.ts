'use strict';

import { API } from 'homebridge';
import { HomebridgeSmlPowerConsumption } from './Platform';

export = (api: API) => {
  api.registerPlatform('HomebridgeSmlPowerConsumption', HomebridgeSmlPowerConsumption);
};