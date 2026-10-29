// Hand-curated word families. Each language has its own
// puzzles; translating the interface never translates an existing crossword.
import { EXTRA_LEVELS } from './extra-levels.js';
import { makeWordRows, makeWordSearch } from './boards.js';
export const LANGUAGES = ['et', 'ru', 'en'];
export const LANGUAGE_NAMES = { et: 'Eesti', ru: 'Русский', en: 'English' };
const puzzle = (letters, words, bonus = []) => ({ letters: [...letters], words, bonus });

export const LEVELS = {
  et: [
    puzzle('KALAS', ['KALA', 'KAS', 'SAAK'], ['AAS', 'SAAL', 'SALA']),
    puzzle('MAJA', ['MAJA', 'JAMA', 'AJA']),
    puzzle('MEEST', ['METS', 'MEES', 'TEE'], ['SEE', 'ESE']),
    puzzle('KOOLI', ['KOOL', 'LOIK', 'OLI'], ['KOI', 'KOLI']),
    puzzle('LINNA', ['LINN', 'LINA', 'NALI'], ['ANN']),
    puzzle('PÄIKEA', ['PÄIKE', 'PAI', 'ÄKE'], ['KÄI']),
    puzzle('RANDA', ['RAND', 'RADA', 'AND'], ['NAD', 'ARA']),
    puzzle('SAARE', ['SAAR', 'AARE', 'RASE'], ['AAS', 'SEA', 'SAE']),
    puzzle('TALVI', ['TALV', 'VALI', 'LAI'], ['TALI', 'LATI']),
    puzzle('ÕUNED', ['ÕUN', 'ÕDE', 'NÕU'], ['NÕE']),
    puzzle('PAATIS', ['PAAT', 'ASI', 'SAIA'], ['PAI', 'SAI']),
    puzzle('RÄNDAA', ['RÄND', 'RADA', 'ÄRA'], ['AND', 'ARA', 'NAD']),
    puzzle('RABAS', ['RABA', 'SABA', 'ARA'], ['AAS', 'RAAS']),
    puzzle('SAMMAL', ['SAMMAL', 'SALA', 'MAAS'], ['LAMM', 'SAMA', 'AAS']),
    puzzle('LINDU', ['LIND', 'LUND', 'UNI'], ['NUI', 'ILU']),
    puzzle('ÕHTULI', ['ÕHTU', 'ÕLU', 'TULI'], ['LUHT']),
    puzzle('TUULI', ['TUUL', 'TULI', 'ILU'], ['LUU', 'TULU']),
    puzzle('KASTE', ['KASTE', 'ASTE', 'KESA'], ['KASE', 'TASE', 'SEA', 'SAE', 'KAS']),
    puzzle('LINNAD', ['LINN', 'LIND', 'NALI'], ['LINA', 'AND', 'NAD', 'ANN']),
    puzzle('TORNID', ['TORN', 'RIND', 'RONT'], ['ROTI', 'TRIO', 'RONI']),
    puzzle('KIVIEL', ['KIVI', 'KIIL', 'KILE'], ['VEIL', 'VII']),
    puzzle('RAAMAT', ['RAAMAT', 'RAAM', 'TARA'], ['MAA', 'ARA', 'AAR']),
    puzzle('TÄNAV', ['TÄNAV', 'TÄNA', 'VÄNT']),
    puzzle('RÄNNAK', ['RÄNNAK', 'KANN', 'RÄNK'], ['ÄRA', 'NÄRA']),
  ],
  ru: [
    puzzle('КОТ', ['КОТ', 'ТОК', 'КТО']),
    puzzle('ЛЕСО', ['ЛЕС', 'СЕЛО']),
    puzzle('МОРЕ', ['МОРЕ', 'РОМ', 'МЕР']),
    puzzle('РЕКАА', ['РЕКА', 'РАК', 'АРКА'], ['КАРА', 'КАРЕ']),
    puzzle('ВОЛНА', ['ВОЛНА', 'ВОЛ', 'ВАЛ'], ['ВОН', 'НОВА']),
    puzzle('ОСТРОВ', ['ОСТРОВ', 'РОСТ', 'СОР'], ['РОТ', 'ТОР', 'ТРОС', 'СОРТ']),
    puzzle('ТРАВА', ['ТРАВА', 'ТАРА', 'ВАТА'], ['АРА', 'ВАР']),
    puzzle('СОСНА', ['СОСНА', 'СОН', 'НОС'], ['НАС', 'ОСА']),
    puzzle('ТУМАН', ['ТУМАН', 'ТАМ', 'НАМ'], ['МАТ', 'НУТ']),
    puzzle('ГОРОДА', ['ГОРОД', 'ДАР', 'РОГ'], ['ГОД', 'ГРАД', 'РОД', 'ГОРА', 'ДОРОГА']),
    puzzle('БАШНЯ', ['БАШНЯ', 'БАНЯ', 'НАШ']),
    puzzle('УЛИЦА', ['УЛИЦА', 'ЛИЦА', 'АУЛ']),
  ],
  en: [
    puzzle('SEAR', ['SEA', 'EAR', 'ARE'], ['ERA']),
    puzzle('HOME', ['HOME', 'HEM', 'HOE']),
    puzzle('STONE', ['STONE', 'NOTE', 'ONES'], ['TONE', 'TEN', 'NET', 'SON']),
    puzzle('TRAIL', ['TRAIL', 'RAIL', 'TAIL'], ['AIR', 'ART', 'RAT', 'TAR']),
    puzzle('COAST', ['COAST', 'COAT', 'CAT'], ['ACT', 'COST', 'OAT']),
    puzzle('ISLAND', ['ISLAND', 'LAND', 'SAIL'], ['SAND', 'NAIL', 'AID', 'LID', 'AND']),
    puzzle('FOREST', ['FOREST', 'FROST', 'REST'], ['ROSE', 'SORT', 'STORE', 'SOFT', 'FORT', 'TOES', 'FOR', 'SET']),
    puzzle('MOSSY', ['MOSSY', 'MOSS', 'SOY']),
    puzzle('NATURE', ['NATURE', 'TUNE', 'NEAR'], ['RATE', 'TEAR', 'EARN', 'TURN', 'RANT', 'ANT', 'RAN', 'TEN', 'NET', 'NUT']),
    puzzle('STREET', ['STREET', 'TREE', 'REST'], ['TEST', 'SET', 'SEE', 'TEE', 'STEER', 'TERSE', 'RESET']),
    puzzle('MARKET', ['MARKET', 'MAKE', 'TEAM'], ['TAKE', 'RATE', 'MATE', 'MEAT', 'TEAR', 'MARK', 'RAKE', 'MARE', 'ARM', 'ART']),
    puzzle('CASTLE', ['CASTLE', 'LACE', 'EAST'], ['CAT', 'ACT', 'TEA', 'SEA', 'SET', 'LAST', 'LATE', 'TALE', 'SLATE', 'STALE', 'STEAL']),
  ],
};

