import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { LEVELS, dayStamp, sessionFor } from '../src/wordgame/levels.js';
import { STORAGE_KEY, normalizeState, submitWord } from '../src/wordgame/engine.js';

const balance = page => page.locator('[data-wallet]');
async function start(page) {
  await page.goto('./');
  await page.locator('[data-action="continue"]').click();
  await expect(page.locator('.play-card h2')).toHaveText('Tase 1');
}
async function enterWord(page, word) {
  const used = new Set();
  for (const letter of word) {
    const buttons = page.locator('[data-letter]');
    const count = await buttons.count();
    let selected = false;
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i), id = await button.getAttribute('data-letter');
      if (!used.has(id) && await button.textContent() === letter) {
        used.add(id); await button.click(); selected = true; break;
      }
    }
    expect(selected, `letter ${letter} available for ${word}`).toBeTruthy();
  }
  await page.locator('[data-action="submit"]').click();
}
async function complete(page, words) {
  for (const word of words) {
    if (await page.locator('dialog[open]').count()) break;
    await enterWord(page, word);
  }
}
async function seed(page, state) {
  await page.addInitScript(({key, value}) => {
    if (!sessionStorage.getItem('word-test-seeded')) {
      localStorage.setItem(key, JSON.stringify(value)); sessionStorage.setItem('word-test-seeded', '1');
    }
  }, {key:STORAGE_KEY, value:state});
}

test('home renders the scenic game, routes and language selection without overflow', async ({page}, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await expect(page).toHaveTitle(/Sõnarännak/);
  await expect(page.locator('.hero-copy h1')).toContainText('Iga sõnaga');
  await expect(page.locator('.trail-stop')).toHaveCount(4);
  await expect(page.locator('.trail-stop').nth(1)).toBeDisabled();
  await expect(page.locator('.chapter-card')).toHaveCount(6);
  await expect(page.locator('[data-mode-start]')).toHaveCount(3);
  await expect(page.locator('.chapter-card[data-chapter="bog"]')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const art = await page.locator('.postcard-scene').evaluate(async el => {
    const url = getComputedStyle(el).backgroundImage.match(/url\("?([^"\)]+)"?\)/)?.[1];
    if (!url) return false;
    const image = new Image(); image.src = url; await image.decode(); return image.naturalWidth > 1000;
  });
  expect(art).toBeTruthy();
  await page.screenshot({path:`artifacts/sonarannak-home-${info.project.name}.png`,fullPage:true});
  expect(errors).toEqual([]);
});

test('click selection respects repeated letters, rejects invalid words and stores accepted words', async ({page}) => {
  await start(page);
  await enterWord(page, 'KLA');
  await expect(page.locator('#word-toast')).toContainText('Proovi veel');
  await expect(balance(page)).toHaveText('120');
  await enterWord(page, 'KALA');
  await expect(page.locator('.answer-list .discovered')).toContainText('KALA');
  const foundBefore = await page.locator('.crossword-tile.found').count();
  expect(foundBefore).toBeGreaterThanOrEqual(4);
  await page.reload();
  await page.locator('[data-action="continue"]').click();
  await expect(page.locator('.crossword-tile.found')).toHaveCount(foundBefore);
  await enterWord(page, 'KALA');
  await expect(page.locator('#word-toast')).toContainText('juba leitud');
  await expect(balance(page)).toHaveText('120');
});

test('pointer dragging connects a real word and cancellation never submits it', async ({page}, info) => {
  await start(page);
  const points = [];
  for (const id of [0, 1, 2, 3]) {
    const box = await page.locator(`[data-letter="${id}"]`).boundingBox();
    points.push({x:box.x+box.width/2,y:box.y+box.height/2});
  }
  if (info.project.name === 'mobile') {
    const cdp = await page.context().newCDPSession(page);
    const send = (type, p) => cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p ? [{x:p.x,y:p.y}] : []});
    await send('touchStart',points[0]);
    for (const p of points.slice(1)) await send('touchMove',p);
    await send('touchEnd');
  } else {
    await page.mouse.move(points[0].x,points[0].y); await page.mouse.down();
    for (const p of points.slice(1)) await page.mouse.move(p.x,p.y,{steps:7});
    await page.mouse.up();
  }
  await expect(page.locator('.answer-list .discovered')).toContainText('KALA');
  await expect(balance(page)).toHaveText('120');
  if (info.project.name === 'mobile') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[points[1]]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  } else {
    await page.mouse.move(points[0].x,points[0].y); await page.mouse.down();
    await page.mouse.move(points[1].x,points[1].y,{steps:4});
    await page.locator('#letter-wheel').dispatchEvent('pointercancel',{pointerId:1});
    await page.mouse.up();
  }
  await expect(page.locator('#selected-word')).toHaveText('Vali tähed');
});

