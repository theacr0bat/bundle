import {env} from 'cloudflare:workers';
import {dailyQuestions,today} from './game';
import type {Question} from './game';
import {questionBank} from './question-bank';
import {scoringVersion} from './scoring';
import {selectAutomatic} from './admin-model';
export const MANAGED_START='2026-11-08';
export function contentDb(){if(!env.DB)throw new Error('Veritabanı kullanılamıyor.');return env.DB;}
export type DayRound={day:string;questions:string;score_version:number;origin:string;updated_at:string};
export async function initializeBank(){const db=contentDb();if(await db.prepare("SELECT value FROM admin_settings WHERE key='bank_seed_v6'").first())return;
 const now=new Date().toISOString();const {fingerprint}=await import('./admin-model');
 await db.batch([...questionBank.map(q=>db.prepare('INSERT OR IGNORE INTO questions (id,payload,status,fingerprint,revision,created_at,updated_at) VALUES (?,?,\'ready\',?,1,?,?)').bind(q.id,JSON.stringify(q),fingerprint(q.tr),now,now)),db.prepare("INSERT OR IGNORE INTO admin_settings (key,value) VALUES ('bank_seed_v6','done')")]);}
export async function suggestedQuestions(day:string){
 if(day<MANAGED_START)return dailyQuestions(day);
 await initializeBank();const db=contentDb();const {results:rows}=await db.prepare("SELECT payload FROM questions WHERE status='ready' ORDER BY id LIMIT 2000").all<{payload:string}>();
 const used=new Map<string,string>();
 // Include pre-panel history so the new selector does not immediately repeat recent questions.
 for(let n=15;n>=1;n--){const d=new Date(Date.parse(day+'T00:00:00Z')-n*86400000).toISOString().slice(0,10);if(d<MANAGED_START)for(const q of dailyQuestions(d))used.set(q.id,d);}
 const {results:rounds}=await db.prepare('SELECT day,questions FROM day_rounds WHERE day < ? ORDER BY day DESC LIMIT 90').bind(day).all<{day:string;questions:string}>();
 for(const r of [...rounds].reverse())for(const q of JSON.parse(r.questions) as Question[])if((used.get(q.id)||'')<r.day)used.set(q.id,r.day);
 return selectAutomatic(rows.map(r=>JSON.parse(r.payload)),day,used);
}
export async function getDayRound(day:string){const db=contentDb();let row=await db.prepare('SELECT * FROM day_rounds WHERE day=?').bind(day).first<DayRound>();if(row)return row;
 const qs=await suggestedQuestions(day);const version=scoringVersion(day);await db.prepare('INSERT OR IGNORE INTO day_rounds (day,questions,score_version,origin,updated_at) VALUES (?,?,?,?,?)').bind(day,JSON.stringify(qs),version,'automatic',new Date().toISOString()).run();
 row=await db.prepare('SELECT * FROM day_rounds WHERE day=?').bind(day).first<DayRound>();if(!row)throw new Error('Tur oluşturulamadı.');return row;}
export async function liveRound(day=today()){const row=await getDayRound(day);return {questions:JSON.parse(row.questions) as Question[],scoreVersion:row.score_version};}
