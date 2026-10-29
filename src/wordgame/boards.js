const cellKey = (x,y) => `${x},${y}`;
export function makeWordRows(words) {
  const ordered=[...words].sort((a,b)=>a.length-b.length), cols=Math.max(...words.map(w=>w.length));
  const cells=[], answers=[];
  ordered.forEach((word,y)=>{
    const start=Math.floor((cols-word.length)/2), keys=[];
    [...word].forEach((letter,i)=>{const x=start+i,key=cellKey(x,y);cells.push({x,y,letter,key});keys.push(key);});
    answers.push({word,cells:keys});
  });
  return {cols,rows:ordered.length,cells,words:answers};
}
export function makeWordSearch(words, language, seedText) {
  let seed=[...seedText].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,12345);
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const size=Math.max(6,...words.map(w=>w.length));
  const grid=Array(size*size).fill(null), answers=[];
  const directions=[[1,0],[0,1],[1,1],[-1,1],[-1,0],[0,-1],[-1,-1],[1,-1]];
  for(const word of [...words].sort((a,b)=>b.length-a.length)) {
    const candidates=[];
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) for(const [dx,dy] of directions){
      const endX=x+(word.length-1)*dx,endY=y+(word.length-1)*dy;
      if(endX<0||endX>=size||endY<0||endY>=size)continue;
      const positions=[...word].map((_,i)=>({x:x+i*dx,y:y+i*dy}));
      if(positions.every((p,i)=>!grid[p.y*size+p.x]||grid[p.y*size+p.x]===word[i])) candidates.push({positions,sort:random()});
    }
    candidates.sort((a,b)=>a.sort-b.sort);
    if(!candidates.length) throw new Error(`Cannot place word-search answer ${word}`);
    const positions=candidates[0].positions;
    positions.forEach((p,i)=>grid[p.y*size+p.x]=word[i]);
    answers.push({word,cells:positions.map(p=>cellKey(p.x,p.y))});
  }
  const alphabet={et:'AEGIKLMNOPRSTUVÕÄÖÜ',ru:'АБВГДЕЁЖЗИКЛМНОПРСТУФХЦЧШЫЭЮЯ',en:'ABCDEFGHIJKLMNOPQRSTUVWXYZ'}[language];
  const cells=grid.map((letter,i)=>({x:i%size,y:Math.floor(i/size),key:cellKey(i%size,Math.floor(i/size)),letter:letter||alphabet[Math.floor(random()*alphabet.length)]}));
  return {cols:size,rows:size,cells,words:answers};
}
export function straightPath(board,start,end) {
  const available=new Set(board.cells.map(c=>c.key));
  if(!available.has(start)||!available.has(end)) return [];
  const parse=key=>key.split(',').map(Number);
  const [x,y]=parse(start),[ex,ey]=parse(end),dx=ex-x,dy=ey-y;
  if(dx!==0&&dy!==0&&Math.abs(dx)!==Math.abs(dy))return [];
  const count=Math.max(Math.abs(dx),Math.abs(dy));
  const keys=Array.from({length:count+1},(_,i)=>cellKey(x+i*Math.sign(dx),y+i*Math.sign(dy)));
  return keys.every(k=>available.has(k))?keys:[];
}
export function wordForPath(board,keys) {
  if(!Array.isArray(keys)||keys.length<2||keys.length>board.cells.length||keys.some(k=>typeof k!=='string')) return '';
  const path=straightPath(board,keys[0],keys.at(-1));
  if(path.length!==keys.length||path.some((k,i)=>k!==keys[i])) return '';
  const cells=new Map(board.cells.map(c=>[c.key,c.letter]));
  return keys.map(k=>cells.get(k)).join('');
}
