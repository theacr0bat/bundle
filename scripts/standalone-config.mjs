import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function makeConfig(s){
 const fail=m=>{throw new Error(m);};
 if(!/^[a-f0-9]{32}$/.test(s.accountId||''))fail('Cloudflare hesap kimliği geçersiz.');
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s.databaseId||'')||s.databaseId==='00000000-0000-4000-8000-000000000000')fail('Gerçek D1 veritabanı kimliği gerekli.');
 if(typeof s.hostname!=='string'||s.hostname.length>253||!s.hostname.includes('.')||!s.hostname.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))||/\.(?:example|test|invalid|localhost|workers\.dev|chatgpt\.site)$/.test(s.hostname)||s.hostname.includes('senin-alan-adin'))fail('Sana ait gerçek alan adı gerekli.');
 if(!/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(s.teamDomain||''))fail('Cloudflare Access ekip adresi geçersiz.');
 if(!/^[a-f0-9]{64}$/.test(s.accessAudience||''))fail('Access uygulamasının gerçek AUD değeri gerekli.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.ownerEmail||'')||/@example\.(com|org|net)$/.test(s.ownerEmail))fail('Yönetici e-posta adresi gerekli.');
 return {name:'aralik',account_id:s.accountId,main:'./worker/standalone.ts',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],workers_dev:false,preview_urls:false,routes:[{pattern:s.hostname,custom_domain:true}],vars:{AUTH_MODE:'cloudflare-access',ACCESS_TEAM_DOMAIN:s.teamDomain,ACCESS_AUD:s.accessAudience,ADMIN_OWNER_EMAIL:s.ownerEmail.trim().toLowerCase()},d1_databases:[{binding:'DB',database_name:'aralik-db',database_id:s.databaseId,migrations_dir:'./drizzle'}]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const config=makeConfig(JSON.parse(readFileSync(new URL('../deployment/settings.json',import.meta.url),'utf8')));
 writeFileSync(new URL('../wrangler.standalone.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
 console.log('Bağımsız yayın yapılandırması hazır. Henüz yayın yapılmadı.');
}
