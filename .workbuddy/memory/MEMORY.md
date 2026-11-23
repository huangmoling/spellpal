
## 例句流水线硬约定（0.19.0）

- **`build-books.mjs` 的 BOOKS 键 ≠ 输出 id**：`pep-3a` → `pep-3start-3a`（7 册 PEP 皆是）。
  句子源文件与 `sentences-*.tsv` 必须用**键**命名，用输出 id 命名会静默读到 0 句。
- 改例句三步缺一不可：改 `scripts/data/_src/tb2027/{键}.sent.src.tsv`（3 列）→
  `python scripts/data/_src/tb2027/annotate.py {键}` → `node scripts/build-books.mjs`。
- 手写例句配方：一册 100~140 词 ≈ 60~80 句，每句覆盖 2~3 个目标词，中文按自然语序写。
  覆盖率用 `.tmp/coverage.mjs` 验，目标 100%。
- `tb2text` 里 19 个文件是 OCR 空页（bj-2a/4b、bsd 全 9 册、cj-5a/6a、jj-4b、jk-3b、
  qh-2a/2b/4a/6a、yl-4b），抽不出真句，只能手写。
