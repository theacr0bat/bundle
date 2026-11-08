import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {env} from './mock-workers.mjs';
import {GET,POST} from '../app/api/admin/route.ts';
import {GET as getGame} from '../app/api/game/route.ts';
import {POST as answer} from '../app/api/answer/route.ts';
import {liveRound} from '../lib/content.ts';
import {today} from '../lib/game.ts';
function adapter(sql){
 return {prepare(query){let args=[];return {bind(...values){args=values;return this;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};},async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
const owner={'oai-authenticated-user-id':'test-owner','oai-authenticated-user-email':'owner@sites.test'};
const origin='https://aralik.test';
function req(query='',body,headers=owner){return new Request(origin+'/api/admin'+query,{method:body===undefined?'GET':'POST',headers:{...headers,...(body===undefined?{}:{origin,'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});}
async function post(body,status=200,headers=owner){const r=await POST(req('',body,headers));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
async function get(query='',status=200,headers=owner){const r=await GET(req(query,undefined,headers));assert.equal(r.status,status,await r.clone().text());return r.json();}
test('yönetim API + gerçek SQLite: yetki, toplu işlem, sürüm çatışması, kilitli tur, analiz ve dışa aktarma',async()=>{
 const sql=new DatabaseSync(':memory:');for(const file of ['0000_common_sinister_six.sql','0001_cynical_toro.sql'])sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 env.DB=adapter(sql);env.ADMIN_OWNER_EMAIL='owner@sites.test';
 await get('?view=questions',401,{});await post({action:'initialize'},401,{});
 await get('?view=questions',403,{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@sites.test'});
 await post({action:'initialize'});let items=(await get('?view=questions')).items;assert.equal(items.length,75);
 await post({action:'initialize'});assert.equal((await get('?view=questions')).items.length,75);
 await get('?view=questions',403,{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'owner@sites.test'});
 const badOrigin=new Request(origin+'/api/admin',{method:'POST',headers:{...owner,origin:'https://other.test'},body:JSON.stringify({action:'initialize'})});assert.equal((await POST(badOrigin)).status,403);
 const sample={...items[0].question,id:'q-integration-test',tr:'Yerel testteki örnek soru kaç kilometredir?',en:'How far is this local test?',min:0,max:100,answer:50,source:''};
 await post({action:'saveQuestion',question:sample,status:'draft',revision:0});
 await post({action:'saveQuestion',question:sample,status:'ready',revision:1});
 await post({action:'saveQuestion',question:{...sample,answer:51},status:'ready',revision:1},409);
 const before=(await get('?view=questions')).items.length;
 await post({action:'importQuestions',questions:[{...sample,id:'q-import-one',tr:'Önce eklenen bu soru kaç metredir?'},{...sample,id:'q-import-two'}]},409);
 assert.equal((await get('?view=questions')).items.length,before,'failed import must roll back every row');
 await post({action:'importQuestions',questions:[{...sample,id:'q-valid-import',tr:'CSV örneğindeki ikinci sayı kaç metredir?'}]});
 assert.equal((await get('?view=questions')).items.find(i=>i.question.id==='q-valid-import').status,'draft');
 const current=today(),future=new Date(Date.parse(current+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 let plan=await get('?view=calendar&day='+future);const ids=plan.questions.map(q=>q.id);
 await post({action:'saveRound',day:current,ids,expectedUpdatedAt:null},400);
 await post({action:'saveRound',day:future,ids:[ids[0],ids[0],...ids.slice(2)],expectedUpdatedAt:null},400);
 await post({action:'saveRound',day:future,ids,expectedUpdatedAt:null});
 plan=await get('?view=calendar&day='+future);assert.equal(plan.origin,'manual');assert.equal(plan.locked,false);
 await post({action:'saveRound',day:future,ids,expectedUpdatedAt:null},409);
 const target=(await get('?view=questions')).items.find(i=>i.question.id===ids[0]);
 await post({action:'saveQuestion',question:{...target.question,tr:target.question.tr+' Düzenlendi.'},status:'archived',revision:target.revision});
 assert.deepEqual((await get('?view=calendar&day='+future)).questions,plan.questions,'scheduled round keeps immutable question snapshots');
 assert.deepEqual((await liveRound(future)).questions,plan.questions);
 const gameResponse=await getGame(new Request(origin+'/api/game',{headers:owner}));assert.equal(gameResponse.status,200);const game=await gameResponse.json();assert.equal(game.questions.length,5);assert.ok(!('answer' in game.questions[0]));assert.ok(!('source' in game.questions[0]));
 const snapshot=await liveRound(current),q=snapshot.questions[0];const answerReq=()=>new Request(origin+'/api/answer',{method:'POST',headers:{...owner,origin,'content-type':'application/json'},body:JSON.stringify({day:current,index:0,low:q.answer,high:q.answer})});
 const first=await answer(answerReq());assert.equal(first.status,200);const a=await first.json();assert.equal(a.answer.score,200);const repeated=await answer(answerReq());assert.deepEqual(await repeated.json(),a,'retry must not double-count');
 const activePlan=await get('?view=calendar&day='+current);assert.equal(activePlan.locked,true);
 const report=await get('?view=overview&from='+current+'&to='+current);assert.equal(report.summary.started,1);assert.equal(report.analysis[0].attempts,1);assert.equal(report.analysis[0].hitRate,100);
 assert.equal((await get('?view=ranges&id='+q.id+'&from='+current+'&to='+current)).samples.length,1);
 const csv=await GET(req('?view=export&kind=results&from='+current+'&to='+current));assert.equal(csv.status,200);assert.ok(csv.headers.get('content-type').startsWith('text/csv'));assert.ok((await csv.text()).includes('"200"'));
 await post({action:'resetRound',day:future,expectedUpdatedAt:plan.updatedAt});assert.equal((await get('?view=calendar&day='+future)).origin,'automatic');
 await get('?view=overview&to=bad-date',400);
 const easy=(await get('?view=questions')).items.filter(i=>i.status==='ready'&&i.question.category==='space'&&i.question.difficulty==='easy');
 for(const item of easy.slice(2))await post({action:'saveQuestion',question:item.question,status:'archived',revision:item.revision});
 const racing=await Promise.all(easy.slice(0,2).map(item=>POST(req('',{action:'saveQuestion',question:item.question,status:'archived',revision:item.revision}))));
 assert.equal(racing.filter(r=>r.status===200).length,1,'concurrent tabs cannot archive the last ready slot');
 assert.equal((await get('?view=questions')).items.filter(i=>i.status==='ready'&&i.question.category==='space'&&i.question.difficulty==='easy').length,1);
 sql.close();delete env.DB;delete env.ADMIN_OWNER_EMAIL;
});
