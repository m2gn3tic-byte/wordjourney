import {test,expect} from '@playwright/test';
import {LEVELS} from '../src/wordgame/levels.js';
import {normalizeState,submitWord,STORAGE_KEY} from '../src/wordgame/engine.js';

async function fits(page){
  const geometry=await page.evaluate(()=>({
    width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
    tools:document.querySelector('.play-tools')?.getBoundingClientRect().bottom,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.height+1);
  expect(geometry.tools).toBeLessThanOrEqual(geometry.height);
}
async function spell(page,word){
  const used=new Set();
  for(const letter of word){
    const buttons=page.locator('[data-letter]');
    for(let i=0;i<await buttons.count();i++){
      const button=buttons.nth(i),id=await button.getAttribute('data-letter');
      if(!used.has(id)&&await button.textContent()===letter){used.add(id);await button.click();break;}
    }
  }
  await page.locator('[data-action="submit"]').click();
}
async function dragSearch(page,context,keys){
  const cdp=await context.newCDPSession(page);
  for(const [i,key]of keys.entries()){
    const box=await page.locator(`[data-search-cell="${key}"]`).boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:i?'touchMove':'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await cdp.detach();
}
test('1080 by 1920 screenshot contains the complete playable classic layout',async({page})=>{
  await page.goto('/');await page.locator('[data-action="continue"]').click();await fits(page);
  for(const button of await page.locator('[data-letter]').all()){
    const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const png=await page.screenshot({path:'artifacts/sonarannak-1080x1920.png'});
  expect(png.readUInt32BE(16)).toBe(1080);expect(png.readUInt32BE(20)).toBe(1920);
  await spell(page,'KALA');await expect(page.locator('.word-progress')).toContainText('1 / 3');
});
test('both letter-wheel practice variants are free and fit the portrait reference',async({page})=>{
  for(const mode of ['crossword','rows']){
    await page.goto('/');await page.locator(`[data-mode-start="${mode}"]`).click();await fits(page);
    const level=LEVELS.et.find(l=>l.mode===mode);
    await page.locator('[data-action="hint"]').click();
    for(const word of level.words){if(await page.locator('dialog[open]').count())break;await spell(page,word);}
    await expect(page.getByRole('dialog')).toContainText('Hea harjutus');
    await expect(page.locator('[data-wallet]')).toHaveText('120');
    await page.locator('.dialog-heading [data-action="close"]').click();
    await page.locator('.play-heading [data-action="back"]').click();
    await page.locator('.bottom-nav [data-action="map"]').click();
    await expect(page.locator('.level-stop').nth(1)).toBeDisabled();
  }
});
test('word search supports real touch, reverse words and recovery from a bent selection',async({page,context})=>{
  await page.goto('/');await page.locator('[data-mode-start="wordsearch"]').click();await fits(page);
  await page.locator('[data-search-cell="0,0"]').click();await page.locator('[data-search-cell="2,1"]').click();
  await expect(page.locator('[data-action="clear"]')).toBeDisabled();
  const level=LEVELS.et.find(l=>l.mode==='wordsearch');
  await dragSearch(page,context,[...level.board.words[0].cells].reverse());
  await expect(page.locator('.search-targets .discovered')).toHaveCount(1);
  await page.locator('[data-action="hint"]').click();await expect(page.locator('[data-wallet]')).toHaveText('120');
  await page.screenshot({path:'artifacts/sonarannak-wordsearch-1080x1920.png'});
  for(const answer of level.board.words.slice(1)){
    await page.locator(`[data-search-cell="${answer.cells[0]}"]`).click();await page.locator(`[data-search-cell="${answer.cells.at(-1)}"]`).click();
  }
  await expect(page.getByRole('dialog')).toContainText('Hea harjutus');await expect(page.locator('[data-wallet]')).toHaveText('120');
});
test('a new campaign word-search level rewards once and continues to the next level',async({page,context})=>{
  let state=normalizeState(null);
  for(let i=0;i<24;i++)for(const word of LEVELS.et[i].words)state=submitWord(state,`et:level:${i}`,word).state;
  state.current.et=24;
  await page.addInitScript(({key,state})=>{if(!sessionStorage.getItem('seed')){localStorage.setItem(key,JSON.stringify(state));sessionStorage.setItem('seed','1');}},{key:STORAGE_KEY,state});
  await page.goto('/');await page.locator('[data-action="continue"]').click();await fits(page);
  await expect(page.locator('.play-card')).toHaveAttribute('data-mode','wordsearch');
  for(const answer of LEVELS.et[24].board.words)await dragSearch(page,context,answer.cells);
  await expect(page.locator('[data-wallet]')).toHaveText('620');
  await page.locator('[data-action="next"]').click();await expect(page.locator('.play-card h2')).toHaveText('Tase 26');
  await page.reload();await page.locator('[data-action="continue"]').click();await expect(page.locator('[data-wallet]')).toHaveText('620');
});
