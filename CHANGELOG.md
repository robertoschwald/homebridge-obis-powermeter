# Changelog

All notable changes to this project will be documented in this file.

## [1.0.3-dev] - 2025-09-07
### Added
- Power and Voltage history (Eve App) using Fakegato.
- Homebridge 1.8.0 compatibility.
- Stable LightSensor service subtypes for all accessories (migration logic keeps legacy services).

### Changed
- Minor refactor in accessories to reuse existing LightSensor services when present.

### Fixed
- Resolved Homebridge error: duplicate `CurrentAmbientLightLevel` characteristic (UUID 0000006B...) by preventing duplicate service/characteristic additions.
- Fixed ESLint max-len warnings in `EnergyImport.ts` and `VoltageSensor.ts`.

## [1.0.2] - 2025-08-31
### Added
- First Homebridge compliant version.
- Support for OBIS smart meter devices (SML/D0) to read power, energy, and voltages.

### Changed
- None

### Fixed
- Various fixes for Homebridge compliance.

## [1.0.1] - 2025-08-16
### Added
- Fixes for Homebridge compliance.

### Changed
- None

### Fixed
- Minor fixes before Homebridge compliance.

---

Older versions and future changes should be added above this line.
