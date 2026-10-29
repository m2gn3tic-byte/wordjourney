import { LANGUAGES, LEVELS, sessionFor } from './levels.js';
import { wordForPath } from './boards.js';

export const STORAGE_KEY = 'sonarannak-v1';
export const HINT_COST = 25;
export const BONUS_REWARD = 5;
export const PACKS = [
  { id: 'pocket', coins: 300, price: 0.99 },
  { id: 'journey', coins: 900, price: 2.49 },
  { id: 'adventure', coins: 2400, price: 5.99 },
];
const emptyGame = () => ({ found: [], bonus: [], revealed: [], paths: {}, rewarded: false });
const cleanList = (value, allowed) => Array.isArray(value) ? [...new Set(value.filter(v => allowed.includes(v)))] : [];
const plainObject = value => value && typeof value === 'object' && !Array.isArray(value);
const validCoins = n => Number.isSafeInteger(n) && n >= 0 && n <= 100_000_000;

export function normalizeState(raw) {
  raw = plainObject(raw) ? raw : {};
  const state = {
    version: 1,
    language: LANGUAGES.includes(raw.language) ? raw.language : 'et',
    coins: validCoins(raw.coins) ? raw.coins : 120,
    sound: raw.sound !== false,
    current: {},
    games: {},
    purchases: [],
  };
  if (plainObject(raw.games)) {
    for (const [id, value] of Object.entries(raw.games)) {
      const session = sessionFor(id);
      if (!session || !plainObject(value)) continue;
      state.games[id] = {
        found: cleanList(value.found, session.words),
        bonus: cleanList(value.bonus, session.bonus),
        revealed: cleanList(value.revealed, session.board.cells.map(c => c.key)),
        rewarded: value.rewarded === true,
        paths: plainObject(value.paths) && session.mode === 'wordsearch' ? Object.fromEntries(Object.entries(value.paths)
          .filter(([word,path])=>session.words.includes(word) && wordForPath(session.board,path)===word)) : {},
      };
    }
  }
  for (const language of LANGUAGES) {
    const current = raw.current?.[language];
    state.current[language] = Number.isInteger(current) && current >= 0 ? Math.min(current, unlockedLevel(state, language)) : 0;
  }
  if (Array.isArray(raw.purchases)) state.purchases = raw.purchases
    .filter(p => plainObject(p) && p.mode === 'demo' && PACKS.some(pack => pack.id === p.pack) && typeof p.at === 'string')
    .slice(-20).map(p => ({ mode: 'demo', pack: p.pack, at: p.at.slice(0, 32) }));
  return state;
}

