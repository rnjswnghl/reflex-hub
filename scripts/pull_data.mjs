// Vercel Blob에 저장된 세션 JSON을 data/raw/sessions/ 로 내려받는다.
// 이미 있는 파일은 덮어쓰지 않는다(원자료 불변). 내려받은 목록은 data/raw/pull-log.jsonl에 누적 기록한다.
//
// 실행: BLOB_READ_WRITE_TOKEN=... node scripts/pull_data.mjs
//   토큰은 Vercel 대시보드 → Storage → 해당 Blob 스토어 → .env.local 탭에서 확인.
//   (또는 web/ 에서 `vercel env pull` 후 .env.local 의 값을 사용)
//   @vercel/blob 은 web/node_modules 의 것을 쓴다: 먼저 `cd web && npm install`.
import { createRequire } from 'node:module';
import { mkdir, writeFile, appendFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'web/package.json'));
const { list } = await import(pathToFileURL(require.resolve('@vercel/blob')).href);

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN 환경변수가 필요합니다.');
  process.exit(1);
}

const outDir = join(ROOT, 'data/raw/sessions');
const exists = (p) => access(p).then(() => true, () => false);
let cursor;
let fetched = 0;
let skipped = 0;
do {
  const page = await list({ prefix: 'sessions/', cursor, limit: 1000 });
  for (const b of page.blobs) {
    const dest = join(outDir, b.pathname.replace(/^sessions\//, ''));
    if (await exists(dest)) {
      skipped++;
      continue;
    }
    const res = await fetch(b.url);
    if (!res.ok) throw new Error(`${b.pathname}: HTTP ${res.status}`);
    const text = await res.text();
    JSON.parse(text); // 깨진 파일이면 여기서 멈춘다
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, text, { flag: 'wx' });
    await appendFile(
      join(ROOT, 'data/raw/pull-log.jsonl'),
      JSON.stringify({ pulled_at: new Date().toISOString(), pathname: b.pathname, size: b.size, uploaded_at: b.uploadedAt }) + '\n',
    );
    fetched++;
  }
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);

console.log(`new=${fetched} already_present=${skipped} → ${outDir}`);
