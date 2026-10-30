#!/usr/bin/env bash
# 제출용 ZIP 하나를 만든다 (T10-C48). 점검을 통과하지 못하면 만들지 않는다.
#   bash scripts/package.sh            → submission/reflex-hub-T10.zip
#   bash scripts/package.sh --draft    → 점검 실패해도 만들되 파일명에 DRAFT (제출 불가, 공유·검토용)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
NAME="reflex-hub-T10"
if [[ "${1:-}" == "--draft" ]]; then
  NAME="$NAME-DRAFT"
  python3 scripts/check_submission.py || echo "(초안 모드: 점검 실패 항목이 있어도 계속)"
else
  python3 scripts/check_submission.py
fi

OUT="$ROOT/submission"
STAGE="$(mktemp -d)/$NAME"
mkdir -p "$STAGE" "$OUT"

# 논문
mkdir -p "$STAGE/paper"
cp paper/build/main.pdf "$STAGE/논문_reflex-hub.pdf" 2>/dev/null || true
cp -r paper/main.tex paper/meta.tex paper/pending.tex paper/refs.bib paper/sections "$STAGE/paper/"
[[ -d paper/generated ]] && cp -r paper/generated "$STAGE/paper/"
[[ -d paper/figures ]] && cp -r paper/figures "$STAGE/paper/"

# 원자료·분석·실험 코드·문서
mkdir -p "$STAGE/data"
[[ -d data/raw ]] && cp -r data/raw "$STAGE/data/"
rsync -a --exclude '__pycache__' --exclude 'tests/__pycache__' analysis "$STAGE/"
rsync -a --exclude node_modules --exclude dist --exclude '.vercel' --exclude '.env*' web "$STAGE/"
cp -r docs scripts "$STAGE/"
cp README.md REPRODUCE.md "$STAGE/"

# 빠진 파일 확인용 목록
(cd "$STAGE" && find . -type f | sort > MANIFEST.txt)

rm -f "$OUT/$NAME.zip"
(cd "$(dirname "$STAGE")" && zip -qr "$OUT/$NAME.zip" "$NAME")
echo "packaged: submission/$NAME.zip ($(du -h "$OUT/$NAME.zip" | cut -f1), $(wc -l < "$STAGE/MANIFEST.txt") files)"
