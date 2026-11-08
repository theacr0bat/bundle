import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT,createLocalJWKSet} from 'jose';
import {accessIdentity,accessConfig} from '../lib/access-auth.ts';
import {makeConfig} from '../scripts/standalone-config.mjs';
import {env} from './mock-workers.mjs';
import {identity} from '../lib/server.ts';
import {GET,POST} from '../app/api/admin/route.ts';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

const settings={AUTH_MODE:'cloudflare-access',ACCESS_TEAM_DOMAIN:'https://aralik-test.cloudflareaccess.com',ACCESS_AUD:'a'.repeat(64),ADMIN_OWNER_EMAIL:'owner@aralik.test'};
const {privateKey,publicKey}=await generateKeyPair('RS256');
const jwk={...await exportJWK(publicKey),kid:'test-key',alg:'RS256',use:'sig'};
const keys=createLocalJWKSet({keys:[jwk]});
async function token(change={},key=privateKey){return new SignJWT({type:'app',email:'owner@aralik.test',...change}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject(change.sub??'independent-owner').setIssuer(change.iss??settings.ACCESS_TEAM_DOMAIN).setAudience(change.aud??settings.ACCESS_AUD).setIssuedAt().setExpirationTime(change.exp??'1h').sign(key);}
const request=jwt=>new Request('https://aralik.test/api/admin',{headers:jwt?{'cf-access-jwt-assertion':jwt}:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':settings.ADMIN_OWNER_EMAIL,'cf-access-authenticated-user-email':settings.ADMIN_OWNER_EMAIL}});
test('bağımsız giriş: imzalı uygulama oturumu doğrulanır; e-posta başlığı yetki vermez',async()=>{
 assert.deepEqual(await accessIdentity(request(await token()),settings,keys),{id:'independent-owner',email:settings.ADMIN_OWNER_EMAIL});
 await assert.rejects(accessIdentity(request(),settings,keys),e=>e.status===401);
 for(const change of [{iss:'https://attacker.cloudflareaccess.com'},{aud:'other-app'},{exp:1},{type:'org'},{email:null},{sub:''}])await assert.rejects(accessIdentity(request(await token(change)),settings,keys),e=>e.status===401);
 const other=await generateKeyPair('RS256');await assert.rejects(accessIdentity(request(await token({},other.privateKey)),settings,keys),e=>e.status===401);
 await assert.rejects(accessIdentity(request('eyJhbGciOiJub25lIn0.e30.'),settings,keys),e=>e.status===401);
});
test('eksik giriş yapılandırması ve dışarıdan anahtar sunucusu reddedilir',()=>{
 for(const changed of [{ACCESS_AUD:''},{ACCESS_TEAM_DOMAIN:'https://attacker.test'},{ACCESS_TEAM_DOMAIN:settings.ACCESS_TEAM_DOMAIN+'/path'},{ADMIN_OWNER_EMAIL:''}])assert.throws(()=>accessConfig({...settings,...changed}),e=>e.status===503);
});
test('bağımsız oyuncu kimliği sahte Sites başlıklarından etkilenmez',async()=>{
 env.AUTH_MODE='cloudflare-access';
 try{const headers={cookie:'aralik_player=12345678-1234-4234-8234-123456789abc'};const a=await identity(new Request('https://aralik.test',{headers}));const b=await identity(new Request('https://aralik.test',{headers:{...headers,'oai-authenticated-user-id':'forged'}}));assert.equal(a.player,b.player);assert.equal(a.cookie,null);}finally{delete env.AUTH_MODE;}
});
test('bağımsız yönetim API: imza + sahip bağlama + kaynak kontrolü gerçek SQLite üzerinde',async()=>{
 const sql=new DatabaseSync(':memory:');for(const file of ['0000_common_sinister_six.sql','0001_cynical_toro.sql'])sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const adapter={prepare(query){let args=[];return {bind(...v){args=v;return this;},async first(){return sql.prepare(query).get(...args)||null;},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};}};
 Object.assign(env,settings,{DB:adapter});const originalFetch=globalThis.fetch;
 globalThis.fetch=async url=>{assert.equal(String(url),settings.ACCESS_TEAM_DOMAIN+'/cdn-cgi/access/certs');return new Response(JSON.stringify({keys:[jwk]}),{headers:{'Content-Type':'application/json'}});};
 try{
  assert.equal((await GET(request())).status,401);
  const jwt=await token(),headers={'cf-access-jwt-assertion':jwt,origin:'https://aralik.test'};
  const post=origin=>POST(new Request('https://aralik.test/api/admin',{method:'POST',headers:{...headers,origin},body:JSON.stringify({action:'unknown'})}));
  assert.equal((await post('http://aralik.test')).status,403);
  assert.equal((await post('https://aralik.test')).status,400); // guard binds owner, unknown action makes no content change
  assert.equal(sql.prepare("SELECT value FROM admin_settings WHERE key='owner_id:cloudflare-access'").get().value,'independent-owner');
  const access=await GET(new Request('https://aralik.test/api/admin?view=access',{headers}));assert.equal(access.status,200);
  assert.equal((await GET(request(await token({sub:'other-account'})))).status,403);
  delete env.ACCESS_AUD;assert.equal((await GET(request(jwt))).status,503);
 }finally{globalThis.fetch=originalFetch;for(const k of [...Object.keys(settings),'DB'])delete env[k];sql.close();}
});
test('yayın ayarı gerçek hesap/veritabanı/alan adı ister; alternatif açık adresleri kapatır',()=>{
 const s={accountId:'b'.repeat(32),databaseId:'12345678-1234-4234-8234-123456789abc',hostname:'play.aralikgame.com',teamDomain:settings.ACCESS_TEAM_DOMAIN,accessAudience:settings.ACCESS_AUD,ownerEmail:settings.ADMIN_OWNER_EMAIL};
 const c=makeConfig(s);assert.equal(c.workers_dev,false);assert.equal(c.preview_urls,false);assert.equal(c.vars.AUTH_MODE,'cloudflare-access');assert.equal(c.routes[0].custom_domain,true);
 for(const changed of [{accountId:''},{databaseId:'00000000-0000-4000-8000-000000000000'},{hostname:'test.workers.dev'},{hostname:'-bad.com'},{accessAudience:'placeholder'},{ownerEmail:'owner@example.com'}])assert.throws(()=>makeConfig({...s,...changed}));
});
