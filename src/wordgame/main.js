import './style.css';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LANGUAGES, LANGUAGE_NAMES, LEVELS, dayStamp, sessionFor, chapterFor, chaptersFor } from './levels.js';
import { STORAGE_KEY, HINT_COST, PACKS, normalizeState, getGame, isFinished, completedCount,
  unlockedLevel, visibleCells, submitWord, submitSearchPath, useHint, demoPurchase } from './engine.js';
import { translate } from './i18n.js';
import { straightPath } from './boards.js';

const paths = {
  leaf: '<path d="M20 3C6 1 1 11 6 17S23 18 20 3ZM5 21 16 8"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
  coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="m12 8 1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4Z"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Zm6-3v15m6-12v15"/>',
  shop: '<path d="M4 9v12h16V9M3 9l2-6h14l2 6M3 9c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0M9 21v-7h6v7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  bulb: '<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4Z"/>',
  shuffle: '<path d="M3 6h3c4 0 8 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6m2-3c2-3 3-3 7-3m-4-4 4 4-4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.1"/>',
  sound: '<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4V5Zm5 4 6 6m0-6-6 6"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.leaf}</svg>`;
const logo = '<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M30 36C12 35 11 15 12 9c18 0 24 10 18 27Zm4-9C32 12 43 5 54 6c1 14-6 23-20 21Z" fill="currentColor"/><path d="M6 54c8-15 35-9 34-20-1-4-9-4-9-4 30 2 26 13 12 18-12 4-7 8-7 8H6Z" fill="currentColor"/></svg>';
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = document.querySelector('#word-app');
const dialog = document.querySelector('#word-dialog');
const toastElement = document.querySelector('#word-toast');
let saved;
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { saved = null; }
let state = normalizeState(saved);
let view = 'home', returnView = 'home', sessionId = null, letters = [], selection = [], pointer = null;
let searchSelection = [], searchAnchor = null, boardObserver;
let toastTimer, audio, storageWarning = false, pendingPurchase = null, completionReward = 0;
const nativePlatform = Capacitor.isNativePlatform();
let offlineReady = nativePlatform || document.documentElement.hasAttribute('data-standalone'), installPrompt = null;
const t = (key, values) => translate(state.language, key, values);
const session = () => sessionFor(sessionId);
const amount = n => new Intl.NumberFormat(state.language).format(n);
const price = n => new Intl.NumberFormat(state.language, { style: 'currency', currency: 'EUR' }).format(n);
const resumeIndex = () => isFinished(state, `${state.language}:level:${state.current[state.language]}`)
  ? unlockedLevel(state, state.language) : state.current[state.language];
const activeChapter = () => chapterFor(state.language, view === 'game' && sessionId ? session().index : resumeIndex());
const chapterLabel = chapter => t('chapterLabel', { n: chapter.number, name: t(`${chapter.id}Name`).toLocaleUpperCase(state.language) });
const chapterCompleted = chapter => Array.from({length:chapter.end - chapter.start}, (_, i) => isFinished(state, `${state.language}:level:${chapter.start + i}`)).filter(Boolean).length;

function toast(message) {
  toastElement.textContent = message;
  toastElement.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove('visible'), 3800);
}
function clearToast() {
  clearTimeout(toastTimer);
  toastElement.classList.remove('visible');
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch {
    if (!storageWarning) { storageWarning = true; toast(t('storageError')); }
  }
}
function sound(win = false) {
  if (!state.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    (win ? [523, 659, 784] : [659, 784]).forEach((frequency, i) => {
      const osc = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + i * .09;
      osc.frequency.value = frequency; osc.type = 'sine';
      gain.gain.setValueAtTime(.035, at); gain.gain.exponentialRampToValueAtTime(.001, at + .24);
      osc.connect(gain); gain.connect(audio.destination); osc.start(at); osc.stop(at + .25);
    });
  } catch { /* Sound is an optional enhancement. */ }
}
function nav() {
  return `<nav class="bottom-nav" aria-label="${esc(t('map'))}">${['home', 'map', 'shop'].map(name => `<button data-action="${name}" ${view === name ? 'aria-current="page"' : ''}>${icon(name)}<span>${t(name)}</span></button>`).join('')}</nav>`;
}
function header() {
  return `<header class="header"><button class="brand" data-action="home" aria-label="Sõnarännak">${logo}<span>Sõnarännak<small>${t('tagline')}</small></span></button>
    <div class="header-actions"><button class="wallet" data-action="shop" aria-label="${esc(t('wallet', { n: amount(state.coins) }))}">${icon('coin')}<strong data-wallet>${amount(state.coins)}</strong><span class="wallet-plus">+</span></button>
      <button class="language-button" data-action="language" aria-label="${esc(t('language'))}">${icon('globe')}<span>${state.language.toUpperCase()}</span></button>
      <button class="round-button install-button" data-action="install" aria-label="${esc(t('install'))}" ${installPrompt ? '' : 'hidden'}>${icon('download')}</button><button class="round-button desktop-help" data-action="help" aria-label="${esc(t('help'))}">${icon('help')}</button></div></header>`;
}
function homeScreen() {
  const done = completedCount(state, state.language), total = LEVELS[state.language].length;
  const current = resumeIndex(), started = Object.keys(state.games).some(id => id.startsWith(`${state.language}:level:`));
  const chapter = activeChapter();
  const dailyDone = isFinished(state, `${state.language}:daily:${dayStamp()}`);
  return `<main class="home-layout"><section class="hero-copy"><div class="eyebrow">${icon('sun')}${chapterLabel(chapter)}</div>
      <h1>${t('heroA')}<br><em>${t('heroB')}</em></h1><p class="hero-intro">${t('intro')}</p>
      <button class="primary-button start-button" data-action="continue"><span>${t(done === total ? 'playAgain' : started ? 'continue' : 'begin')}<small>${t('level', { n: current + 1 })} · ${LANGUAGE_NAMES[state.language]}</small></span>${icon('arrow')}</button>
      <button class="daily-card" data-action="daily"><span class="daily-icon">${icon('sun')}</span><span><strong>${t('daily')}</strong><small>${t(dailyDone ? 'dailyDone' : 'dailyNote')}</small></span><span class="daily-reward">${dailyDone ? icon('check') : t('dailyReward')}</span></button>
      <div class="hero-footnote">${icon('leaf')}${t('slow')}</div>
    </section><section class="postcard" aria-label="${esc(t('progress'))}"><div class="postcard-top"><span class="chapter-number">${String(chapter.number).padStart(2,'0')}</span><span>${t(`${chapter.id}Title`)}<small>${t(`${chapter.id}Note`)}</small></span>${icon('leaf')}</div>
      <div class="postcard-scene"><div class="scene-label">${chapter.coordinates}</div><div class="trail-line"></div>${Array.from({ length: Math.min(4, chapter.end - chapter.start) }, (_, i) => {
        const index = chapter.start + i;
        const unlocked = index <= unlockedLevel(state, state.language), finished = isFinished(state, `${state.language}:level:${index}`);
        return `<button class="trail-stop stop-${i} ${finished ? 'done' : ''} ${index === current ? 'current' : ''}" data-level="${index}" ${!unlocked ? 'disabled' : ''} aria-label="${esc(t('level', { n: index + 1 }))}">${finished ? icon('check') : unlocked ? index + 1 : icon('lock')}</button>`;
      }).join('')}<span class="scene-caption">${t(`${chapter.id}Name`)}</span></div>
      <button class="postcard-bottom" data-action="map"><span><strong>${t('progress')}</strong><small>${t('progressNote', { done, total })}</small></span><span class="small-progress"><i style="width:${done / total * 100}%"></i></span>${icon('arrow')}</button>
    </section></main>${modeChoices()}${chapterTeasers()}`;
}
function modeChoices() {
  return `<section class="mode-choices" aria-label="${esc(t('gameModes'))}"><div class="chapter-teasers-label">${t('gameModes')}<span>${t('practiceFree')}</span></div><div class="mode-buttons">${['crossword','wordsearch','rows'].map((mode,i)=>`<button data-mode-start="${mode}"><span class="mode-symbol">${['✣','⌕','≡'][i]}</span><span><strong>${t(`mode_${mode}`)}</strong><small>${t(`modeNote_${mode}`)}</small></span>${icon('arrow')}</button>`).join('')}</div></section>`;
}
function chapterTeasers() {
  return `<section class="chapter-teasers" aria-label="${esc(t('chapters'))}"><div class="chapter-teasers-label">${t('chapters')}</div><div class="chapter-cards">${chaptersFor(state.language).map(chapter => {
    const unlocked = chapter.start <= unlockedLevel(state, state.language);
    return `<button class="chapter-card" data-chapter="${chapter.id}" data-chapter-start="${chapter.start}" ${unlocked ? '' : 'disabled'}><span class="chapter-art scene-${chapter.id}"></span><span class="chapter-card-copy"><small>0${chapter.number}</small><strong>${t(`${chapter.id}Name`)}</strong><span>${t('chapterProgress', { done: chapterCompleted(chapter), total: chapter.end - chapter.start })}</span></span>${icon(unlocked ? 'arrow' : 'lock')}</button>`;
  }).join('')}</div></section>`;
}
function mapScreen() {
  return `<main class="inner-page map-page"><div class="eyebrow">${t('chapters')}</div><h1>${t('progress')}</h1><p class="page-intro">${t('mapIntro')}<br>${t('mapSubtitle')}</p><div class="chapter-list">${chaptersFor(state.language).map(chapter => `
    <section class="map-card" id="chapter-${chapter.id}"><div class="map-scene scene-${chapter.id}"><span>0${chapter.number}</span><strong>${t(`${chapter.id}Title`)}</strong>${icon(chapter.start <= unlockedLevel(state, state.language) ? 'leaf' : 'lock')}</div><div class="map-card-header"><span>${t(`${chapter.id}Name`)}</span><span>${t('chapterProgress', { done: chapterCompleted(chapter), total: chapter.end - chapter.start })}</span></div><div class="level-grid">${LEVELS[state.language].slice(chapter.start, chapter.end).map((_, j) => {
      const i = chapter.start + j;
      const finished = isFinished(state, `${state.language}:level:${i}`), unlocked = i <= unlockedLevel(state, state.language);
      return `<button class="level-stop ${finished ? 'done' : ''} ${unlocked && !finished ? 'current' : ''}" data-level="${i}" ${!unlocked ? 'disabled' : ''} aria-label="${esc(`${t('level', { n: i + 1 })} · ${t(finished ? 'completed' : unlocked ? 'available' : 'locked')}`)}"><span>${finished ? icon('check') : unlocked ? i + 1 : icon('lock')}</span><small>${t('level', { n: i + 1 })}</small></button>`;
    }).join('')}</div></section>`).join('')}</div></main>`;
}
function letterPosition(index) {
  const angle = index * Math.PI * 2 / letters.length;
  return { x: 150 + Math.sin(angle) * 108, y: 150 - Math.cos(angle) * 108 };
}
function gameScreen() {
  const level = session(), game = getGame(state, sessionId), visible = visibleCells(level, game);
  const complete = isFinished(state, sessionId);
  const chapter = activeChapter();
  const search=level.mode==='wordsearch', transpose=level.mode==='crossword'&&level.board.rows>level.board.cols;
  const cols=transpose?level.board.rows:level.board.cols, rows=transpose?level.board.cols:level.board.rows;
  const tileSize = Math.min(46, Math.floor(210 / rows), Math.floor(310 / cols));
  const foundKeys=new Set(level.board.words.filter(w=>game.found.includes(w.word)).flatMap(w=>game.paths?.[w.word]||w.cells));
  return `<main class="game-layout"><aside class="game-story"><div class="eyebrow">${chapterLabel(chapter)}</div><h1>${t(`${chapter.id}Title`)}</h1><p>${t(`${chapter.id}Note`)}</p><div class="story-rule"></div><span class="story-coordinate">${chapter.coordinates.replace(' · ', '<br>')}</span><p class="story-note">${t('slow')}</p><button class="text-button" data-action="help">${icon('help')}${t('help')}</button></aside>
    <section class="play-card" data-mode="${level.mode}" aria-label="${esc(t(search?'mode_wordsearch':'connect'))}"><div class="play-heading"><button class="round-button" data-action="back" aria-label="${esc(t('back'))}">${icon('back')}</button><div><span class="eyebrow">${level.practice ? t('practiceLabel') : level.daily ? t('daily') : t(`${chapter.id}Name`).toLocaleUpperCase(state.language)}</span><h2>${level.practice ? t(`mode_${level.mode}`) : level.daily ? new Intl.DateTimeFormat(state.language, { day: 'numeric', month: 'long', timeZone: 'Europe/Tallinn' }).format(new Date()) : t('level', { n: level.index + 1 })}</h2></div><button class="round-button" data-action="sound" aria-label="${esc(t(state.sound ? 'soundOn' : 'soundOff'))}">${icon(state.sound ? 'sound' : 'mute')}</button></div>
      <div class="word-progress" role="status">${complete ? icon('check') : '<span class="progress-dot"></span>'}${t('found', { n: game.found.length, total: level.words.length })}</div>
      <div class="crossword-space"><div class="crossword ${search?'search-board':''} ${level.mode==='rows'?'word-rows':''}" data-cols="${cols}" data-rows="${rows}" style="--cols:${cols};--rows:${rows};--tile:${tileSize}px" aria-label="${esc(t('answers'))}">${level.board.cells.map(c => {
        const found = foundKeys.has(c.key), tag=search?'button':'span', shown=search||visible.has(c.key);
        return `<${tag} class="crossword-tile ${found ? 'found' : visible.has(c.key) ? 'hinted' : ''}" data-cell="${c.key}" ${search?`data-search-cell="${c.key}" aria-pressed="false"`:''} style="grid-column:${(transpose?c.y:c.x) + 1};grid-row:${(transpose?c.x:c.y) + 1}" aria-label="${shown ? c.letter : '·'}">${shown ? c.letter : ''}</${tag}>`;
      }).join('')}</div></div>
      <div class="word-preview" aria-live="polite"><span id="selected-word">${t(complete ? 'completed' : search?'searchInstructionsShort':'select')}</span></div>
      ${search?`<div class="search-targets">${level.words.map(word=>`<span class="${game.found.includes(word)?'discovered':''}">${word}${game.found.includes(word)?icon('check'):''}</span>`).join('')}</div>`:`<div class="letter-wheel ${complete ? 'finished-wheel' : ''}" id="letter-wheel"><svg class="connection-lines" viewBox="0 0 300 300" aria-hidden="true"><polyline id="letter-line" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>${letters.map((item, i) => {
        const p = letterPosition(i);
        return `<button class="letter" data-letter="${item.id}" style="left:${p.x / 3}%;top:${p.y / 3}%" aria-label="${esc(t('letter', { letter: item.letter, n: item.id + 1 }))}" aria-pressed="false" ${complete ? 'disabled' : ''}>${item.letter}</button>`;
      }).join('')}<button class="wheel-shuffle" data-action="shuffle" aria-label="${esc(t('shuffle'))}">${icon('shuffle')}</button></div>`}
      <div class="word-actions"><button class="text-button clear-button" data-action="clear" disabled>${t('clear')}</button><button class="submit-button" data-action="submit" disabled>${t('submit')}${icon('check')}</button></div>
      ${complete ? `<button class="primary-button complete-button" data-action="show-win">${t(level.daily ? 'dailyDone' : 'completed')}${icon('arrow')}</button>` : `<div class="play-tools"><button class="hint-button" data-action="hint">${icon('bulb')}<span>${t('hint')}<small>${t(search?'searchHint':'hintNote')}</small></span><span class="hint-cost">${level.practice?t('free'):icon('coin')+HINT_COST}</span></button><button class="round-button mobile-bonus" data-action="bonus" aria-label="${esc(t('bonusCount', { n: game.bonus.length }))}">${icon('star')}<small>${game.bonus.length}</small></button><button class="round-button mobile-help" data-action="help" aria-label="${esc(t('help'))}">${icon('help')}</button></div>`}
      <p class="tap-help">${t(search?'searchInstructions':'tapHelp')}</p></section>
    <aside class="word-notes"><div class="notes-icon">${icon('leaf')}</div><h3>${t('answers')}</h3><p>${t('answersNote')}</p><ul class="answer-list">${level.words.map(word => `<li class="${game.found.includes(word) ? 'discovered' : ''}"><span>${game.found.includes(word) ? word : '· '.repeat(word.length).trim()}</span>${game.found.includes(word) ? icon('check') : `<small>${word.length}</small>`}</li>`).join('')}</ul><div class="bonus-note">${icon('star')}<h3>${t('bonus')}</h3><p>${t(level.practice?'practiceBonusNote':'bonusNote')}</p><div class="bonus-words">${game.bonus.length ? game.bonus.map(w => `<span>${w}</span>`).join('') : `<small>${t('bonusEmpty')}</small>`}</div></div></aside></main>`;
}
function shopScreen() {
  const recent = state.purchases.at(-1), recentPack = PACKS.find(p => p.id === recent?.pack);
  return `<main class="inner-page shop-page"><button class="text-button shop-back" data-action="back">${icon('back')}${t('returnShop')}</button><div class="eyebrow">${t('shopEyebrow')}</div><h1>${t('shopTitle')}</h1><p class="page-intro">${t('shopIntro')}</p><div class="demo-notice"><span>${icon('leaf')}${t('demo')}</span><p>${t('demoNote')}</p></div>
      <section class="shop-packs" aria-label="${esc(t('shop'))}">${PACKS.map((pack, i) => `<article class="pack-card ${i === 1 ? 'featured' : ''}">${i === 1 ? `<span class="pack-badge">${t('recommended')}</span>` : ''}<div class="coin-art coins-${i}" aria-hidden="true">${Array.from({ length: i + 2 }, (_, n) => `<span style="--n:${n}">${icon('coin')}</span>`).join('')}</div><h2>${t(pack.id)}</h2><strong class="pack-amount">${t('coins', { n: amount(pack.coins) })}</strong><p>${t(['packPocket', 'packJourney', 'packAdventure'][i])}</p><span class="sample-price">${t('samplePrice', { price: price(pack.price) })}</span><button class="primary-button" data-pack="${pack.id}">${t('tryPurchase')}${icon('arrow')}</button></article>`).join('')}</section>
      <div class="earn-note">${icon('sun')}<div><strong>${t('earnTitle')}</strong><p>${t('earnNote')}</p></div></div>${recentPack ? `<p class="purchase-history">${t('recent')}: ${t('recentNote', { n: amount(recentPack.coins), date: Number.isFinite(Date.parse(recent.at)) ? new Intl.DateTimeFormat(state.language, { dateStyle: 'short', timeZone: 'Europe/Tallinn' }).format(new Date(recent.at)) : '—' })}</p>` : ''}</main>`;
}
function render() {
  pointer = null; selection = []; searchSelection=[]; searchAnchor=null;
  boardObserver?.disconnect();
  document.documentElement.lang = state.language;
  document.documentElement.dataset.chapter = activeChapter().id;
  document.title = `Sõnarännak · ${t('tagline')}`;
  app.dataset.view = view;
  app.innerHTML = `${header()}${view === 'home' ? homeScreen() : view === 'game' ? gameScreen() : view === 'map' ? mapScreen() : shopScreen()}<footer class="footer"><span id="offline-status" role="status"></span>${nav()}<span>${t('stage')}</span></footer>`;
  updateOfflineStatus();
  const boardSpace=document.querySelector('.crossword-space');
  if(boardSpace){fitBoard();boardObserver=new ResizeObserver(fitBoard);boardObserver.observe(boardSpace);}
}
function fitBoard() {
  const space=document.querySelector('.crossword-space'),board=space?.querySelector('.crossword');
  if(!board)return;
  const r=space.getBoundingClientRect(),style=getComputedStyle(space),boardStyle=getComputedStyle(board),rowGap=Number.parseFloat(boardStyle.rowGap)||4,colGap=Number.parseFloat(boardStyle.columnGap)||4;
  const width=r.width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  const height=r.height-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  const tile=Math.max(12,Math.floor(Math.min(46,(width-(Number(board.dataset.cols)-1)*colGap)/Number(board.dataset.cols),(height-(Number(board.dataset.rows)-1)*rowGap)/Number(board.dataset.rows))));
  if(board.style.getPropertyValue('--tile')!==`${tile}px`)board.style.setProperty('--tile',`${tile}px`);
}
function closeModal() { dialog.close(); pendingPurchase = null; }
function modal(title, content, className = '') {
  if (dialog.open) dialog.close();
  dialog.className = className;
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button class="round-button" data-action="close" aria-label="${esc(t('close'))}">${icon('close')}</button></div>${content}`;
  dialog.showModal();
}
function showLanguages() {
  modal(t('language'), `<p class="dialog-intro">${t('chooseLanguage')}</p><div class="language-list">${LANGUAGES.map(lang => `<button data-language="${lang}" ${state.language === lang ? 'aria-current="true"' : ''}><span class="language-code">${lang.toUpperCase()}</span><strong>${LANGUAGE_NAMES[lang]}</strong>${state.language === lang ? icon('check') : icon('arrow')}</button>`).join('')}</div><p class="small-note">${t('languageNote')}</p><div class="coming-languages"><strong>${t('coming')}</strong><span>${t('comingNote')}</span></div>`);
}
function showHelp() {
  modal(t('help'), `<div class="help-leaf">${logo}</div><h3>${t('helpTitle')}</h3><ol class="help-steps">${[1, 2, 3, 4].map(i => `<li>${t(`help${i}`)}</li>`).join('')}<li>${t('searchInstructions')}</li><li>${t('practiceFree')}</li></ol><p class="small-note">${t('storageNote')}</p><p class="small-note">${t('curatedNote')}</p>`);
}
function showWin() {
  const level = session(), last = level.index === LEVELS[state.language].length - 1;
  const chapter = activeChapter(), chapterLast = level.index === chapter.end - 1;
  const title = level.practice?t('practiceDone'):level.daily ? t('dailyWin') : last ? t('journeyComplete') : chapterLast ? t('chapterComplete', { name: t(`${chapter.id}Name`) }) : t('wellDone');
  modal(title, `<div class="win-emblem">${icon('leaf')}</div><p class="win-copy">${t(level.practice?'practiceFree':level.daily ? 'winNote' : last ? 'journeyCompleteNote' : chapterLast ? 'chapterCompleteNote' : 'winNote')}</p><div class="win-reward">${level.practice?'':icon('coin')}${level.practice?t('practiceLabel'):completionReward ? t('reward', { n: completionReward }) : t('completed')}</div><button class="primary-button" data-action="next">${t(level.practice?'nextPractice':level.daily || last ? 'map' : chapterLast ? 'nextChapter' : 'next')}${icon('arrow')}</button><button class="text-button win-see" data-action="close">${t('seeLevel')}</button>`, 'win-dialog');
}
function enterLevel(index, daily = false, practice = false) {
  if(!LEVELS[state.language][index])return;
  if (!daily && !practice && (index < 0 || index > unlockedLevel(state, state.language))) return;
  clearToast();
  sessionId = `${state.language}:${daily ? `daily:${dayStamp()}` : `${practice?'practice':'level'}:${index}`}`;
  if (!daily && !practice) state.current[state.language] = index;
  letters = session().letters.map((letter, id) => ({ id, letter }));
  completionReward = 0; view = 'game';
  persist(); render(); window.scrollTo(0, 0);
}
function enterPractice(mode, after=-1) {
  const options=LEVELS[state.language].map((l,i)=>({l,i})).filter(p=>p.l.mode===mode);
  if(!options.length)return;
  const index=(after>=0?options.find(p=>p.i>after):options.find(p=>!isFinished(state,`${state.language}:practice:${p.i}`)))?.i??options[0].i;
  if(isFinished(state,`${state.language}:practice:${index}`)) delete state.games[`${state.language}:practice:${index}`];
  enterLevel(index,false,true);
}
function acceptResult(result, word = '') {
  state = result.state;
  if (['found', 'bonus', 'hint'].includes(result.status)) {
    persist(); render(); sound(result.complete);
    toast(t(result.status === 'bonus' ? session().practice?'practiceBonus':'bonusFound' : result.status === 'hint' ? session().mode==='wordsearch'?'searchHintUsed':'hintUsed' : 'wordFound', { word }));
    if (result.complete) { completionReward = result.reward; showWin(); }
  } else {
    clearSelection();
    toast(t(result.status === 'insufficient' ? 'notEnough' : result.status === 'duplicate' ? 'duplicate' : 'invalid'));
  }
}
function submitSelection() {
  if(session()?.mode==='wordsearch') {
    if(searchSelection.length>1){const result=submitSearchPath(state,sessionId,searchSelection);acceptResult(result,result.word);}
    return;
  }
  if (selection.length < 2 || isFinished(state, sessionId)) return;
  const word = selection.map(id => letters.find(l => l.id === id).letter).join('');
  acceptResult(submitWord(state, sessionId, word), word);
}
function clearSelection() {
  selection=[]; searchSelection=[];searchAnchor=null;
  if(session()?.mode==='wordsearch') updateSearchSelection();else updateWheel();
}
function updateSearchSelection() {
  const grid=document.querySelector('.search-board');if(!grid)return;
  grid.querySelectorAll('[data-search-cell]').forEach(button=>{
    const active=searchSelection.includes(button.dataset.searchCell);
    button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));
  });
  const word=searchSelection.map(k=>session().board.cells.find(c=>c.key===k)?.letter||'').join('');
  document.querySelector('#selected-word').textContent=word||t('searchInstructionsShort');
  document.querySelector('.word-preview').classList.toggle('has-word',!!word);
  document.querySelector('[data-action="submit"]').disabled=searchSelection.length<2;
  document.querySelector('[data-action="clear"]').disabled=!searchSelection.length;
}
function searchCellAt(x,y) {
  return document.elementFromPoint(x,y)?.closest('[data-search-cell]')?.dataset.searchCell;
}
function updateWheel() {
  const wheel = document.querySelector('#letter-wheel');
  if (!wheel) return;
  wheel.querySelectorAll('[data-letter]').forEach(button => {
    const selected = selection.includes(Number(button.dataset.letter));
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const points = selection.map(id => letterPosition(letters.findIndex(l => l.id === id)));
  if (pointer?.moved && selection.length) points.push(pointer.tip);
  document.querySelector('#letter-line').setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
  const word = selection.map(id => letters.find(l => l.id === id).letter).join('');
  const preview = document.querySelector('#selected-word');
  preview.textContent = word || t(isFinished(state, sessionId) ? 'completed' : 'select');
  preview.parentElement.classList.toggle('has-word', !!word);
  document.querySelector('[data-action="submit"]').disabled = selection.length < 2;
  document.querySelector('[data-action="clear"]').disabled = !selection.length;
}
function pick(id) {
  if (isFinished(state, sessionId)) return;
  if (selection.at(-2) === id) selection.pop();
  else if (!selection.includes(id)) selection.push(id);
  updateWheel();
}
function shuffle() {
  const before = letters.map(l => l.letter).join(',');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  if (letters.map(l => l.letter).join(',') === before) letters.push(letters.shift());
  render();
}
function navigate(next) {
  clearToast();
  if (next === 'shop' && view !== 'shop') returnView = view;
  view = next; render(); window.scrollTo(0, 0);
}
function action(name) {
  if (name === 'close') { closeModal(); return; }
  if (name === 'language') { showLanguages(); return; }
  if (name === 'help') { showHelp(); return; }
  if (name === 'install' && installPrompt) {
    const prompt = installPrompt; installPrompt = null;
    prompt.prompt().catch(() => {});
    const button = document.querySelector('[data-action="install"]');
    if (button) button.hidden = true;
    return;
  }
  if (name === 'bonus') {
    const game = getGame(state, sessionId);
    modal(t('bonus'), `<p class="dialog-intro">${t(session()?.practice?'practiceBonusNote':'bonusNote')}</p><div class="bonus-words">${game.bonus.length ? game.bonus.map(w => `<span>${w}</span>`).join('') : t('bonusEmpty')}</div><p class="small-note">${t('curatedNote')}</p>`);
    return;
  }
  if (name === 'sound') { state.sound = !state.sound; persist(); render(); return; }
  if (name === 'continue') { enterLevel(resumeIndex()); return; }
  if (name === 'daily') { enterLevel(0, true); return; }
  if (name === 'back') { navigate(view === 'shop' ? returnView : 'home'); return; }
  if (['home', 'map', 'shop'].includes(name)) { navigate(name); return; }
  if (name === 'clear') { clearSelection(); return; }
  if (name === 'submit') { submitSelection(); return; }
  if (name === 'shuffle') { shuffle(); return; }
  if (name === 'hint') { acceptResult(useHint(state, sessionId)); return; }
  if (name === 'show-win') { completionReward = 0; showWin(); return; }
  if (name === 'next') {
    const level = session(); closeModal();
    if(level.practice){enterPractice(level.mode,level.index);return;}
    if (level.daily || level.index + 1 >= LEVELS[state.language].length) navigate('map');
    else enterLevel(level.index + 1);
    return;
  }
  if (name === 'confirm-purchase' && pendingPurchase) {
    const packId = pendingPurchase; pendingPurchase = null;
    const result = demoPurchase(state, packId);
    if (result.status === 'demo') {
      state = result.state; persist(); closeModal(); render(); sound(); toast(t('bought', { n: amount(result.coins) }));
    }
  }
}
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.action) action(button.dataset.action);
  else if (button.dataset.level !== undefined) enterLevel(Number(button.dataset.level));
  else if (button.dataset.modeStart) enterPractice(button.dataset.modeStart);
  else if (button.dataset.searchCell && event.detail===0) {
    const key=button.dataset.searchCell;
    if(!searchAnchor){searchAnchor=key;searchSelection=[key];updateSearchSelection();}
    else{searchSelection=straightPath(session().board,searchAnchor,key);updateSearchSelection();if(searchSelection.length>1)submitSelection();else clearSelection();}
  }
  else if (button.dataset.chapterStart !== undefined) {
    if (Number(button.dataset.chapterStart) <= unlockedLevel(state, state.language)) {
      navigate('map'); document.querySelector(`#chapter-${button.dataset.chapter}`)?.scrollIntoView({ block: 'start' });
    }
  }
  else if (button.dataset.language) {
    state.language = button.dataset.language;
    closeModal(); persist(); navigate('home');
  } else if (button.dataset.pack) {
    const pack = PACKS.find(p => p.id === button.dataset.pack);
    if (!pack) return;
    pendingPurchase = pack.id;
    modal(t('confirmTitle', { n: amount(pack.coins) }), `<div class="confirm-coins">${icon('coin')}+${amount(pack.coins)}</div><p class="dialog-intro">${t('confirmNote')}</p><button class="primary-button" data-action="confirm-purchase">${t('confirm')}</button><button class="text-button win-see" data-action="close">${t('cancel')}</button>`);
  } else if (button.dataset.letter !== undefined && event.detail === 0) pick(Number(button.dataset.letter));
});
dialog.addEventListener('close', () => { pendingPurchase = null; });
app.addEventListener('pointerdown', event => {
  const searchButton=event.target.closest('[data-search-cell]');
  if(searchButton){
    if(isFinished(state,sessionId)||event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;
    searchAnchor ||= searchButton.dataset.searchCell;
    searchSelection=straightPath(session().board,searchAnchor,searchButton.dataset.searchCell);
    pointer={id:event.pointerId,search:true,moved:false};updateSearchSelection();
    searchButton.closest('.search-board').setPointerCapture(event.pointerId);return;
  }
  const button = event.target.closest('[data-letter]');
  if (!button || button.disabled || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
  const wheel = button.closest('#letter-wheel');
  const rect = wheel.getBoundingClientRect();
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false,
    tip: { x: (event.clientX - rect.left) / rect.width * 300, y: (event.clientY - rect.top) / rect.height * 300 } };
  pick(Number(button.dataset.letter));
  wheel.setPointerCapture(event.pointerId);
});
app.addEventListener('pointermove', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  if(pointer.search){
    const key=searchCellAt(event.clientX,event.clientY);
    if(key){searchSelection=straightPath(session().board,searchAnchor,key);updateSearchSelection();}return;
  }
  const wheel = document.querySelector('#letter-wheel'), rect = wheel.getBoundingClientRect();
  if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8) pointer.moved = true;
  pointer.tip = { x: (event.clientX - rect.left) / rect.width * 300, y: (event.clientY - rect.top) / rect.height * 300 };
  for (const button of wheel.querySelectorAll('[data-letter]')) {
    const r = button.getBoundingClientRect();
    if (Math.hypot(event.clientX - r.left - r.width / 2, event.clientY - r.top - r.height / 2) < r.width / 2 + 3) {
      pick(Number(button.dataset.letter)); break;
    }
  }
  updateWheel();
});
app.addEventListener('pointerup', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  if(pointer.search){pointer=null;if(searchSelection.length>1)submitSelection();else if(!searchSelection.length){clearSelection();toast(t('invalid'));}return;}
  const moved = pointer.moved; pointer = null;
  if (moved && selection.length > 1) submitSelection();
  else updateWheel();
});
app.addEventListener('pointercancel', () => { pointer = null; clearSelection(); });
document.addEventListener('keydown', event => {
  if (view !== 'game' || dialog.open || event.ctrlKey || event.altKey || event.metaKey
    || event.target.matches('input, textarea, select') || isFinished(state, sessionId)) return;
  if(session().mode==='wordsearch') {if(event.key==='Escape')clearSelection();return;}
  if (event.key === 'Enter' && selection.length > 1) { event.preventDefault(); submitSelection(); }
  else if (event.key === 'Backspace') { event.preventDefault(); selection.pop(); updateWheel(); }
  else if (event.key === 'Escape') { selection = []; updateWheel(); }
  else if (event.key.length === 1 && /\p{L}/u.test(event.key)) {
    const letter = event.key.toLocaleUpperCase(state.language);
    const item = letters.find(l => l.letter === letter && !selection.includes(l.id));
    if (item) { event.preventDefault(); pick(item.id); }
  }
});
function updateOfflineStatus() {
  const element = document.querySelector('#offline-status');
  if (!element) return;
  element.dataset.ready = String(offlineReady);
  element.innerHTML = `${icon('leaf')}<span>${t(!navigator.onLine ? offlineReady ? 'offlinePlaying' : 'noConnection' : offlineReady ? 'offlineReady' : 'slow')}</span>`;
}
window.addEventListener('online', updateOfflineStatus);
window.addEventListener('offline', updateOfflineStatus);
window.addEventListener('beforeinstallprompt', event => {
  if(window.innerWidth<=700)return;
  event.preventDefault(); installPrompt = event;
  const button = document.querySelector('[data-action="install"]');
  if (button) button.hidden = false;
});
document.documentElement.dataset.native=String(nativePlatform);
render();
if(nativePlatform){
  const NativeApp=registerPlugin('App');
  NativeApp.addListener('backButton',()=>{if(dialog.open)closeModal();else if(view!=='home')action('back');else NativeApp.exitApp();}).catch(()=>{});
  NativeApp.addListener('appStateChange',({isActive})=>{if(!isActive&&view==='game'){pointer=null;clearSelection();}}).catch(()=>{});
}
if (import.meta.env.PROD && !nativePlatform && !document.documentElement.hasAttribute('data-standalone') && 'serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL;
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).then(async () => {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'OFFLINE_STATUS' });
  }).catch(() => { /* The game still works online or as a standalone file. */ });
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'OFFLINE_READY') { offlineReady = true; updateOfflineStatus(); }
  });
}