for (const [language, extra] of Object.entries(EXTRA_LEVELS)) {
  LEVELS[language].push(...extra.map((level,i)=>({...level,mode:i%4===0?'wordsearch':i%4===2?'rows':'crossword'})));
}

export const CHAPTERS = [
  { id: 'coast', number: 1, counts: { et: 12, ru: 6, en: 6 }, coordinates: '58°15′ N · 22°28′ E' },
  { id: 'bog', number: 2, counts: { et: 6, ru: 3, en: 3 }, coordinates: '59°28′ N · 25°38′ E' },
  { id: 'town', number: 3, counts: { et: 6, ru: 3, en: 3 }, coordinates: '59°26′ N · 24°45′ E' },
  { id: 'forest', number: 4, counts: { et: 20, ru: 6, en: 6 }, coordinates: 'Uued rajad · IV' },
  { id: 'harbor', number: 5, counts: { et: 20, ru: 7, en: 7 }, coordinates: 'Uued rajad · V' },
  { id: 'master', number: 6, counts: { et: 20, ru: 7, en: 7 }, coordinates: 'Uued rajad · VI' },
];
export function chaptersFor(language) {
  let start = 0;
  return CHAPTERS.map(chapter => {
    const result = { ...chapter, start, end: start + chapter.counts[language] };
    start = result.end;
    return result;
  });
}
export function chapterFor(language, index) {
  return chaptersFor(language).find(chapter => index >= chapter.start && index < chapter.end) || chaptersFor(language)[0];
}