test('a completed level rewards once, unlocks the next and resumes after reload', async ({page}, info) => {
  await start(page);
  await complete(page, LEVELS.et[0].words);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(balance(page)).toHaveText('140');
  await page.screenshot({path:`artifacts/sonarannak-win-${info.project.name}.png`,fullPage:true});
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('.play-card h2')).toHaveText('Tase 2');
  await page.reload(); await page.locator('[data-action="continue"]').click();
  await expect(page.locator('.play-card h2')).toHaveText('Tase 2');
  await expect(balance(page)).toHaveText('140');
  await page.locator('.play-heading [data-action="back"]').click();
  await page.locator('.bottom-nav [data-action="map"]').click();
  await expect(page.locator('.level-stop').nth(1)).toBeEnabled();
  await expect(page.locator('.level-stop').nth(2)).toBeDisabled();
  await page.locator('.level-stop').first().click();
  await expect(balance(page)).toHaveText('140');
  await expect(page.locator('.crossword-tile.found')).toHaveCount(sessionFor('et:level:0').board.cells.length);
});

test('bonus reward and paid hints persist, shuffle stays free, and hint cannot overdraw', async ({page}, info) => {
  await start(page);
  await enterWord(page,'SAAL');
  await expect(balance(page)).toHaveText('125');
  await enterWord(page,'SAAL');
  await expect(balance(page)).toHaveText('125');
  await page.locator('[data-action="hint"]').click();
  await expect(balance(page)).toHaveText('100');
  await expect(page.locator('.crossword-tile.hinted')).toHaveCount(1);
  const before = await page.locator('[data-letter]').allTextContents();
  await page.locator('[data-action="shuffle"]').click();
  expect(await page.locator('[data-letter]').allTextContents()).not.toEqual(before);
  await expect(balance(page)).toHaveText('100');
  await page.screenshot({path:`artifacts/sonarannak-game-${info.project.name}.png`,fullPage:true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.reload(); await page.locator('[data-action="continue"]').click();
  await expect(balance(page)).toHaveText('100');
  await expect(page.locator('.crossword-tile.hinted')).toHaveCount(1);
  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key)); state.coins = 0; localStorage.setItem(key,JSON.stringify(state));
  }, STORAGE_KEY);
  await page.reload(); await page.locator('[data-action="continue"]').click();
  await page.locator('[data-action="hint"]').click();
  await expect(balance(page)).toHaveText('0');
  await expect(page.locator('#word-toast')).toContainText('25 münti');
});

test('shop clearly simulates purchases, cancel is free, confirmation credits once and returns to the same game', async ({page}, info) => {
  await start(page); await enterWord(page,'KALA');
  await page.locator('.wallet').click();
  await expect(page.locator('.demo-notice')).toContainText('Pärisraha ei kasutata');
  await expect(page.locator('.pack-card')).toHaveCount(3);
  await page.screenshot({path:`artifacts/sonarannak-shop-${info.project.name}.png`,fullPage:true});
  await page.locator('[data-pack="pocket"]').click();
  await expect(page.getByRole('dialog')).toContainText('tasuta näidisost');
  await page.getByRole('button',{name:'Loobu',exact:true}).click();
  await expect(balance(page)).toHaveText('120');
  await page.locator('[data-pack="pocket"]').click();
  await page.locator('[data-action="confirm-purchase"]').dblclick();
  await expect(balance(page)).toHaveText('420');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator('[data-action="back"]').click();
  await expect(page.locator('.play-card h2')).toHaveText('Tase 1');
  await expect(page.locator('.answer-list .discovered')).toContainText('KALA');
  await page.reload(); await page.locator('[data-action="continue"]').click();
  await expect(balance(page)).toHaveText('420');
  const purchases = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).purchases, STORAGE_KEY);
  expect(purchases).toHaveLength(1); expect(purchases[0].mode).toBe('demo');
});

