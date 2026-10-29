import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LANGUAGES, dayStamp, sessionFor, chaptersFor, chapterFor } from '../src/wordgame/levels.js';
import { normalizeState, submitWord, getGame, isFinished, completedCount, canSpell,
  unlockedLevel, visibleCells, useHint, demoPurchase, PACKS, submitSearchPath } from '../src/wordgame/engine.js';
import { wordForPath, straightPath, makeWordSearch } from '../src/wordgame/boards.js';

test('all 148 puzzles have spellable words and valid boards for their game mode', () => {
  assert.equal(Object.values(LEVELS).flat().length, 148);
  for (const levels of Object.values(LEVELS)) for (const level of levels) {
    assert.equal(new Set([...level.words, ...level.bonus]).size, level.words.length + level.bonus.length);
    for (const word of [...level.words, ...level.bonus]) {
      assert.ok(word.length >= 3); assert.ok(canSpell(word, level.letters), word);
    }
    const board = level.board, cells = new Map(board.cells.map(c => [c.key, c]));
    for(const answer of board.words){
      assert.equal(answer.cells.map(key=>cells.get(key).letter).join(''),answer.word);
      if(level.mode==='wordsearch')assert.equal(wordForPath(board,answer.cells),answer.word);
    }
    if(level.mode==='wordsearch'){
      assert.equal(board.cells.length,board.cols*board.rows);continue;
    }
    if(level.mode==='rows'){
      assert.equal(board.words.length,level.words.length);continue;
    }
    const sequences = [];
    for (const c of cells.values()) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      if (cells.has(`${c.x - dx},${c.y - dy}`)) continue;
      let word = '', x = c.x, y = c.y;
      while (cells.has(`${x},${y}`)) { word += cells.get(`${x},${y}`).letter; x += dx; y += dy; }
      if (word.length > 1) sequences.push(word);
    }
    assert.deepEqual(sequences.sort(), [...level.words].sort());
    const seen = new Set(), queue = [board.cells[0]];
    while (queue.length) {
      const c = queue.pop();
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = cells.get(`${c.x + dx},${c.y + dy}`); if (next) queue.push(next);
      }
    }
    assert.equal(seen.size, board.cells.length);
  }
});
test('only the actual letter inventory can spell a word, including repeated and accented letters', () => {
  assert.ok(canSpell('KALA', [...'KALAS']));
  assert.ok(!canSpell('KALLA', [...'KALAS']));
  assert.ok(canSpell('ÕUN', [...'ÕUNED']));
  assert.ok(!canSpell('OUN', [...'ÕUNED']));
});
test('a solved level rewards once, unlocks the next, and leaves the input state unchanged', () => {
  const start = normalizeState(null);
  let state = start;
  for (const word of LEVELS.et[0].words) state = submitWord(state, 'et:level:0', word.toLowerCase()).state;
  assert.ok(isFinished(state, 'et:level:0')); assert.equal(state.coins, 140);
  assert.equal(unlockedLevel(state, 'et'), 1); assert.equal(completedCount(state, 'et'), 1);
  assert.deepEqual(start.games, {}); assert.equal(start.coins, 120);
  const again = submitWord(state, 'et:level:0', 'KALA');
  assert.equal(again.status, 'duplicate'); assert.equal(again.state.coins, 140);
  assert.equal(unlockedLevel(state, 'ru'), 0);
});
test('every language can be completed without coins or hints', () => {
  for (const language of LANGUAGES) {
    let state = normalizeState({ coins: 0 });
    LEVELS[language].forEach((level, i) => {
      for (const word of level.words) state = submitWord(state, `${language}:level:${i}`, word).state;
      assert.ok(isFinished(state, `${language}:level:${i}`));
    });
    assert.equal(completedCount(state, language), LEVELS[language].length);
    assert.equal(state.coins, LEVELS[language].length * 20);
  }
});
test('bonus words reward once and invalid or repeated words never change coins', () => {
  const start = normalizeState(null), result = submitWord(start, 'et:level:0', 'saal');
  assert.equal(result.status, 'bonus'); assert.equal(result.state.coins, 125);
  assert.equal(submitWord(result.state, 'et:level:0', 'SAAL').state.coins, 125);
  assert.equal(submitWord(result.state, 'et:level:0', 'XXXX').state.coins, 125);
  assert.equal(submitWord(result.state, 'et:level:0', 'KALLA').status, 'invalid');
});
test('hints reveal new cells, charge exactly 25, and do not charge on insufficient balance or completion', () => {
  let state = normalizeState({ coins: 1000 });
  const id = 'et:level:0', level = sessionFor(id);
  for (let i = 0; i < level.board.cells.length && !isFinished(state, id); i++) {
    const visible = visibleCells(level, getGame(state, id));
    const before = state.coins, result = useHint(state, id);
    assert.equal(result.status, 'hint'); assert.ok(!visible.has(result.cell));
    assert.equal(result.state.coins, before - 25 + result.reward); state = result.state;
  }
  assert.ok(isFinished(state, id));
  assert.equal(useHint(state, id).state.coins, state.coins);
  const poor = normalizeState({ coins: 24 });
  assert.equal(useHint(poor, id).status, 'insufficient'); assert.deepEqual(poor.games, {});
});
test('daily puzzles use Tallinn dates and award once per date independently of the campaign', () => {
  assert.equal(dayStamp(new Date('2026-10-28T22:30:00Z')), '2026-10-29');
  assert.equal(sessionFor('et:daily:2026-02-30'), null);
  const id = 'et:daily:2026-10-28', nextId = 'et:daily:2026-10-29';
  assert.deepEqual(sessionFor(id), sessionFor(id));
  let state = normalizeState(null);
  for (const word of sessionFor(id).words) state = submitWord(state, id, word).state;
  assert.equal(state.coins, 160); assert.equal(completedCount(state, 'et'), 0);
  for (const word of sessionFor(id).words) state = submitWord(state, id, word).state;
  assert.equal(state.coins, 160);
  for (const word of sessionFor(nextId).words) state = submitWord(state, nextId, word).state;
  assert.equal(state.coins, 200);
});
test('stored progress is sanitized and partial words, hints and balances survive a round trip', () => {
  for (const input of [null, false, [], 'text', 8]) assert.equal(normalizeState(input).language, 'et');
  const bad = normalizeState({ language: '<script>', coins: -4, current: { et: 99 }, games: { 'not:a:level': {}, 'et:level:0': { found: ['XXX', 'KALA', 'KALA'], bonus: ['SAAL', 'X'], revealed: ['bad'], rewarded: false } } });
  assert.equal(bad.coins, 120); assert.equal(bad.current.et, 0);
  assert.deepEqual(bad.games['et:level:0'].found, ['KALA']);
  assert.deepEqual(bad.games['et:level:0'].bonus, ['SAAL']);
  const state = useHint(submitWord(normalizeState(null), 'et:level:0', 'KALA').state, 'et:level:0').state;
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))), state);
});
test('shop credits only known demo packs and records their demo origin', () => {
  const state = normalizeState(null);
  assert.equal(demoPurchase(state, 'unknown').state.coins, 120);
  for (const pack of PACKS) {
    const result = demoPurchase(state, pack.id, '2026-10-28T20:00:00Z');
    assert.equal(result.status, 'demo'); assert.equal(result.state.coins, 120 + pack.coins);
    assert.deepEqual(result.state.purchases, [{ mode: 'demo', pack: pack.id, at: '2026-10-28T20:00:00Z' }]);
    assert.deepEqual(normalizeState(result.state), result.state);
  }
  assert.equal(state.coins, 120);
});

