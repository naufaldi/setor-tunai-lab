#!/usr/bin/env bash
# Daftar commit sejak tag v* terakhir; jika belum ada tag, 15 commit terakhir.
r=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null)
if [ -n "$r" ]; then
  echo "Sejak tag $r:"
  git log --oneline "$r"..HEAD
else
  echo "Belum ada tag v*, 15 commit terakhir:"
  git log --oneline -15
fi