test('language changes real words and keeps separate progress with one saved wallet', async ({page}) => {
  await start(page); await enterWord(page,'KALA');
  await page.locator('[data-action="language"]').click();
  await page.locator('[data-language="ru"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang','ru');
  await page.locator('[data-action="continue"]').click();
  expect((await page.locator('[data-letter]').allTextContents()).sort()).toEqual([...'КОТ'].sort());
  await complete(page,LEVELS.ru[0].words);
  await expect(balance(page)).toHaveText('140');
  await page.locator('.dialog-heading [data-action="close"]').click();
  await page.locator('[data-action="language"]').click(); await page.locator('[data-language="en"]').click();
  await page.locator('[data-action="continue"]').click();
  expect((await page.locator('[data-letter]').allTextContents()).sort()).toEqual([...'SEAR'].sort());
  await enterWord(page,'SEA');
  await page.locator('[data-action="language"]').click(); await page.locator('[data-language="et"]').click();
  await page.locator('[data-action="continue"]').click();
  await expect(page.locator('.answer-list .discovered')).toContainText('KALA');
  await expect(balance(page)).toHaveText('140');
});

test('daily completion awards 40 once without advancing the campaign', async ({page}) => {
  await page.goto('./'); await page.locator('[data-action="daily"]').click();
  await complete(page,sessionFor(`et:daily:${dayStamp()}`).words);
  await expect(balance(page)).toHaveText('160');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('.level-stop').nth(1)).toBeDisabled();
  await page.locator('.bottom-nav [data-action="home"]').click();
  await expect(page.locator('.daily-card')).toContainText('lahendatud');
  await page.locator('[data-action="daily"]').click();
  await expect(balance(page)).toHaveText('160');
  await expect(page.locator('.crossword-tile.found')).toHaveCount(sessionFor(`et:daily:${dayStamp()}`).board.cells.length);
});

test('the final level completes all chapters and keyboard entry works', async ({page}) => {
  let state = normalizeState(null);
  for (let i = 0; i < LEVELS.et.length - 1; i++) for (const word of LEVELS.et[i].words) state = submitWord(state,`et:level:${i}`,word).state;
  state.current.et = LEVELS.et.length - 1;
  await seed(page,state); await page.goto('./'); await page.locator('[data-action="continue"]').click();
  await expect(page.locator('.play-card h2')).toHaveText(`Tase ${LEVELS.et.length}`);
  // CDP can model an Estonian keyboard layout; Playwright's US key table has
  // no Ä key, and keyboard.type inserts non-ASCII text without a keydown event.
  const keyboard = await page.context().newCDPSession(page);
  const lastWord=LEVELS.et.at(-1).words[0];
  for (const letter of lastWord) {
    await keyboard.send('Input.dispatchKeyEvent',{type:'keyDown',key:letter,text:letter});
    await keyboard.send('Input.dispatchKeyEvent',{type:'keyUp',key:letter});
  }
  await page.keyboard.press('Enter');
  await expect(page.locator('.answer-list .discovered').filter({hasText:lastWord})).toContainText(lastWord);
  expect(await page.locator('.crossword-tile.found').count()).toBeGreaterThanOrEqual(lastWord.length);
  await complete(page,LEVELS.et.at(-1).words.filter(w=>w!==lastWord));
  await expect(page.getByRole('dialog')).toContainText('Milline ilus rännak');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('.level-stop.done')).toHaveCount(LEVELS.et.length);
});

test('production route and its art work under the repository base path', async ({page}) => {
  const errors = []; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4275/wordjourney/');
  await page.locator('[data-action="continue"]').click();
  await enterWord(page,'KALA');
  await expect(page.locator('.answer-list .discovered')).toContainText('KALA');
  expect(errors).toEqual([]);
});

