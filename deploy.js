// 이유식 식단 달력 배포 — GitHub배포.bat 이 실행해요.
// 1) index.html 스크립트 문법 검사 → 2) 바뀐 파일 커밋 → 3) GitHub에 올리기 → 4) 사이트에 반영될 때까지 기다리기
// 기록(식단 데이터)은 여기서 다루지 않아요. 기록은 앱이 비공개 저장소 babyfood-data에 직접 저장해요.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const DIR = __dirname;
const SITE = 'https://seonghun-kim1648.github.io/babyfood/';
const git = (...args) => execFileSync('git', args, {cwd:DIR, encoding:'utf8', stdio:['ignore', 'pipe', 'pipe']}).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main(){
  console.log('이유식 식단 달력 배포\n');

  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (!scripts.length) throw new Error('index.html에서 스크립트를 찾지 못했어요');
  for (const s of scripts) new vm.Script(s, {filename:'index.html'});
  console.log('1) 페이지 검사 통과');

  const changed = git('status', '--porcelain');
  if (changed){
    console.log('2) 바뀐 파일');
    for (const line of changed.split('\n')) console.log('   ' + line);
    git('add', '-A');
    const msg = process.argv[2] || `이유식 달력 업데이트 ${new Date().toLocaleString('ko-KR')}`;
    git('commit', '-q', '-m', msg);
  } else {
    console.log('2) 바뀐 파일이 없어요');
  }

  git('pull', '--rebase', '-q');
  const ahead = git('rev-list', '--count', '@{u}..HEAD');
  if (ahead === '0'){
    console.log('3) GitHub와 이미 같아요. 올릴 것이 없어요.');
    return;
  }
  git('push', '-q');
  console.log(`3) GitHub에 올렸어요 (커밋 ${ahead}개)`);

  const want = html.replace(/\r\n/g, '\n');
  process.stdout.write('4) 사이트에 반영되길 기다리는 중 (보통 1분 안팎) ');
  for (let i = 0; i < 24; i++){
    await sleep(10000);
    try {
      const r = await fetch(SITE + '?v=' + Date.now(), {cache:'no-store'});
      const got = (await r.text()).replace(/\r\n/g, '\n');
      if (r.ok && got === want){
        console.log(`\n\n반영됐어요: ${SITE}\n폰에서는 페이지를 새로고침하면 바뀐 화면이 보여요.`);
        return;
      }
    } catch (e){ /* 잠깐 끊겨도 다시 시도 */ }
    process.stdout.write('.');
  }
  console.log(`\n\nGitHub에는 올렸지만 사이트 반영이 늦어요. 몇 분 뒤 ${SITE} 를 새로고침해 보세요.`);
}

main().catch(e => {
  const detail = (e.stderr && String(e.stderr).trim()) || e.message;
  console.error('\n실패했어요: ' + detail);
  if (/rebase|conflict|CONFLICT/.test(detail)) console.error('GitHub 쪽 내용과 겹쳐요. Claude에게 이 메시지를 보여 주세요.');
  process.exitCode = 1;
});