const key = (x, y) => `${x},${y}`;

/** Deterministic connected crossword, with no side-touching or partial overlaps. */
export function makeCrossword(words) {
  const ordered = [...words].sort((a, b) => b.length - a.length);
  let attempts = 0;
  function place(board, remaining, placed) {
    if (!remaining.length) return { board, placed };
    if (++attempts > 20_000) return null;
    for (let w = 0; w < remaining.length; w++) {
      const word = remaining[w];
      const candidates = [];
      if (!placed.length) candidates.push({ x: 0, y: 0, dx: 1, dy: 0 });
      else {
        for (const cell of board.values()) {
          for (let i = 0; i < word.length; i++) {
            if (word[i] !== cell.letter) continue;
            for (const [dx, dy, axis] of [[1, 0, 'h'], [0, 1, 'v']]) {
              if (!cell[axis]) candidates.push({ x: cell.x - i * dx, y: cell.y - i * dy, dx, dy });
            }
          }
        }
      }
      for (const p of candidates) {
        const { x, y, dx, dy } = p;
        const axis = dx ? 'h' : 'v';
        if (board.has(key(x - dx, y - dy)) || board.has(key(x + word.length * dx, y + word.length * dy))) continue;
        let valid = true;
        for (let i = 0; i < word.length && valid; i++) {
          const cx = x + i * dx, cy = y + i * dy, cell = board.get(key(cx, cy));
          if (cell) valid = cell.letter === word[i] && !cell[axis];
          else valid = !board.has(key(cx + dy, cy + dx)) && !board.has(key(cx - dy, cy - dx));
        }
        if (!valid) continue;
        const next = new Map([...board].map(([k, v]) => [k, { ...v }]));
        const cells = [];
        for (let i = 0; i < word.length; i++) {
          const cx = x + i * dx, cy = y + i * dy, k = key(cx, cy);
          next.set(k, { ...next.get(k), x: cx, y: cy, letter: word[i], [axis]: true });
          cells.push(k);
        }
        const result = place(next, remaining.filter((_, i) => i !== w), [...placed, { word, ...p, cells }]);
        if (result) return result;
      }
    }
    return null;
  }
  const result = place(new Map(), ordered, []);
  if (!result) throw new Error(`Cannot lay out crossword: ${words.join(', ')}`);
  const cells = [...result.board.values()];
  const minX = Math.min(...cells.map(c => c.x)), minY = Math.min(...cells.map(c => c.y));
  const toKey = k => { const [x, y] = k.split(',').map(Number); return key(x - minX, y - minY); };
  return {
    cols: Math.max(...cells.map(c => c.x)) - minX + 1,
    rows: Math.max(...cells.map(c => c.y)) - minY + 1,
    cells: cells.map(c => ({ x: c.x - minX, y: c.y - minY, letter: c.letter, key: key(c.x - minX, c.y - minY) })),
    words: result.placed.map(p => ({ word: p.word, cells: p.cells.map(toKey) })),
  };
}

for (const [language,levels] of Object.entries(LEVELS)) {
  for (const level of levels) {
    level.mode ||= 'crossword';
    level.board = level.mode==='wordsearch' ? makeWordSearch(level.words,language,level.letters.join('')+level.words.join(':'))
      : level.mode==='rows' ? makeWordRows(level.words) : makeCrossword(level.words);
  }
}

export function dayStamp(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Tallinn' }).format(date);
}

export function sessionFor(id) {
  const match = /^(et|ru|en):(level|daily|practice):(.+)$/.exec(id);
  if (!match) return null;
  const [, language, mode, value] = match;
  let index;
  if (mode === 'daily') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
    // Preserve old dated puzzles, including their revealed-cell coordinates.
    // These pool sizes are release boundaries, not the mutable level count.
    const poolSize = value < '2026-10-29' ? { et: 12, ru: 6, en: 6 }[language] : { et: 24, ru: 12, en: 12 }[language];
    index = [...value].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0) % poolSize;
  } else {
    if (!/^(0|[1-9]\d*)$/.test(value)) return null;
    index = Number(value);
    if (!Number.isInteger(index) || !LEVELS[language][index]) return null;
  }
  return { id, language, daily: mode === 'daily', practice: mode === 'practice', index, ...LEVELS[language][index] };
}
