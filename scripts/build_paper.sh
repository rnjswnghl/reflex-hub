#!/usr/bin/env bash
# 논문 PDF 빌드: XeLaTeX → BibTeX → XeLaTeX ×2. 결과: paper/build/main.pdf
# 결과 수치(paper/generated/results.tex)가 없으면 '데이터 대기' 표시가 붙은 원고가 나온다.
set -euo pipefail
cd "$(dirname "$0")/../paper"
mkdir -p build
run() { xelatex -interaction=nonstopmode -halt-on-error -output-directory=build main.tex >build/xelatex.log 2>&1 || { tail -40 build/xelatex.log; exit 1; }; }
run
BIBINPUTS=.: bibtex build/main >build/bibtex.log 2>&1 || { cat build/bibtex.log; exit 1; }
run
run
if grep -q "There were undefined references\|Citation .* undefined" build/main.log; then
  echo "경고: 정의되지 않은 참조/인용이 있습니다 (build/main.log)"; grep -E "undefined" build/main.log | head
fi
echo "built: paper/build/main.pdf ($(pdfinfo build/main.pdf 2>/dev/null | awk '/Pages/{print $2}') pages)"
