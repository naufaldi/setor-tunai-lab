# Catatan token Sesi 4 Part 1

Lab 1 menyelesaikan insiden `docs/insiden/INC-2026-1014-01.md` secara efisien. Baris Baseline dan RTK diisi trainer sebagai pembanding, peserta mengisi baris Lab 1.
Angka diambil dari panel Context atau usage ring di Claude desktop, `/context`, dan `rtk gain`.

| Baris | Yang diubah | Context awal | Context akhir | Memory files (/context) | rtk gain | Catatan |
|---|---|---|---|---|---|---|
| Baseline (trainer) | Prompt umum, CLAUDE.md 176 baris, tanpa RTK | 47,3k | 64,2k | 4,9k | - | 9 request, total input 505k token (3 execution: 453k sampai 609k) |
| RTK (trainer) | + hook RTK, prompt sama dengan baseline | 47,5k | 67,5k | 4,9k | 5,7k token hemat (44%) | 9 request, total input 523k token (3 execution: 470k sampai 601k) |
| Lab 1 (peserta) | + RTK, lean CLAUDE.md, subagent log-analyst, prompt spesifik | 44,4k | 54,5k | 0,9k | aktif | 6 request, total input 307k token + 45k di subagent Haiku (execution trainer 19 Okt 2026) |