test('six chapters partition every language with stable original level positions', () => {
  for (const language of LANGUAGES) {
    const chapters = chaptersFor(language);
    assert.deepEqual(chapters.map(c=>c.id), ['coast','bog','town','forest','harbor','master']);
    assert.equal(chapters[0].start, 0);
    assert.equal(chapters.at(-1).end, LEVELS[language].length);
    for(let i=0;i<LEVELS[language].length;i++) {
      const chapter = chapterFor(language,i);
      assert.ok(i>=chapter.start && i<chapter.end);
    }
    assert.equal(chapterFor(language, chapters[0].end).id, 'bog');
  }
  assert.deepEqual(LEVELS.et.slice(0,12).map(l=>l.words.join('/')), [
    'KALA/KAS/SAAK','MAJA/JAMA/AJA','METS/MEES/TEE','KOOL/LOIK/OLI','LINN/LINA/NALI','PÄIKE/PAI/ÄKE',
    'RAND/RADA/AND','SAAR/AARE/RASE','TALV/VALI/LAI','ÕUN/ÕDE/NÕU','PAAT/ASI/SAIA','RÄND/RADA/ÄRA',
  ]);
});

test('one hundred distinct new puzzles include both additional game variants',()=>{
  const oldCounts={et:24,ru:12,en:12};let extra=0;
  for(const language of LANGUAGES){
    const levels=LEVELS[language];extra+=levels.length-oldCounts[language];
    assert.equal(new Set(levels.map(l=>[...l.words].sort().join('|'))).size,levels.length);
    assert.ok(levels.some(l=>l.mode==='wordsearch'));
    assert.ok(levels.some(l=>l.mode==='rows'));
  }
  assert.equal(extra,100);
});
test('word search accepts real straight paths in either direction and persists their coordinates',()=>{
  const index=LEVELS.et.findIndex(l=>l.mode==='wordsearch'),id=`et:level:${index}`,level=sessionFor(id);
  let state=normalizeState(null);
  for(const [i,answer]of level.board.words.entries()){
    const path=i%2?[...answer.cells].reverse():answer.cells;
    const result=submitSearchPath(state,id,path);assert.equal(result.status,'found');state=result.state;
    assert.equal(wordForPath(level.board,getGame(state,id).paths[answer.word]),answer.word);
  }
  assert.ok(isFinished(state,id));assert.equal(state.coins,140);
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))),state);
  assert.equal(submitSearchPath(state,id,level.board.words[0].cells).status,'duplicate');
  const bad=submitSearchPath(state,id,['0,0','2,0','2,2']);assert.equal(bad.status,'invalid');
  assert.deepEqual(straightPath(level.board,'999999999,0','0,0'),[]);
  assert.deepEqual(makeWordSearch(level.words,'et','fixed'),makeWordSearch(level.words,'et','fixed'));
});
test('free practice never changes campaign progress or coins, including hints and replays',()=>{
  for(const mode of ['crossword','wordsearch','rows']){
    const index=LEVELS.et.findIndex(l=>l.mode===mode),id=`et:practice:${index}`;
    let state=normalizeState({coins:0});
    state=useHint(state,id).state;assert.equal(state.coins,0);
    for(const word of LEVELS.et[index].words)state=submitWord(state,id,word).state;
    assert.ok(isFinished(state,id));assert.equal(state.coins,0);assert.equal(completedCount(state,'et'),0);
    assert.equal(unlockedLevel(state,'et'),0);
    state=submitWord(state,id,LEVELS.et[index].words[0]).state;assert.equal(state.coins,0);
  }
});

test('old completed chapter resumes at the first new puzzle without recrediting coins', () => {
  let state=normalizeState(null);
  for(let i=0;i<12;i++) for(const word of LEVELS.et[i].words) state=submitWord(state,`et:level:${i}`,word).state;
  state.current.et=11;
  const loaded=normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(loaded.coins,360);
  assert.equal(unlockedLevel(loaded,'et'),12);
  assert.equal(loaded.current.et,11);
  const prior=submitWord(loaded,'et:level:0','KALA');
  assert.equal(prior.state.coins,360); assert.equal(prior.status,'duplicate');
});
