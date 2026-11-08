import {spawnSync} from 'node:child_process';
import {readFileSync,existsSync,renameSync,rmSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {makeConfig} from './standalone-config.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
process.chdir(root);
const action=process.argv[2];
function run(args,extra={}){const r=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,...extra}});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);}
const wrangler=['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js'];
function configured(){
 const expected=makeConfig(JSON.parse(readFileSync('deployment/settings.json','utf8')));
 if(!existsSync('wrangler.standalone.json')||JSON.stringify(JSON.parse(readFileSync('wrangler.standalone.json','utf8')))!==JSON.stringify(expected))throw new Error('Önce npm run standalone:configure çalıştır.');
}
function build(){
 // Vinext's build uses dist/. Save a previously built Sites output separately.
 const saved='.sites-runtime/sites-build-before-standalone';mkdirSync('.sites-runtime',{recursive:true});
 if(existsSync(saved))throw new Error('Önceki kesilmiş derleme çıktısı var; .sites-runtime/sites-build-before-standalone içeriğini kontrol et.');
 const hadBuild=existsSync('dist');if(hadBuild)renameSync('dist',saved);
 try{
  const r=spawnSync(process.execPath,['scripts/run-framework.mjs','build'],{stdio:'inherit',env:{...process.env,ARALIK_BUILD_TARGET:'standalone'}});
  if(r.error)throw r.error;if(r.status!==0)throw new Error('Bağımsız derleme başarısız.');
  rmSync('dist-standalone',{recursive:true,force:true});renameSync('dist','dist-standalone');
 }finally{if(hadBuild){rmSync('dist',{recursive:true,force:true});renameSync(saved,'dist');}}
}
if(action==='build')build();
else if(action==='migrate'){configured();run([...wrangler,'d1','migrations','apply','aralik-db','--remote','--config','wrangler.standalone.json']);}
else if(action==='backup'){
 configured();mkdirSync('backups',{recursive:true});
 const file='backups/aralik-'+new Date().toISOString().replaceAll(':','-')+'.sql';
 run([...wrangler,'d1','export','aralik-db','--remote','--config','wrangler.standalone.json','--output',file]);console.log('Yedek: '+file);
}else if(action==='deploy'){
 configured();build();run([...wrangler,'deploy','--config','dist-standalone/server/wrangler.json']);
}else throw new Error('Beklenen işlem: build, migrate, backup veya deploy.');
