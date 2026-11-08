import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreBreakdown, basePoints, SCORE_VERSION } from '../lib/scoring.ts';
import { collections, dailyQuestions, setIndex, SET_ORDER, dayIndex } from '../lib/legacy-game.ts';

const days = (n, start = '2026-10-30') => Array.from({ length: n }, (_, i) => new Date(Date.parse(start + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10));

test('puan: ıska 0, tam isabet 200, tam çubuk 0', () => {
  const q = { min: 0, max: 100, answer: 50 };
  assert.equal(scoreBreakdown(q, 60, 70).total, 0);
  assert.equal(scoreBreakdown(q, 50, 50).total, 200);
  assert.equal(scoreBreakdown(q, 0, 100).total, 0);
  assert.equal(basePoints(q, 40, 60), 128);
});
test('puan: sınırlar dahil sayılır', () => {
  const q = { min: 0, max: 100, answer: 50 };
  assert.equal(scoreBreakdown(q, 50, 80).hit, true);
  assert.equal(scoreBreakdown(q, 20, 50).hit, true);
});
test('puan v3: tahmin önizlemesi ve kazanılan puan aynıdır; bonus yok', () => {
 const q={min:0,max:100,answer:50};
 for(const [lo,hi,expected] of [[50,50,200],[45,55,162],[40,65,113],[25,75,50],[0,100,0]]){
  assert.equal(basePoints(q,lo,hi),expected);
  assert.deepEqual(scoreBreakdown(q,lo,hi),{base:expected,bonus:0,total:expected,hit:true});
 }
 assert.equal(SCORE_VERSION,3);
});
test('puan: daraltmak puanı azaltmaz; sıfır ve negatif cevapta aynı davranış',()=>{
 for(const answer of [-50,0,50]){
  const q={min:-100,max:100,answer};
  assert.equal(scoreBreakdown(q,answer,answer).total,200);
  let prior=201;
  for(let size=0;size<=50;size++){
   const result=scoreBreakdown(q,answer-size,answer+size);
   assert.ok(result.total<=prior);assert.equal(result.bonus,0);prior=result.total;
  }
 }
});
test('puan: bozuk veya çubuk dışındaki aralık kazandırmaz',()=>{
 const q={min:0,max:100,answer:50};
 for(const [low,high] of [[80,20],[-1,60],[20,101],[NaN,50],[50,Infinity]]){
  assert.equal(basePoints(q,low,high),0);assert.equal(scoreBreakdown(q,low,high).total,0);
 }
});
test('geçiş: eski günler önceki puanlamayı, yeni günler v3 kullanır',async()=>{
 const {scoringVersion,missDistance}=await import('../lib/scoring.ts');
 assert.equal(scoringVersion('2026-11-03'),2);assert.equal(scoringVersion('2026-11-04'),3);
 const q={min:1700,max:2025,answer:1969};
 assert.equal(scoreBreakdown(q,1960,1975,2).bonus,40);
 assert.equal(scoreBreakdown(q,1960,1975,3).bonus,0);
 assert.equal(missDistance({low:30,high:40,answer:50}),10);
 assert.equal(missDistance({low:60,high:80,answer:50}),10);
 assert.equal(missDistance({low:40,high:60,answer:50}),0);
});

test('soru bankası: 5 kategori eşit, her kayıt tutarlı', () => {
  assert.equal(collections.length, 5);
  assert.ok(collections.every(c => c.length === collections[0].length), 'kategoriler eşit uzunlukta olmalı');
  const ids = new Set();
  for (const day of days(collections[0].length)) for (const q of dailyQuestions(day)) {
    assert.ok(!ids.has(q.id + day), 'aynı gün içinde tekrar id');
    assert.ok(q.tr && q.en && q.noteTr && q.noteEn, q.id + ': TR/EN metin eksik');
    assert.ok(/^https?:\/\//.test(q.source), q.id + ': kaynak yok');
    assert.ok(Number.isInteger(q.answer) && q.min < q.max, q.id + ': aralık/cevap geçersiz');
    assert.ok(q.answer >= q.min && q.answer <= q.max, q.id + ': cevap çubuğun dışında');
  }
  const all = collections.flat().map(q => q.id);
  assert.equal(new Set(all).size, all.length, 'tekrar eden soru id');
});
test('takvim: 12 günde her set tam bir kez (art arda tekrar yok)', () => {
  const n = collections[0].length;
  for (let start = 0; start < 40; start++) {
    const seen = new Set(Array.from({ length: n }, (_, i) => setIndex(start + i, n)));
    assert.equal(seen.size, n, `gün ${start}.. penceresinde tekrar var`);
  }
  assert.equal(SET_ORDER.length, n);
});
test('takvim: yayınlanmış günler (0-4) değişmedi', () => {
  const old = d => (d === 0 ? 0 : (d + 7) % 12);
  for (let d = 0; d <= 4; d++) assert.equal(setIndex(d, 12), old(d), `gün ${d}`);
  assert.equal(dayIndex('2026-10-30'), 0);
});
test('günlük 5 soru, kategori sırası sabit, cevaplar çubuk içinde', () => {
  for (const day of days(30)) {
    const qs = dailyQuestions(day);
    assert.deepEqual(qs.map(q => q.category), ['space', 'science', 'history', 'culture', 'sport']);
    for (const q of qs) assert.ok(q.answer >= q.min && q.answer <= q.max, day + ' ' + q.id);
  }
});
