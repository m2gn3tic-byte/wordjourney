#!/usr/bin/env node
/** Publish user-requested game builds without changing the working checkout. */
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,copyFile,writeFile,readFile,readdir,lstat,rm} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const git=(args,options={})=>(execFileSync('git',args,{cwd:root,encoding:'utf8',...options})||'').trim();
const artifacts=join(root,'artifacts'),web=join(root,'dist-pages'),download=join(artifacts,'playtest');
const packages=['Sonarannak.html','sonarannak-debug.apk','sonarannak-unsigned.aab'];
for(const name of packages) if(!(await lstat(join(artifacts,name))).isFile())throw Error(`Missing build: ${name}`);
const entry=await readFile(join(web,'index.html'),'utf8');
if(!entry.includes('/wordjourney/assets/')||!entry.includes('Sõnarännak')) throw Error('Build the Wordjourney Pages path first.');
await mkdir(download,{recursive:true});
const hashes={};
for(const name of packages){
  await copyFile(join(artifacts,name),join(download,name));
  hashes[name]=createHash('sha256').update(await readFile(join(download,name))).digest('hex');
}
await writeFile(join(download,'SHA256.json'),JSON.stringify(hashes,null,2)+'\n');
await writeFile(join(download,'ALUSTA-SIIT.txt'),`Sõnarännak 0.3.0 — 148 taset, kolm mänguviisi\n\nANDROIDIS PROOVIMINE\n1. Laadi sonarannak-debug.apk telefoni.\n2. Ava APK ja luba vajaduse korral selle allika rakenduste paigaldamine.\n3. Ava Sõnarännak. Mäng on APK sees ja töötab võrguühenduseta.\nAndroid 7.0 või uuem. See on prooviallkirjaga arendusehitus, mitte Play poest paigaldatud väljalase.\n\nBRAUSERIS PROOVIMINE\nPaki ZIP lahti ja ava Sonarannak.html oma arvuti brauseris.\nVeebilehe aadress pärast GitHub Pagesi aktiveerimist:\nhttps://m2gn3tic-byte.github.io/wordjourney/\nPagesi allikaks vali wordjourney hoidla seadetes gh-pages ja /(root).\n\nGOOGLE PLAY\nsonarannak-unsigned.aab vajab enne üleslaadimist omaniku väljalaske allkirja.\nSee ei ole telefonis otse paigaldatav APK. Ära kasuta debug-võtit Play väljalaskeks.\n\nMündipoes on ainult tasuta näidisostud. Pärisraha makseid pole ühendatud.\nEdenemine säilib seadme või brauseri kohalikus salvestuses; veeb ja APK ei sünkrooni omavahel.\n`);
await writeFile(join(web,'.nojekyll'),'');
async function inspect(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw Error('Publication must not include symlinks');
    if(/(?:\.keystore$|\.jks$|^\.env(?:\.|$))/i.test(entry.name))throw Error('Signing keys and environment files must never be published');
    if(entry.isDirectory())await inspect(join(directory,entry.name));
  }
}
await inspect(web);await inspect(download);
if(!process.argv.includes('--publish')){console.log('Builds prepared and inspected. Pass --publish to push the test branches.');process.exit(0);}
const gitDir=git(['rev-parse','--absolute-git-dir']);
async function snapshot(branch,directory,{source=false}={}){
  const ref=`refs/heads/${branch}`,remote=git(['ls-remote','--heads','origin',ref]).split(/\s+/)[0]||null;
  let parent=remote;
  if(remote)git(['fetch','--no-tags','origin',ref]);
  else if(source)parent=git(['rev-parse','HEAD']);
  const temp=await mkdtemp(join(tmpdir(),'wordjourney-publish-'));
  const env={...process.env,GIT_INDEX_FILE:join(temp,'index')};
  try{
    git(['read-tree','--empty'],{env});
    git([`--git-dir=${gitDir}`,`--work-tree=${directory}`,'add','--all',...(source?[]:['--force'])],{env,cwd:directory});
    const files=git(['ls-files'],{env}).split('\n');
    if(files.some(p=>/(?:\.keystore$|\.jks$|(?:^|\/)\.env(?:$|\.))/i.test(p)&&!p.endsWith('.env.example')))throw Error('Unsafe source file selected');
    const tree=git(['write-tree'],{env});
    let commit;
    if(parent&&git(['rev-parse',`${parent}^{tree}`])===tree)commit=parent;
    else commit=git(['commit-tree',tree,...(parent?['-p',parent]:[])],{input:`Sõnarännak 0.3.0: ${branch}\n`});
    let old='0000000000000000000000000000000000000000';
    try{old=git(['rev-parse','--verify',ref]);}catch{}
    git(['update-ref',ref,commit,old]);
    console.log(`${branch}: ${commit}`);return ref;
  }finally{await rm(temp,{recursive:true,force:true});}
}
const refs=[];
refs.push(await snapshot('gh-pages',web));
refs.push(await snapshot('playtest',download));
refs.push(await snapshot('sonarannak-v0.3',root,{source:true}));
git(['push','--dry-run','--atomic','origin',...refs],{stdio:'inherit'});
git(['push','--atomic','origin',...refs],{stdio:'inherit'});
console.log('Test artifacts, website files and source snapshot pushed; the working branch and main were not changed.');
