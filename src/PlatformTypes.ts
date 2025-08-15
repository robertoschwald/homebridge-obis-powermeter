import { PlatformAccessory } from 'homebridge';
import type { ObisMeasurement } from 'smartmeter-obis';

export interface HomebridgeObisPowerConsumptionAccessory {
    accessory: PlatformAccessory;
    displayName?: string;
    beat(consumption: number): void;
}

export interface HomebridgeObisDataAccessory {
    accessory: PlatformAccessory;
    displayName?: string;
    beatWithData(data: Record<string, ObisMeasurement>): void;
}

export interface HomebridgeObisDevice {
    product_name: string;
    product_type: string;
    serial: string;
    firmware_version: string;
    api_version: string;
}