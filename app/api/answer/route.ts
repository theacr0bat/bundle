import {liveRound} from '../../../lib/content';
import { database,getRun,identity,json,validOrigin } from '../../../lib/server';
import {scoreBreakdown,scoringVersion} from '../../../lib/scoring';
import { dailyQuestions,today } from '../../../lib/game';
export const dynamic='force-dynamic';
// En iyi çaba hız sınırı (Worker örneği başına). Gerçek koruma için Turnstile gerekir. Paylaşımlı IP'ler (mobil operatör) için cömert tutuldu.
const hits=new Map<string,{n:number;t:number}>();
function limited(req:Request){const ip=req.headers.get('cf-connecting-ip');if(!ip)return false;const now=Date.now();const h=hits.get(ip);if(!h||now-h.t>60000){if(hits.size>5000)hits.clear();hits.set(ip,{n:1,t:now});return false;}h.n++;return h.n>120;}
export async function POST(req:Request){
 if(!validOrigin(req))return json({error:'invalid_origin'},403);
 if(limited(req))return json({error:'rate_limited'},429);
 try{
 const {player,cookie}=await identity(req);let body:{day:string;index:number;low:number;high:number};try{body=await req.json();}catch{return json({error:'invalid_request'},400,cookie);}const day=today();
 if(!body||typeof body!=='object')return json({error:'invalid_request'},400,cookie);
 if(body.day!==day)return json({error:'new_day'},409,cookie);
 const {low,high,index}=body;const round=await liveRound(day);const questions=round.questions;const q=questions[index];
 if(!Number.isInteger(index)||!q||!Number.isSafeInteger(low)||!Number.isSafeInteger(high)||low>high||low<q.min||high>q.max)return json({error:'invalid_range'},400,cookie);
 const id=day+':'+player;const db=database();
 await db.prepare('INSERT OR IGNORE INTO runs (id, day, player, cursor, score, answers, completed, created_at) VALUES (?, ?, ?, 0, 0, ?, 0, ?)').bind(id,day,player,'[]',new Date().toISOString()).run();
 const run=await getRun(day,player);if(!run)return json({error:'service_unavailable'},503,cookie);
 const answers=JSON.parse(run.answers);
 if(run.cursor>index)return json({answer:answers[index],cursor:run.cursor,score:run.score,completed:!!run.completed},200,cookie);
 if(index!==run.cursor||run.completed)return json({error:'out_of_order'},409,cookie);
 const breakdown=scoreBreakdown(q,low,high,round.scoreVersion);const score=breakdown.total;const answer={v:round.scoreVersion,base:breakdown.base,bonus:breakdown.bonus,index,id:q.id,low,high,score,answer:q.answer,source:q.source,noteTr:q.noteTr,noteEn:q.noteEn};
 answers.push(answer);
 const update=await db.prepare('UPDATE runs SET cursor = ?, score = ?, answers = ?, completed = ? WHERE id = ? AND cursor = ?').bind(index+1,run.score+score,JSON.stringify(answers),index===4?1:0,id,index).run();
 if(!update.meta.changes)return json({error:'conflict'},409,cookie);
 return json({answer,cursor:index+1,score:run.score+score,completed:index===4},200,cookie);
 }catch{return json({error:'service_unavailable'},503);}
}
