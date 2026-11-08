// Review-package convenience helper. Local D1 only; never uses --remote.
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
if(process.argv.slice(2).some(a=>a!=='--admin'))throw new Error('Only --admin is supported.');
if(!existsSync('node_modules/wrangler/bin/wrangler.js'))throw new Error('First run pnpm install --frozen-lockfile.');
mkdirSync('.sites-runtime',{recursive:true});
const config=path.join(root,'.sites-runtime/review-local-db.json');
writeFileSync(config,JSON.stringify({name:'boundle-local-review',compatibility_date:'2026-05-15',d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000',migrations_dir:path.join(root,'drizzle')}]},null,2));
const r=spawnSync(process.execPath,['--import',path.join(root,'scripts/sites-env.mjs'),path.join(root,'node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','DB','--local','--persist-to',path.join(root,'.wrangler/state'),'--config',config],{stdio:'inherit'});
if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);
if(process.argv.includes('--admin')){
 // Never overwrite a developer's existing authentication files.
 if(existsSync('.dev.vars')||existsSync('.sites-runtime/admin-preview.json'))throw new Error('Local DB is ready. Existing auth fixture/settings were left untouched; configure local preview manually.');
 writeFileSync('.dev.vars','ADMIN_OWNER_EMAIL="preview-owner@sites.test"\n',{mode:0o600});
 writeFileSync('.sites-runtime/admin-preview.json',JSON.stringify({id:'preview-boundle-review',email:'preview-owner@sites.test'}),{mode:0o600});
 console.log('Optional fictional admin identity enabled for local Vite preview only.');
}
console.log('Local DB is ready. Start Vite on 127.0.0.1:5173 using the command in REVIEW_START_HERE.md.');
