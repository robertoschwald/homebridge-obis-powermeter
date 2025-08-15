import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { API, Logger } from 'homebridge';
import { HomebridgeObisPowerConsumption } from '../Platform';
import SmartMeterObis from 'smartmeter-obis';

describe('HomebridgeSmlPowerConsumption', () => {
    let log: Logger;
    let config: any;
    let api: API;
    let platform: HomebridgeObisPowerConsumption;

    beforeEach(() => {
        log = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as unknown as Logger;

        config = {
            serialPort: '/dev/ttyUSB0',
            pollInterval: 60,
        } as any;

        api = {
            hap: {
                Service: {} as any,
                Characteristic: {} as any,
                uuid: {
                    generate: jest.fn((name: string) => `uuid-${name}`),
                },
            },
            platformAccessory: jest.fn() as any,
            registerPlatformAccessories: jest.fn() as any,
            unregisterPlatformAccessories: jest.fn() as any,
            on: jest.fn(), // do not auto-trigger initialize
        } as unknown as API;

        platform = new HomebridgeObisPowerConsumption(log, config, api);
    });

    afterEach(() => {
        // ensure timers/handles are cleaned up so Jest can exit
        (platform as any).shutdown?.();
        jest.clearAllTimers();
    });

    it('validates configuration', () => {
        expect((platform as any).validateConfig()).toBe(true);
        (platform as any).config.serialPort = '';
        expect((platform as any).validateConfig()).toBe(false);
    });

    it('handles invalid serial port during validation (init throws)', async () => {
        jest.spyOn(SmartMeterObis as any, 'init').mockImplementation(() => {
            throw new Error('open failed');
        });

        const result = await (platform as any).validateSerialPort();
        expect(result).toBe(false);
        expect((log.error as any)).toHaveBeenCalledWith(
            expect.stringContaining('Failed to open serial port'),
        );
    });

    it('initializes with valid configuration', async () => {
        jest.spyOn(platform as any, 'validateConfig').mockReturnValue(true);
        jest.spyOn(platform as any, 'validateSerialPort').mockResolvedValue(true);
        jest.spyOn(platform as any, 'setupAccessoires').mockImplementation(() => undefined);
        jest.spyOn(platform as any, 'heartBeat').mockResolvedValue(undefined);

        await (platform as any).initialize();

        expect(log.error).not.toHaveBeenCalled();
        expect((platform as any).setupAccessoires).toHaveBeenCalled();
        expect((platform as any).heartBeat).toHaveBeenCalled();
    });

    it('logs error if configuration is invalid', async () => {
        jest.spyOn(platform as any, 'validateConfig').mockReturnValue(false);

        await (platform as any).initialize();

        expect(log.error).toHaveBeenCalledWith(
            'Configuration error. Please provide your Power‑Meter `serialPort`.',
        );
    });

    it('logs error if serial port validation fails', async () => {
        jest.spyOn(platform as any, 'validateConfig').mockReturnValue(true);
        jest.spyOn(platform as any, 'validateSerialPort').mockResolvedValue(false);

        await (platform as any).initialize();

        expect(log.error).toHaveBeenCalledWith(
            'Your Power‑meter\'s Serial Port seems to be incorrect. No connection possible.',
        );
    });
});