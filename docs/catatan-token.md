# Catatan token Sesi 4 Part 1

Isi satu baris setelah setiap lab. Angka diambil dari usage ring di Claude desktop, `/context`, dan `rtk gain`.
Tugas yang sama di setiap lab: insiden `docs/insiden/INC-2026-1014-01.md`.

| Lab | Yang diubah | Context awal | Context akhir | Memory files (/context) | rtk gain | Catatan |
|---|---|---|---|---|---|---|
| 1 | Baseline: prompt umum, CLAUDE.md panjang, tanpa RTK | 47,3k | 64,2k | 4,9k | - | 9 request, total input 505k token. Claude memakai grep dan tail sendiri. |
| 2 | + RTK (hook PreToolUse) | 47,5k | 67,5k | 4,9k | 5,7k token hemat (44%), 32 command | 9 request, total input 523k token. Claude membaca lebih banyak file. |
| 3 | + prompt spesifik, CLAUDE.md ramping, subagent log-analyst | 44,4k | 54,5k | 0,9k | aktif | 6 request, total input 307k token + 45k di subagent Haiku. |
