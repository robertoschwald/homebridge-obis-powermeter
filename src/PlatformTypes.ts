import { PlatformAccessory } from 'homebridge';

export interface HomebridgeSmlPowerConsumptionAccessory {
    accessory: PlatformAccessory;
    displayName?: string;
    beat(consumption: number): void;
}

export interface HomebridgeSmlDevice {
    product_name: string;
    product_type: string;
    serial: string;
    firmware_version: string;
    api_version: string;
}