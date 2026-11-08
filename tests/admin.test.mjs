import test from 'node:test';import assert from 'node:assert/strict';
import {questionBank} from '../lib/question-bank.ts';
import {validateQuestion,validateRound,parseCsv,csvQuestions,makeCsv,canManage,selectAutomatic,fingerprint,validDay} from '../lib/admin-model.ts';
const q=()=>({...questionBank[0]});
test('yönetim: anonim ve farklı hesap reddedilir; ilk kurulum yalnız doğrulanmış sahip e-postasıyla',()=>{
 assert.equal(canManage({id:null,email:null},null,'owner@example.com'),false);
 assert.equal(canManage({id:'x',email:'other@example.com'},null,'owner@example.com'),false);
 assert.equal(canManage({id:'x',email:'owner@example.com'},null,''),false);
 assert.equal(canManage({id:'x',email:'OWNER@example.com'},null,'owner@example.com'),true);
 assert.equal(canManage({id:'x',email:'owner@example.com'},'y','owner@example.com'),false);
 assert.equal(canManage({id:'x',email:'changed@example.com'},'x','owner@example.com'),true);
});
test('soru doğrulama: cevap dışarıda, ters sınır, boşluk, kategori, ondalık ve zararlı kaynak reddedilir',()=>{
 for(const change of [{answer:99999999999},{max:0},{tr:''},{category:'__proto__'},{difficulty:'impossible'},{answer:1.5},{min:NaN},{source:'javascript:alert(1)'},{id:'../../x'}])assert.throws(()=>validateQuestion({...q(),...change}));
 const input={...q(),en:'',unitEn:'',noteEn:'',source:''};const parsed=validateQuestion(input);assert.equal(parsed.en,parsed.tr);assert.equal(parsed.unitEn,parsed.unitTr);
});
test('CSV: Türkçe BOM, iki ayırıcı, tırnaklar, satır sonları ve negatif sayılar',()=>{
 const row={...q(),tr:'Bir "alıntı", virgül; ve\nyeni satır?',answer:-39,min:-100,max:0};const text=makeCsv([row],['tr','en','answer','min','max','unitTr','category','difficulty','noteTr']);
 const parsed=csvQuestions(text);assert.equal(parsed[0].tr,row.tr);assert.equal(parsed[0].answer,-39);
 const comma='tr,answer,min,max,unitTr,category,difficulty,noteTr\r\n"Bir soru, iki sayı?",50,0,100,km,space,easy,"Açıklama, burada."';assert.equal(csvQuestions(comma)[0].answer,50);
});
test('CSV: kötü satır, eksik sütun, kesir, açık tırnak, büyük dosya ve fazla soru reddedilir',()=>{
 assert.throws(()=>parseCsv('tr,tr\na,b'));
 assert.throws(()=>parseCsv('tr,answer\nSoru,3'));
 assert.throws(()=>parseCsv('"a,b\nx,y'));
 assert.throws(()=>parseCsv('x'.repeat(500001)));
 const text=makeCsv([{...q(),answer:'1,5'}],['tr','answer','min','max','unitTr','category','difficulty','noteTr']);assert.throws(()=>csvQuestions(text));
 const tooMany=makeCsv(Array.from({length:101},q),['tr','answer','min','max','unitTr','category','difficulty','noteTr']);assert.throws(()=>parseCsv(tooMany));
});
test('CSV: Excel formül enjeksiyonu metinde kaçışlanır, sayısal eksi korunur',()=>{
 const csv=makeCsv([{tr:'=HYPERLINK("bad")',answer:-39,note:'@SUM(A1)'}],['tr','answer','note']);assert.ok(csv.includes('"\'=HYPERLINK'));assert.ok(csv.includes('"-39"'));assert.ok(csv.includes('"\'@SUM'));
});
test('otomatik seçim: belirleyici, 5 kategori, 2 kolay 2 orta 1 zor, en az yakın kullanılan önce',()=>{
 const day='2026-11-08',used=new Map();const first=selectAutomatic(questionBank,day,used);validateRound(first);assert.deepEqual(selectAutomatic(questionBank,day,used),first);
 const same=first[0];used.set(same.id,'2026-11-07');assert.notEqual(selectAutomatic(questionBank,day,used).find(q=>q.category===same.category).id,same.id);
 assert.throws(()=>selectAutomatic([],day,new Map()));
});
test('takvim doğrulama: beş farklı soru, zorluk dağılımı ve her kategori zorunlu',()=>{
 const qs=selectAutomatic(questionBank,'2026-11-08',new Map());assert.doesNotThrow(()=>validateRound(qs));
 assert.throws(()=>validateRound(qs.slice(1)));assert.throws(()=>validateRound([...qs.slice(0,4),qs[0]]));assert.throws(()=>validateRound(qs.map(q=>({...q,difficulty:'easy'}))));
 assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2028-02-29'),true);assert.equal(validDay('2026-11-07'),true);
 assert.equal(fingerprint('  İLGİNÇ   bir soru '),fingerprint('ilginç bir soru'));
});
