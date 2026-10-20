# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/) dan [SemVer](https://semver.org/lang/id/).

## [Unreleased]

## [0.2.0] - 2026-10-20

> Draft untuk direview orang.

### Added
- Status setoran `PENDING` dan `REVERSED`, validator `actor` dan `reason`, tabel `deposit_events`.
- Helper ledger `hasEntries` dan `postReversalEntries` (entri pembalik, ref `/REV`).
- Alur `markPending`, resolve (PENDING menjadi POSTED), dan reverse (PENDING menjadi REVERSED dengan entri pembalik).
- Endpoint API pending, resolve, dan reverse.

### Changed
- `cancel` kini punya guard untuk setoran `PENDING`.

### Fixed
- Status `POSTED` dari `COUNTED`; retry CRM dengan STAN sama tidak memposting ulang (INC-2026-1014-01).
- Jaring pengaman reverse untuk ref ambigu dan perbaikan minor review.
