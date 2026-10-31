import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Dict } from '../src/engine/dict.js';
import { koSubChar } from '../src/engine/hangul.js';
import { isChainable, getChar, getSubChar, candidates, getPreScore, makeTitle } from '../src/engine/rules.js';
import { Game } from '../src/engine/game.js';

const ko = new Dict('ko', fs.readFileSync('public/data/ko.txt', 'utf8'));
const en = new Dict('en', fs.readFileSync('public/data/en.txt', 'utf8'));

test('두음법칙', () => {
  assert.equal(koSubChar('력'), '역');
  assert.equal(koSubChar('녀'), '여');
  assert.equal(koSubChar('라'), '나');
  assert.equal(koSubChar('가'), undefined);
});
test('관리자 추가 단어', () => {
  assert.ok(!ko.get('끄투프리'));
  ko.add('끄투프리', 0, 1);
  assert.ok(ko.get('끄투프리'));
  assert.ok(candidates(ko, 'KSH', '끄', undefined, { strict: true }).some((e) => e.w === '끄투프리'));
});
test('관리자 단어 파싱', async () => {
  const { parseWords } = await import('../src/engine/customWords.js');
  const r = parseWords('단어,언어,외래어,어인정,표준\n끄투\nKKUTU\n쿵,ko\n프리서버\t\t1\t\t0\n끄투\n12ab');
  assert.deepEqual(r.rows.map((x) => x.word), ['끄투', 'kkutu', '프리서버']);
  assert.equal(r.rows[2].loanword, true);
  assert.equal(r.rows[2].strict, false);
  assert.equal(r.skipped.length, 2);
});
test('사전 로드', () => {
  assert.ok(ko.size > 300000);
  assert.ok(ko.get('사과'));
  assert.ok(en.get('apple'));
});
test('체인 규칙', () => {
  assert.equal(getChar('KSH', '사과'), '과');
  assert.equal(getChar('KAP', '사과'), '사');
  assert.ok(isChainable('KSH', '과일', '과', undefined, 0));
  assert.ok(isChainable('KSH', '역사', '력', '역', 0));
  assert.ok(!isChainable('KKT', '역사', '력', '역', 3));
  assert.ok(isChainable('KAP', '나사', '사', undefined, 0));
  assert.ok(isChainable('EKT', 'tiger', 'ple', 'le', 0) === false);
});
test('후보 검색', () => {
  const c = candidates(ko, 'KSH', '과', undefined, { injeong: false }, { limit: 5 });
  assert.equal(c.length, 5);
  assert.ok(c.every((e) => e.w[0] === '과'));
  const k = candidates(ko, 'KKT', '과', undefined, {}, { wordLength: 3, limit: 5 });
  assert.ok(k.every((e) => e.w.length === 3));
});
test('점수식', () => {
  assert.ok(getPreScore('사과', [], 1) > 0);
});
test('제목 단어', () => {
  const t = makeTitle(ko, 'KSH', 5, {});
  assert.equal(t.length, 5);
});

async function simulate(mode) {
  const dict = mode[0] === 'K' ? ko : en;
  const players = [0, 1, 2, 3].map((i) => ({ id: 'b' + i, name: 'bot' + i, bot: true, level: 4 }));
  const g = new Game({ dict, mode, opts: { manner: true, mission: true }, rounds: 1, time: 60, players });
  const words = []; let lastId = 0;
  g.subscribe(() => { const l = g.getSnapshot().last; if (l && l.ok && l.id !== lastId) { lastId = l.id; words.push(l.word); } });
  g.start();
  await new Promise((r) => setTimeout(r, 16000));
  const s = g.getSnapshot();
  g.destroy();
  return { words, s };
}
test('봇 4명이 5개 모드를 한 판씩 (규칙 위반 없이 이어짐)', async () => {
  const modes = ['KSH', 'KKT', 'KAP', 'ESH', 'EKT'];
  const res = await Promise.all(modes.map(simulate));
  res.forEach(({ words, s }, i) => {
    const mode = modes[i];
    assert.ok(words.length >= 1, `${mode} words=${words.length}`);
    for (let k = 1; k < words.length; k++) {
      const c = getChar(mode, words[k - 1]);
      assert.ok(isChainable(mode, words[k], c, getSubChar(mode, c), mode === 'KKT' ? 3 : 0), `${mode}: ${words[k - 1]} -> ${words[k]}`);
    }
    assert.equal(new Set(words).size, words.length);
    assert.ok(Object.values(s.players).some((p) => p.score > 0));
    console.log(mode, words.join(' → '));
  });
});