export function getGame(state, id) { return state.games[id] || emptyGame(); }
export function isFinished(state, id) {
  const session = sessionFor(id);
  return !!session && session.words.every(word => getGame(state, id).found.includes(word));
}
export function completedCount(state, language) {
  return LEVELS[language].filter((_, i) => isFinished(state, `${language}:level:${i}`)).length;
}
export function unlockedLevel(state, language) {
  for (let i = 0; i < LEVELS[language].length; i++) if (!isFinished(state, `${language}:level:${i}`)) return i;
  return LEVELS[language].length - 1;
}
export function canSpell(word, letters) {
  const remaining = [...letters];
  return [...word].every(letter => {
    const i = remaining.indexOf(letter);
    if (i < 0) return false;
    remaining.splice(i, 1);
    return true;
  });
}
export function visibleCells(session, game) {
  return new Set([...game.revealed, ...session.board.words.filter(w => game.found.includes(w.word)).flatMap(w => game.paths?.[w.word] || w.cells)]);
}
function editable(state, id) {
  const game = getGame(state, id);
  const copy = { ...game, found: [...game.found], bonus: [...game.bonus], revealed: [...game.revealed], paths: {...game.paths} };
  return [{ ...state, games: { ...state.games, [id]: copy } }, copy];
}
function finish(state, session, game) {
  // Intersecting answers can complete another answer; resolve until stable.
  let changed;
  do {
    changed = false;
    const visible = visibleCells(session, game);
    for (const answer of session.board.words) {
      if (!game.found.includes(answer.word) && answer.cells.every(k => session.mode === 'wordsearch' ? game.revealed.includes(k) : visible.has(k))) {
        game.found.push(answer.word); changed = true;
      }
    }
  } while (changed);
  const complete = session.words.every(word => game.found.includes(word));
  const reward = complete && !game.rewarded && !session.practice ? (session.daily ? 40 : 20) : 0;
  if (complete) game.rewarded = true;
  state.coins += reward;
  return { state, complete, reward };
}
export function submitWord(state, id, input) {
  const session = sessionFor(id);
  if (!session) return { state, status: 'invalid' };
  const word = String(input).trim().normalize('NFC').toLocaleUpperCase(session.language);
  const game = getGame(state, id);
  if (game.found.includes(word) || game.bonus.includes(word)) return { state, status: 'duplicate' };
  if (!canSpell(word, session.letters)) return { state, status: 'invalid' };
  if (!session.words.includes(word) && !session.bonus.includes(word)) return { state, status: 'invalid' };
  const [next, draft] = editable(state, id);
  if (session.bonus.includes(word)) {
    draft.bonus.push(word);
    const reward=session.practice?0:BONUS_REWARD;
    next.coins += reward;
    return { state: next, status: 'bonus', reward };
  }
  draft.found.push(word);
  return { ...finish(next, session, draft), status: 'found' };
}
export function submitSearchPath(state,id,path) {
  const session=sessionFor(id);
  if(!session || session.mode!=='wordsearch') return {state,status:'invalid'};
  let word=wordForPath(session.board,path), acceptedPath=path;
  if(!session.words.includes(word)) {
    const reversed=[...word].reverse().join('');
    if(session.words.includes(reversed)){word=reversed;acceptedPath=[...path].reverse();}
  }
  if(!session.words.includes(word)) return {state,status:'invalid'};
  const result=submitWord(state,id,word);
  if(result.status==='found') result.state.games[id].paths[word]=[...acceptedPath];
  return {...result,word};
}
export function useHint(state, id) {
  const session = sessionFor(id);
  if (!session || isFinished(state, id)) return { state, status: 'complete' };
  const cost=session.practice?0:HINT_COST;
  if (state.coins < cost) return { state, status: 'insufficient' };
  const visible = visibleCells(session, getGame(state, id));
  const gameBefore=getGame(state,id);
  const remaining=session.board.words.filter(w=>!gameBefore.found.includes(w.word));
  const searchKeys=new Set(remaining.flatMap(w=>w.cells).filter(k=>!gameBefore.revealed.includes(k)));
  const cell = session.mode==='wordsearch' ? session.board.cells.find(c=>searchKeys.has(c.key)&&!visible.has(c.key)) || session.board.cells.find(c=>searchKeys.has(c.key))
    : session.board.cells.find(c => !visible.has(c.key));
  if (!cell) return { state, status: 'complete' };
  const [next, game] = editable(state, id);
  next.coins -= cost;
  game.revealed.push(cell.key);
  return { ...finish(next, session, game), status: 'hint', cell: cell.key };
}

// This is intentionally local demo currency, never a payment acknowledgement.
// A real billing provider must verify receipts server-side before crediting coins.
export function demoPurchase(state, packId, at = new Date().toISOString()) {
  const pack = PACKS.find(p => p.id === packId);
  if (!pack || state.coins + pack.coins > 100_000_000) return { state, status: 'invalid' };
  return {
    status: 'demo',
    state: { ...state, coins: state.coins + pack.coins,
      purchases: [...state.purchases, { mode: 'demo', pack: pack.id, at }].slice(-20) },
    coins: pack.coins,
  };
}
