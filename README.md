# Homebridge SML Smart Meter

Read real-time active power from SML/D0 smart meters and expose it to HomeKit as simple sensors.

- Power Consumption: shows net import power (W)
- Power Return (optional): shows export power (W). Hidden by default.
- Voltage L1/L2/L3: shows per-phase voltages (V).

Powered by smartmeter-obis (SML and D0 protocols).

D0 should theoretically work, but is completely untested. If you have a D0 meter, please try it out and report any issues.

## Requirements
- Node.js >= 20
- Homebridge >= 1.8
- A supported SML/D0 interface on your meter (e.g. IR head via USB)

## Install
```bash
npm i -g homebridge-sml
```

## Configure
Use Homebridge UI (recommended) or edit config.json. Platform name is SML.

Minimal example:
```json
{
  "platform": "SML",
  "serialPort": "/dev/ttyUSB0"
}
```

Full example with options:
```json
{
  "platform": "SML",
  "serialPort": "/dev/ttyUSB0",
  "protocol": "SmlProtocol",
  "serialBaudRate": 9600,
  "serialDataBits": 8,
  "serialStopBits": 1,
  "serialParity": "none",
  "pollInterval": 60,
  "hidePowerConsumptionDevice": false,
  "hidePowerReturnDevice": true,
  "debugLevel": 0
}
```
Notes:
- Power Return is hidden by default. Set hidePowerReturnDevice to false to show it.
- Voltage sensors (L1/L2/L3) are always enabled.
- protocol can be SmlProtocol (default) or D0Protocol.
- You can also set SML_DEBUG=0|1|2 in the child bridge environment for extra logs.

## What values are shown?
The plugin computes net active power (in watts) from your meter and feeds it to both accessories. Power Consumption displays it when > 0 (import). Power Return displays the absolute value when net < 0 (export).

Priority of OBIS sources (first available wins):
1) 1-0:16.7.0 (or 1-0:16.7.0*255) — total instantaneous active power
2) 1-0:1.7.0 (import) minus 1-0:2.7.0 (export)
3) Sum of per-phase import (21.7.0/41.7.0/61.7.0) minus export (22.7.0/42.7.0/62.7.0)
4) Sum of 36.7.0/56.7.0/76.7.0 as a fallback

Voltage sensors map directly to:
- L1: 1-0:32.7.0*255
- L2: 1-0:52.7.0*255
- L3: 1-0:72.7.0*255

Units: kW -> W for power, kV -> V for voltage; otherwise values are used as-is.

HomeKit service used: CurrentAmbientLightLevel (Light Sensor). Values are always >= 0.0001 as required by HomeKit. Accessories are categorized as SENSOR to avoid bulb icons in some clients.

## Troubleshooting
- Serial device not found: verify the serialPort path (prefer /dev/serial/by-id on Linux) and permissions.
- No readings / timeouts: confirm protocol matches your meter; try increasing pollInterval; check logs.
- D0 meters: you may need different baud rate/parity according to your device.
- Debugging: set debugLevel to 1 or 2 or use SML_DEBUG env var on the child bridge.
- Icon looks wrong: remove cached accessories in Homebridge UI and restart Homebridge.

## Development
- Build: `npm run build`
- Watch & link for Homebridge dev: `npm run watch`
- Tests: `npm test`

Project structure:
- src/Platform.ts — platform and meter reading
- src/Accessories/PowerConsumption.ts — consumption accessory
- src/Accessories/PowerReturn.ts — export accessory (optional)
- src/Accessories/VoltageSensor.ts — per-phase voltage accessories

## Roadmap
- [ ] Support D0 protocol (untested)
- [ ] Add more OBIS sources (e.g. 1-0:31.7.0 for total active power)
- [ ] Improve error handling and logging
- [ ] Add unit tests for OBIS parsing and HomeKit integration
- [ ] Add support for multiple meters (e.g. via multiple serial ports)
- [ ] Support for Homebridge v2
- [ ] Support for other transport protocols (TCP/IP, LocalFile, StdIn if needed)
- [ ] Support of JsonEfrProtocol for EFR Smart Grid Hub devices (JSON)

## License
Apache-2.0
