# Baseline skill add-deposit-rule (Lab 10)

Prompt: "Tambahkan aturan baru: setoran ditolak jika total nominal lebih dari Rp 15.000.000 per transaksi."
Kondisi: tanpa skill, dari tag lab9-selesai, 3 execution (claude -p, Claude Code 2.1.304, 20 Okt 2026).

| Cek | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| Test ditulis sebelum src/ | tidak | tidak | tidak |
| Test baru terlihat gagal (RED) | tidak | tidak | tidak |
| Test API untuk HTTP status | tidak | tidak | tidak |
| Test lama yang bertentangan disebut di awal | tidak (di akhir) | tidak (di akhir) | tidak (di akhir) |
| Aturan di src/domain, konstanta di money.ts | ya | ya | ya |
| Ledger tidak disentuh | ya | ya | ya |
| npx vitest run + npm run typecheck | ya | ya | ya |

Kesimpulan: skill perlu mengatur urutan kerja (test dulu, RED, GREEN), test API, dan cara melaporkan test lama yang diubah.
