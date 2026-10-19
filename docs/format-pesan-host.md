# Catatan format pesan host (referensi)

| Field | Nama | Keterangan |
|---|---|---|
| MTI | Message type | 0200 request, 0210 response |
| 2 | PAN | nomor kartu, selalu di-mask |
| 3 | Processing code | 21xxxx untuk setor tunai |
| 4 | Amount | 12 digit, tanpa desimal |
| 7 | Transmission date time | MMDDhhmmss |
| 11 | STAN | 6 digit, unik per terminal per hari |
| 12 | Local time | hhmmss |
| 13 | Local date | MMDD |
| 32 | Acquirer ID | kode bank |
| 37 | RRN | 12 karakter |
| 39 | Response code | 00 approve, 51 dana tidak cukup, 91 issuer down |
| 41 | Terminal ID | ATM-NNNN |
| 49 | Currency | 360 (IDR) |
| 102 | Account | rekening tujuan |

- Response code 00: Approved. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 05: Do not honor. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 12: Invalid transaction. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 13: Invalid amount. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 14: Invalid account. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 30: Format error. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 51: Insufficient funds. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 55: Incorrect PIN. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 57: Not permitted. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 58: Not permitted terminal. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 61: Exceeds limit. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 68: Response received too late. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 76: Invalid account. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 91: Issuer inoperative. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 94: Duplicate transmission. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 96: System malfunction. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