test('production caches all chapter art and keeps progress and shop usable after offline reload', async ({page,context}) => {
  await page.goto('http://127.0.0.1:4175/');
  await expect(page.locator('#offline-status')).toHaveAttribute('data-ready','true');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.locator('[data-action="continue"]').click();
  await enterWord(page,'KALA');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.hero-copy h1')).toContainText('Iga sõnaga');
  await page.locator('[data-action="continue"]').click();
  await expect(page.locator('.answer-list .discovered')).toContainText('KALA');
  const imagesLoaded=await page.evaluate(async()=>{
    const styles=getComputedStyle(document.documentElement);
    return Promise.all(['coast','bog','town'].map(async name=>{
      const url=styles.getPropertyValue(`--${name}-image`).match(/url\("?([^"\)]+)"?\)/)?.[1];
      const image=new Image(); image.src=url; await image.decode(); return image.naturalWidth>1000;
    }));
  });
  expect(imagesLoaded).toEqual([true,true,true]);
  await page.locator('.wallet').click();
  await page.locator('[data-pack="pocket"]').click();
  await page.locator('[data-action="confirm-purchase"]').click();
  await expect(balance(page)).toHaveText('420');
  await context.setOffline(false);
});

test('chapter completion unlocks the bog scene and preserves the first chapter', async ({page},info) => {
  let state=normalizeState(null);
  for(let i=0;i<11;i++) for(const word of LEVELS.et[i].words) state=submitWord(state,`et:level:${i}`,word).state;
  state.current.et=11;
  await seed(page,state); await page.goto('./'); await page.locator('[data-action="continue"]').click();
  await complete(page,LEVELS.et[11].words);
  await expect(page.getByRole('dialog')).toContainText('Saaremaa on avastatud');
  await expect(page.locator('[data-action="next"]')).toHaveText('Järgmine peatükk');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-chapter','bog');
  await expect(page.locator('.play-card h2')).toHaveText('Tase 13');
  await expect(page.locator('#word-toast')).not.toHaveClass(/visible/);
  await page.screenshot({path:`artifacts/sonarannak-bog-${info.project.name}.png`,fullPage:true});
  await page.locator('.play-heading [data-action="back"]').click();
  await page.locator('.bottom-nav [data-action="map"]').click();
  await expect(page.locator('.map-card')).toHaveCount(6);
  await expect(page.locator('#chapter-bog .level-stop').first()).toBeEnabled();
  await expect(page.locator('#chapter-bog .level-stop').nth(1)).toBeDisabled();
  await expect(page.locator('#chapter-coast .level-stop.done')).toHaveCount(12);
});

test('offline installation also works within the Wordjourney Pages scope', async ({page,context}) => {
  await page.goto('http://127.0.0.1:4275/wordjourney/');
  await expect(page.locator('#offline-status')).toHaveAttribute('data-ready','true');
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const details=await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.ready;
    const manifest=await (await fetch(new URL('manifest.webmanifest',registration.scope))).json();
    return {scope:new URL(registration.scope).pathname,start:new URL(manifest.start_url,registration.scope).pathname};
  });
  expect(details).toEqual({scope:'/wordjourney/',start:'/wordjourney/'});
  await page.locator('[data-action="continue"]').click();
  await page.locator('[data-action="hint"]').click();
  await expect(balance(page)).toHaveText('95');
  await context.setOffline(true); await page.reload();
  await page.locator('[data-action="continue"]').click();
  await expect(balance(page)).toHaveText('95');
  await expect(page.locator('.crossword-tile.hinted')).toHaveCount(1);
  await enterWord(page,'KALA');
  await expect(page.locator('.answer-list .discovered')).toContainText('KALA');
  await context.setOffline(false);
});

test('unavailable browser storage shows a warning and still allows playing', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window,'localStorage',{get() { throw new DOMException('Unavailable','SecurityError'); }});
  });
  await start(page);
  await expect(page.locator('#word-toast')).toContainText('Brauser ei luba salvestada');
  await enterWord(page,'KALA');
  await expect(page.locator('.answer-list .discovered')).toContainText('KALA');
});

test('standalone artifact plays without any external resources and shows the demo shop', async ({page}) => {
  const html = await readFile('artifacts/Sonarannak.html','utf8');
  let requests = 0;
  await page.route('**/*', async route => {
    if (route.request().isNavigationRequest() && route.request().url() === 'http://standalone.test/') {
      await route.fulfill({contentType:'text/html',body:html});
    } else { requests++; await route.abort(); }
  });
  await page.goto('http://standalone.test/');
  await page.locator('[data-action="continue"]').click();
  await complete(page,LEVELS.et[0].words);
  await expect(balance(page)).toHaveText('140');
  await page.locator('.dialog-heading [data-action="close"]').click();
  await page.locator('.wallet').click();
  await expect(page.locator('.demo-notice')).toContainText('Proovipood');
  expect(requests).toBe(0);
});
