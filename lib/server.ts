import {liveRound} from './content';
import {scoringVersion} from './scoring';
import { env } from 'cloudflare:workers';
import { dailyQuestions, dayIndex, publicQuestion, today } from './game';
import { buildCrowd, buildMe, shiftDay, ME_WINDOW } from './insights';
export type SavedAnswer={v?:number;index:number;id:string;base?:number;bonus?:number;low:number;high:number;score:number;answer:number;source:string;noteTr:string;noteEn:string};
export type Run={id:string;day:string;player:string;cursor:number;score:number;answers:string;completed:number};
export function database(){if(!env.DB)throw new Error('Database unavailable');return env.DB;}
export async function identity(req:Request){
 const mode=(env as unknown as {AUTH_MODE?:string}).AUTH_MODE;
 const user=!mode||mode==='sites'?req.headers.get('oai-authenticated-user-id'):null;
 const raw=(req.headers.get('cookie')||'').match(/(?:^|;\s*)aralik_player=([a-f0-9-]{36})(?:;|$)/)?.[1];
 const token=raw||crypto.randomUUID();
 const base=user?'user:'+user:'guest:'+token;
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(base));
 const player=Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
 return {player,cookie:raw?null:`aralik_player=${token}; HttpOnly; ${new URL(req.url).protocol==='https:'||req.headers.get('x-forwarded-proto')==='https'?'Secure; ':''}SameSite=Lax; Path=/; Max-Age=31536000`};
}
export function json(body:unknown,status=200,cookie?:string|null){const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store, private','Vary':'Cookie'};if(cookie)headers['Set-Cookie']=cookie;return new Response(JSON.stringify(body),{status,headers});}
export async function getRun(day:string,player:string){return database().prepare('SELECT * FROM runs WHERE id = ?').bind(day+':'+player).first<Run>();}
export async function gameState(day:string,player:string){const run=await getRun(day,player);const round=await liveRound(day);return {day,scoreVersion:round.scoreVersion,edition:dayIndex(day)+1,resetAt:new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString(),questions:round.questions.map(publicQuestion),run:run?{cursor:run.cursor,score:run.score,completed:!!run.completed,answers:JSON.parse(run.answers)}:null};}
export async function stats(day:string,player:string){const own=await getRun(day,player);const row=await database().prepare('SELECT COUNT(*) as count, AVG(score) as average, SUM(CASE WHEN score < ? THEN 1 ELSE 0 END) as below, SUM(CASE WHEN score = ? THEN 1 ELSE 0 END) as tied FROM runs WHERE day = ? AND completed = 1 AND player != ?').bind(own?.score??0,own?.score??0,day,player).first<{count:number;average:number|null;below:number|null;tied:number|null}>();const count=row?.count||0;return {others:count,total:count+(own?.completed?1:0),average:count?Math.round(row!.average!):null,percentile:count&&own?.completed?Math.round(100*(row?.below||0)/count):null,tied:row?.tied||0,score:own?.completed?own.score:null};}
export function validOrigin(req:Request){const o=req.headers.get('origin');if(!o)return true;try{return [new URL(req.url).host,req.headers.get('host'),req.headers.get('x-forwarded-host')].includes(new URL(o).host);}catch{return false;}}

// Kalabalık: şema değişikliği gerektirmez; son 2000 tamamlanmış turun cevap JSON'u SQLite json_each ile açılır.
export async function crowd(day:string,player:string){const run=await getRun(day,player);if(!run)return {};
 const {results}=await database().prepare("SELECT CAST(json_extract(j.value,'$.index') AS INTEGER) AS idx, json_extract(j.value,'$.id') AS id, CAST(json_extract(j.value,'$.low') AS INTEGER) AS low, CAST(json_extract(j.value,'$.high') AS INTEGER) AS high FROM (SELECT answers FROM runs WHERE day = ? AND completed = 1 AND player != ? ORDER BY created_at DESC LIMIT 2000) r, json_each(r.answers) j").bind(day,player).all<{idx:number;id:string;low:number;high:number}>();
 return buildCrowd(results,(await liveRound(day)).questions,run.cursor);}
// Seri/istatistik: birincil anahtar (gün:oyuncu) ile son 90 gün aranır; oyuncu sütununda tam tablo taraması yapılmaz.
export async function me(day:string,player:string){const ids=Array.from({length:ME_WINDOW},(_,i)=>shiftDay(day,-i)+':'+player);
 const {results}=await database().prepare(`SELECT day, score, answers FROM runs WHERE completed = 1 AND id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all<{day:string;score:number;answers:string}>();
 return buildMe(results,day);}
