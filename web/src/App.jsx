import { useEffect, useRef, useState } from 'react';
import { CONFIG } from './experiment/config.js';
import { buildSequence } from './experiment/sequence.js';
import { createRunner, estimateFrameMs } from './experiment/runner.js';
import {
  collectMeta,
  downloadBackup,
  flushPending,
  isPilot,
  markCompleted,
  markStarted,
  personalSummary,
  previousCompletion,
  savePending,
  submit,
} from './experiment/session.js';

const AGE_BANDS = ['10대', '20대', '30대', '40대', '50대 이상'];
const TOTAL_PRACTICE = 2 * (CONFIG.practicePerCondition + CONFIG.practiceCatchPerCondition);
const TOTAL_MAIN = 2 * (CONFIG.mainPerCondition + CONFIG.mainCatchPerCondition);
const SAW_CUE = [
  ['yes', '네, 봤어요'],
  ['no', '아니요, 못 봤어요'],
  ['unsure', '잘 모르겠어요'],
];

export default function App() {
  const [screen, setScreen] = useState('intro');
  const [ageBand, setAgeBand] = useState('');
  const [agree, setAgree] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: TOTAL_MAIN });
  const [result, setResult] = useState(null);
  const [upload, setUpload] = useState('idle'); // idle | sending | ok | fail
  const session = useRef({ meta: null, trials: [], seq: [] });
  const stageRef = useRef(null);
  const cueRef = useRef(null);
  const targetRef = useRef(null);
  const feedbackRef = useRef(null);
  const repeat = useRef(Boolean(previousCompletion()));

  useEffect(() => {
    flushPending();
  }, []);

  async function start() {
    const estFrameMs = await estimateFrameMs();
    const meta = collectMeta({ ageBand, estFrameMs });
    session.current = { meta, trials: [], seq: buildSequence() };
    markStarted(meta.session_id);
    setScreen('howto');
  }

  async function runBlock(block) {
    setScreen(block);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const runner = createRunner({
      stage: stageRef.current,
      cueFrame: cueRef.current,
      target: targetRef.current,
      feedback: feedbackRef.current,
    });
    const trials = session.current.seq.filter((t) => t.block === block);
    try {
      for (let i = 0; i < trials.length; i++) {
        const row = await runner.runTrial(trials[i]);
        session.current.trials.push(row);
        if (block === 'main') setProgress({ done: i + 1, total: trials.length });
      }
    } finally {
      runner.dispose();
    }
    if (block === 'practice') setScreen('ready');
    else {
      const { meta, trials: rows } = session.current;
      meta.finished_at = new Date().toISOString();
      savePending(meta, rows); // 조작 점검 문항에서 창을 닫아도 기록은 남는다
      setScreen('check');
    }
  }

  // 조작 점검 답을 받은 뒤 '먼저 저장하고' 결과를 보여 준다 (결과만 보고 창을 닫아 기록이 사라지는 것 방지)
  async function answerCheck(value) {
    const { meta, trials } = session.current;
    meta.saw_cue = value;
    savePending(meta, trials);
    markCompleted(meta.session_id);
    setResult(personalSummary(trials));
    setScreen('saving');
    await send();
    setScreen('done');
  }

  async function send() {
    setUpload('sending');
    try {
      await submit(session.current.meta, session.current.trials);
      setUpload('ok');
    } catch {
      setUpload('fail');
    }
  }

  const inTask = screen === 'practice' || screen === 'main';

  return (
    <div className="app" data-task={inTask}>
      {!inTask && (
        <header className="brand">
          <span className="mark" aria-hidden="true" />
          Reflex Hub
        </header>
      )}

      {screen === 'intro' && (
        <main className="card">
          <p className="eyebrow">반응속도 실험 · 약 4분</p>
          <h1>얼마나 빨리 반응하시나요?</h1>
          <p className="lead">
            화면 가운데에 원이 나타나면 최대한 빨리 누르는 실험입니다. 끝나면 내 반응속도를 바로 확인할 수
            있습니다.
          </p>
          <ul className="facts">
            <li>
              연습 {TOTAL_PRACTICE}회 + 본 실험 {TOTAL_MAIN}회
            </li>
            <li>이름·연락처 등 개인을 식별하는 정보는 받지 않습니다</li>
            <li>기록되는 것: 반응시간, 입력 방식(터치/마우스/키보드), 화면 크기, 브라우저 정보</li>
            <li>수집한 기록은 대학 과제 논문의 원자료로만 쓰고, 익명 상태로 공개될 수 있습니다</li>
            <li>실험의 구체적인 목적은 수집이 끝난 뒤 공개합니다</li>
          </ul>
          {isPilot() && <p className="notice">파일럿 모드: 이 기록은 따로 저장되며 분석에 포함되지 않습니다.</p>}
          {repeat.current && (
            <p className="notice">
              이 브라우저에서 이미 한 번 참여하셨습니다. 다시 하셔도 되지만, 두 번째 기록은 분석에서 제외됩니다.
            </p>
          )}
          <fieldset className="age">
            <legend>연령대 (선택)</legend>
            <div className="chips">
              {AGE_BANDS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className="chip"
                  aria-pressed={ageBand === a}
                  onClick={() => setAgeBand(ageBand === a ? '' : a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="consent">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>위 내용을 확인했고 참여에 동의합니다. 언제든 창을 닫아 중단할 수 있습니다.</span>
          </label>
          <button className="primary" disabled={!agree} onClick={start}>
            시작하기
          </button>
        </main>
      )}

      {screen === 'howto' && (
        <main className="card">
          <p className="eyebrow">방법</p>
          <h1>원이 보이면 바로 누르세요</h1>
          <ol className="steps">
            <li>가운데 작은 점을 보고 기다립니다.</li>
            <li>
              흰 원이 나타나면 <b>화면 아무 곳이나</b> 터치하거나 클릭합니다. 키보드라면 <kbd>Space</kbd>를
              누릅니다.
            </li>
            <li>가끔 화면 테두리가 잠깐 밝아질 수 있습니다. 테두리가 아니라 원에 반응하세요.</li>
            <li>
              가끔은 <b>원이 나오지 않습니다.</b> 그때는 누르지 말고 기다리세요.
            </li>
            <li>원이 나오기 전에 누르면 그 회차는 무효입니다.</li>
          </ol>
          <p className="hint">조용한 곳에서, 한 가지 입력 방식으로 끝까지 해 주세요. 휴대폰이라면 세로 화면을 권장합니다.</p>
          <button className="primary" onClick={() => runBlock('practice')}>
            연습 시작 ({TOTAL_PRACTICE}회)
          </button>
        </main>
      )}

      {screen === 'ready' && (
        <main className="card">
          <p className="eyebrow">연습 끝</p>
          <h1>이제 본 실험입니다</h1>
          <p className="lead">
            {TOTAL_MAIN}회 진행하며 약 3분 걸립니다. 중간에 다른 앱이나 탭으로 넘어가지 말아 주세요.
          </p>
          <button className="primary" onClick={() => runBlock('main')}>
            본 실험 시작
          </button>
        </main>
      )}

      {inTask && (
        <div className="stage" ref={stageRef} data-fix="off" role="application" aria-label="반응 영역">
          <div className="cue-frame" ref={cueRef} data-on="false" aria-hidden="true" />
          {screen === 'main' && (
            <div className="progress" aria-hidden="true">
              <div style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          )}
          <span className="block-label">{screen === 'practice' ? '연습' : `${progress.done} / ${progress.total}`}</span>
          <div className="fixation" />
          <div className="target" ref={targetRef} data-on="false" />
          <div className="feedback" ref={feedbackRef} aria-live="polite" />
        </div>
      )}

      {screen === 'check' && (
        <main className="card">
          <p className="eyebrow">마지막 질문</p>
          <h1>실험 중에 화면 테두리가 잠깐 밝아지는 것을 보셨나요?</h1>
          <div className="choices">
            {SAW_CUE.map(([v, label]) => (
              <button key={v} className="ghost" onClick={() => answerCheck(v)}>
                {label}
              </button>
            ))}
          </div>
        </main>
      )}

      {screen === 'saving' && (
        <main className="card">
          <p className="eyebrow">거의 끝났습니다</p>
          <h1>기록을 저장하는 중…</h1>
        </main>
      )}

      {screen === 'done' && (
        <main className="card">
          <p className="eyebrow">완료 · 참여해 주셔서 감사합니다</p>
          <h1>내 반응속도</h1>
          {result?.median != null ? (
            <div className="scores">
              <div>
                <span className="label">중앙값</span>
                <span className="num">
                  {Math.round(result.median)}
                  <small> ms</small>
                </span>
              </div>
              <div>
                <span className="label">최고 기록</span>
                <span className="num">
                  {Math.round(result.best)}
                  <small> ms</small>
                </span>
              </div>
            </div>
          ) : (
            <p className="lead">유효한 반응이 부족해 개인 결과를 계산하지 못했습니다.</p>
          )}
          <p className="hint">
            반응시간에는 기기의 화면·입력 지연이 함께 들어 있어, 다른 기기로 한 사람과 숫자를 그대로 비교하기는
            어렵습니다.
          </p>
          <p className={`upload ${upload}`}>
            {upload === 'ok' && '기록이 저장되었습니다.'}
            {upload === 'fail' &&
              '저장에 실패했습니다. 다시 시도하거나 파일로 받아 연구자에게 보내 주세요. (다음에 이 페이지를 열면 자동으로 다시 보냅니다)'}
          </p>
          {upload === 'fail' && (
            <div className="row">
              <button className="primary" onClick={send}>
                다시 저장
              </button>
              <button className="ghost" onClick={() => downloadBackup(session.current.meta, session.current.trials)}>
                파일로 받기
              </button>
            </div>
          )}
          <ShareButton />
        </main>
      )}

      {!inTask && (
        <footer className="foot">
          문의 및 데이터 삭제 요청은 종료 화면의 세션 번호와 함께 연구자에게 알려 주세요.
          {screen === 'done' && <code>{session.current.meta?.session_id.slice(0, 8)}</code>}
        </footer>
      )}
    </div>
  );
}

// 공유 문구에는 결과 수치나 실험 목적을 넣지 않는다 (뒤 참가자 오염 방지)
function ShareButton() {
  const [copied, setCopied] = useState(false);
  const text = '3분짜리 반응속도 실험에 참여해 주세요. 끝나면 내 반응속도를 알려 줍니다.';
  async function share() {
    const url = window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: 'Reflex Hub', text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
      }
    } catch {
      /* 사용자가 공유를 취소한 경우 */
    }
  }
  return (
    <button className="ghost" onClick={share}>
      {copied ? '링크를 복사했습니다' : '친구에게 공유하기'}
    </button>
  );
}
