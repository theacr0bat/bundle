import {env} from 'cloudflare:workers';
import {contentDb,initializeBank,MANAGED_START,suggestedQuestions,getDayRound} from './content';
import {canManage,validateQuestion,validateRound,fingerprint,validDay,makeCsv,csvFields} from './admin-model';
import {today,dailyQuestions} from './game';
import {scoringVersion} from './scoring';
import type {Question} from './game';
import {accessIdentity,AccessError,type AccessSettings} from './access-auth';
export class AdminError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export async function requireOwner(req:Request,write=false){
 const settings=env as unknown as AccessSettings;
 const independent=settings.AUTH_MODE==='cloudflare-access';
 if(settings.AUTH_MODE&&settings.AUTH_MODE!=='sites'&&!independent)throw new AdminError('Yönetici giriş yapılandırması geçersiz.',503);
 let identity:{id:string|null;email:string|null};
 if(independent){try{identity=await accessIdentity(req,settings);}catch(e){if(e instanceof AccessError)throw new AdminError(e.message,e.status);throw e;}}
 else identity={id:req.headers.get('oai-authenticated-user-id'),email:req.headers.get('oai-authenticated-user-email')};
 const {id,email}=identity;
 if(!id||!email)throw new AdminError('Yönetim için hesabınla giriş yapmalısın.',401);
 const ownerKey=independent?'owner_id:cloudflare-access':'owner_id';
 const db=contentDb();const row=await db.prepare('SELECT value FROM admin_settings WHERE key=?').bind(ownerKey).first<{value:string}>();
 const ownerEmail=String((env as unknown as Record<string,unknown>).ADMIN_OWNER_EMAIL||'');
 if(!canManage({id,email},row?.value||null,ownerEmail))throw new AdminError('Bu panel yalnızca site sahibine açık.',403);
 if(write){const origin=req.headers.get('origin');let allowed=false;try{allowed=!!origin&&new URL(origin).origin===new URL(req.url).origin;}catch{}
  if(!allowed)throw new AdminError('Geçersiz istek kaynağı.',403);
  await db.prepare('INSERT OR IGNORE INTO admin_settings (key,value) VALUES (?,?)').bind(ownerKey,id).run();
  const owner=await db.prepare('SELECT value FROM admin_settings WHERE key=?').bind(ownerKey).first<{value:string}>();if(owner?.value!==id)throw new AdminError('Bu panel yalnızca site sahibine açık.',403);
 }
 return id;
}
export function audit(actor:string,action:string,target:string){return contentDb().prepare('INSERT INTO admin_audit (id,actor,action,target,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor,action,target,new Date().toISOString());}
export async function questionRows(){const {results}=await contentDb().prepare('SELECT * FROM questions ORDER BY updated_at DESC,id LIMIT 5000').all<{id:string;payload:string;status:string;revision:number;updated_at:string}>();return results.map(r=>({question:JSON.parse(r.payload) as Question,status:r.status,revision:r.revision,updatedAt:r.updated_at}));}
export function dateWindow(url:URL){const end=url.searchParams.get('to')||today();if(!validDay(end))throw new AdminError('Bitiş tarihi geçersiz.');const start=url.searchParams.get('from')||new Date(Date.parse(end+'T00:00:00Z')-29*86400000).toISOString().slice(0,10);if(!validDay(start)||!validDay(end)||start>end||end>today()||(Date.parse(end)-Date.parse(start))/86400000>89)throw new AdminError('Geçmişten bugüne en fazla 90 günlük geçerli bir tarih aralığı seç.');return {start,end};}
export async function overview(url:URL){const {start,end}=dateWindow(url),db=contentDb();
 const [summary,daily,analysis,audits]=await Promise.all([
  db.prepare('SELECT COUNT(*) started,COUNT(DISTINCT player) players,SUM(completed) completed,AVG(CASE WHEN completed=1 THEN score END) average FROM runs WHERE day BETWEEN ? AND ?').bind(start,end).first(),
  db.prepare('SELECT day,COUNT(*) started,SUM(completed) completed,AVG(CASE WHEN completed=1 THEN score END) average FROM runs WHERE day BETWEEN ? AND ? GROUP BY day ORDER BY day DESC').bind(start,end).all(),
  db.prepare("SELECT json_extract(j.value,'$.id') id,MIN(r.day) firstDay,MIN(CAST(json_extract(j.value,'$.index') AS INTEGER)) idx,COUNT(*) attempts,AVG(CAST(json_extract(j.value,'$.score') AS REAL)) average,AVG(CAST(json_extract(j.value,'$.high') AS REAL)-CAST(json_extract(j.value,'$.low') AS REAL)) width,SUM(CASE WHEN CAST(json_extract(j.value,'$.low') AS REAL)<=CAST(json_extract(j.value,'$.answer') AS REAL) AND CAST(json_extract(j.value,'$.high') AS REAL)>=CAST(json_extract(j.value,'$.answer') AS REAL) THEN 1 ELSE 0 END) hits FROM runs r,json_each(r.answers) j WHERE r.day BETWEEN ? AND ? GROUP BY json_extract(j.value,'$.id') ORDER BY attempts DESC LIMIT 500").bind(start,end).all<{id:string;firstDay:string;idx:number;attempts:number;average:number;width:number;hits:number}>(),
  db.prepare('SELECT action,target,created_at FROM admin_audit ORDER BY created_at DESC LIMIT 15').all(),
 ]);
 const known=new Map((await questionRows()).map(q=>[q.question.id,q.question]));
 const {results:snapshots}=await db.prepare('SELECT day,questions FROM day_rounds WHERE day BETWEEN ? AND ?').bind(start,end).all<{day:string;questions:string}>();
 for(const r of snapshots)for(const q of JSON.parse(r.questions) as Question[])known.set(q.id,q);
 const items=analysis.results.map(row=>{const q=known.get(row.id)||dailyQuestions(row.firstDay).find(q=>q.id===row.id);return {...row,tr:q?.tr||row.id,unit:q?.unitTr||'',difficulty:q?.difficulty||null,hitRate:Math.round(100*row.hits/row.attempts)};});
 return {start,end,summary,daily:daily.results,analysis:items,audits:audits.results};
}
export async function rangeSamples(url:URL){const {start,end}=dateWindow(url),id=url.searchParams.get('id');if(!id||id.length>80)throw new AdminError('Soru kimliği eksik.');
 const {results}=await contentDb().prepare("SELECT r.day,CAST(json_extract(j.value,'$.low') AS REAL) low,CAST(json_extract(j.value,'$.high') AS REAL) high,CAST(json_extract(j.value,'$.answer') AS REAL) answer,CAST(json_extract(j.value,'$.score') AS INTEGER) score FROM runs r,json_each(r.answers) j WHERE r.day BETWEEN ? AND ? AND json_extract(j.value,'$.id')=? ORDER BY r.created_at DESC LIMIT 100").bind(start,end,id).all();return {samples:results};}
export async function calendar(day:string){if(!validDay(day))throw new AdminError('Tarih geçersiz.');if(day<=today())await getDayRound(day);const row=await contentDb().prepare('SELECT * FROM day_rounds WHERE day=?').bind(day).first<{questions:string;origin:string;updated_at:string}>();const qs=row?JSON.parse(row.questions):await suggestedQuestions(day);return {day,questions:qs,origin:row?.origin||'automatic',updatedAt:row?.updated_at||null,locked:day<=today(),managedStart:MANAGED_START};}
export async function mutate(body:Record<string,unknown>,actor:string){const db=contentDb(),now=new Date().toISOString();
 if(body.action==='initialize'){await initializeBank();return {ok:true};}
 if(body.action==='saveQuestion'){
  const q=validateQuestion(body.question);const status=String(body.status);if(!['draft','ready','archived'].includes(status))throw new AdminError('Soru durumu geçersiz.');
  const revision=Number(body.revision);if(!Number.isInteger(revision)||revision<0)throw new AdminError('Sürüm bilgisi geçersiz.');
  const count=await db.prepare('SELECT COUNT(*) n FROM questions').first<{n:number}>();if(revision===0&&(count?.n||0)>=2000)throw new AdminError('Havuz en fazla 2.000 soru içerebilir.');
  if(revision>0){const previous=await db.prepare('SELECT payload,status FROM questions WHERE id=?').bind(q.id).first<{payload:string;status:string}>();if(previous?.status==='ready'){const old=JSON.parse(previous.payload) as Question;if(status!=='ready'||old.category!==q.category||old.difficulty!==q.difficulty){const remaining=await db.prepare("SELECT COUNT(*) n FROM questions WHERE id!=? AND status='ready' AND json_extract(payload,'$.category')=? AND json_extract(payload,'$.difficulty')=?").bind(q.id,old.category,old.difficulty).first<{n:number}>();if(!remaining?.n)throw new AdminError('Bu kategori ve zorluktaki son hazır soru. Önce aynı gruba başka bir hazır soru ekle.');}}}
  const statement=revision===0?db.prepare('INSERT INTO questions (id,payload,status,fingerprint,revision,created_at,updated_at) VALUES (?,?,?,?,1,?,?)').bind(q.id,JSON.stringify(q),status,fingerprint(q.tr),now,now):db.prepare("UPDATE questions AS current SET payload=?,status=?,fingerprint=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND (current.status!='ready' OR (?='ready' AND json_extract(current.payload,'$.category')=? AND json_extract(current.payload,'$.difficulty')=?) OR EXISTS (SELECT 1 FROM questions other WHERE other.id!=current.id AND other.status='ready' AND json_extract(other.payload,'$.category')=json_extract(current.payload,'$.category') AND json_extract(other.payload,'$.difficulty')=json_extract(current.payload,'$.difficulty')))").bind(JSON.stringify(q),status,fingerprint(q.tr),now,q.id,revision,status,q.category,q.difficulty);
  const result=await statement.run();
  if(!result.meta.changes)throw new AdminError('Soru başka bir sekmede değişmiş veya grubundaki son hazır soru olmuş. Havuzu yenileyip yeniden aç.',409);
  await audit(actor,revision===0?'Soru eklendi':'Soru güncellendi',q.id).run();return {ok:true,id:q.id};
 }
 if(body.action==='importQuestions'){
  if(!Array.isArray(body.questions)||!body.questions.length||body.questions.length>100)throw new AdminError('1–100 soru içeren bir dosya seç.');
  const qs=body.questions.map(validateQuestion);const keys=qs.map(q=>fingerprint(q.tr));if(new Set(keys).size!==keys.length||new Set(qs.map(q=>q.id)).size!==qs.length)throw new AdminError('Dosyanın içinde aynı soru birden fazla kez var.');
  const count=await db.prepare('SELECT COUNT(*) n FROM questions').first<{n:number}>();if((count?.n||0)+qs.length>2000)throw new AdminError('Havuz en fazla 2.000 soru içerebilir.');
  await db.batch([...qs.map(q=>db.prepare('INSERT INTO questions (id,payload,status,fingerprint,revision,created_at,updated_at) VALUES (?,?,\'draft\',?,1,?,?)').bind(q.id,JSON.stringify(q),fingerprint(q.tr),now,now)),audit(actor,'CSV içe aktarıldı',String(qs.length)+' soru')]);
  return {ok:true,count:qs.length};
 }
 if(body.action==='saveRound'||body.action==='resetRound'){
  const day=String(body.day);if(!validDay(day)||day<=today()||Date.parse(day)>Date.parse(today())+365*86400000)throw new AdminError('Yalnızca yarından başlayarak gelecek 365 günü düzenleyebilirsin.');
  const existing=await db.prepare('SELECT updated_at FROM day_rounds WHERE day=?').bind(day).first<{updated_at:string}>();if((existing?.updated_at||null)!==(body.expectedUpdatedAt??null))throw new AdminError('Takvim başka bir sekmede değişmiş. Günü yenile.',409);
  if(body.action==='resetRound'){
   if(!existing)return {ok:true};
   const result=await db.prepare("DELETE FROM day_rounds WHERE day=? AND day>strftime('%Y-%m-%d','now') AND updated_at=?").bind(day,existing.updated_at).run();
   if(!result.meta.changes)throw new AdminError('Bu gün artık düzenlenemiyor. Yenile.',409);await audit(actor,'Gün otomatiğe alındı',day).run();return {ok:true};
  }
  if(!Array.isArray(body.ids)||body.ids.length!==5||body.ids.some(x=>typeof x!=='string'))throw new AdminError('Beş soru seçmelisin.');
  const {results}=await db.prepare("SELECT payload FROM questions WHERE status='ready' AND id IN (?,?,?,?,?)").bind(...body.ids).all<{payload:string}>();const qs=(body.ids as string[]).map(id=>results.map(r=>JSON.parse(r.payload) as Question).find(q=>q.id===id)).filter(Boolean) as Question[];validateRound(qs);
  const result=await db.prepare("INSERT INTO day_rounds (day,questions,score_version,origin,updated_at) SELECT ?,?,?,'manual',? WHERE ?>strftime('%Y-%m-%d','now') ON CONFLICT(day) DO UPDATE SET questions=excluded.questions,score_version=excluded.score_version,origin='manual',updated_at=excluded.updated_at WHERE day_rounds.day>strftime('%Y-%m-%d','now') AND day_rounds.updated_at=?").bind(day,JSON.stringify(qs),scoringVersion(day),now,day,existing?.updated_at||'').run();
  if(!result.meta.changes)throw new AdminError('Gün kilitlendi veya başka sekmede değişti. Yenile.',409);await audit(actor,'Gün planlandı',day).run();return {ok:true};
 }
 throw new AdminError('İşlem tanınmadı.');
}
export async function exportCsv(url:URL){if(url.searchParams.get('kind')==='questions')return makeCsv((await questionRows()).map(q=>({...q.question,status:q.status,revision:q.revision})),[...csvFields,'status','revision']);
 const {start,end}=dateWindow(url);const db=contentDb();const count=await db.prepare('SELECT COUNT(*) n FROM runs WHERE day BETWEEN ? AND ?').bind(start,end).first<{n:number}>();if((count?.n||0)>10000)throw new AdminError('10.000 turdan fazlası için daha kısa tarih aralığı seç.');
 const {results}=await db.prepare('SELECT day,player,score,cursor,completed,answers FROM runs WHERE day BETWEEN ? AND ? ORDER BY day,created_at').bind(start,end).all<{day:string;player:string;score:number;cursor:number;completed:number;answers:string}>();
 const rows=results.flatMap(r=>{const a=JSON.parse(r.answers) as {id:string;low:number;high:number;answer:number;score:number;v?:number}[];return (a.length?a:[null]).map(a=>({day:r.day,player:r.player.slice(0,16),completed:r.completed,answered:r.cursor,total:r.score,question:a?.id||'',low:a?.low??'',high:a?.high??'',answer:a?.answer??'',score:a?.score??'',scoringVersion:a?.v||1}));});
 return makeCsv(rows,['day','player','completed','answered','total','question','low','high','answer','score','scoringVersion']);
}
