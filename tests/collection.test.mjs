import test from 'node:test';
import assert from 'node:assert/strict';
import {questionBank} from '../lib/question-bank.ts';
import {dailyQuestions,collectionQuestions,publicQuestion,COLLECTION_START} from '../lib/game.ts';
import {dailyQuestions as oldDaily} from '../lib/previous-game.ts';
import {practiceQuestions} from '../lib/practice.ts';
import {scoreBreakdown} from '../lib/scoring.ts';

test('yeni havuz: 75 benzersiz soru, 30 kolay / 30 orta / 15 zor',()=>{
 assert.equal(questionBank.length,75);
 assert.equal(new Set(questionBank.map(q=>q.id)).size,75);
 assert.deepEqual(['easy','medium','hard'].map(d=>questionBank.filter(q=>q.difficulty===d).length),[30,30,15]);
 for(const q of questionBank){
  assert.ok(q.tr&&q.en&&q.noteTr&&q.noteEn&&q.source.startsWith('https://'),q.id);
  assert.ok([q.min,q.max,q.answer].every(Number.isSafeInteger),q.id);
  assert.ok(q.min<q.answer&&q.answer<q.max,q.id);
  assert.equal(scoreBreakdown(q,q.answer,q.answer).total,200,q.id);
  assert.equal(scoreBreakdown(q,q.min,q.max).total,0,q.id);
 }
});
test('yeni takvim: 15 günde her soru bir kez, her gün 2 kolay 2 orta 1 zor',()=>{
 const seen=new Set();
 for(let day=0;day<15;day++){
  const qs=collectionQuestions(day);
  assert.equal(qs.length,5);
  assert.equal(new Set(qs.map(q=>q.category)).size,5);
  assert.deepEqual(qs.map(q=>q.difficulty),['easy','easy','medium','medium','hard']);
  for(const q of qs){assert.ok(!seen.has(q.id),q.id);seen.add(q.id);}
  assert.deepEqual(qs,collectionQuestions(day+15));
 }
 assert.equal(seen.size,75);
});
test('başlanmış eski turlar değişmez; yeni havuz yalnızca başlangıç tarihinde açılır',()=>{
 for(const day of ['2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03'])assert.deepEqual(dailyQuestions(day),oldDaily(day));
 assert.deepEqual(dailyQuestions(COLLECTION_START),collectionQuestions(0));
 assert.deepEqual(dailyQuestions('2026-11-19'),collectionQuestions(0));
});
test('soruların açık API biçimi cevabı, açıklamayı ve kaynağı sızdırmaz',()=>{
 for(const q of questionBank){
  const pub=publicQuestion(q);
  for(const secret of ['answer','source','noteTr','noteEn','verifiedAt'])assert.ok(!(secret in pub));
  assert.equal(pub.difficulty,q.difficulty);
 }
});
test('alıştırma ayrı sorular kullanır, günlük havuzu ifşa etmez',()=>{
 assert.deepEqual(practiceQuestions.map(q=>q.difficulty),['easy','easy','medium','medium','hard']);
 for(const p of practiceQuestions){
  assert.ok(!questionBank.some(q=>q.id===p.id||q.tr===p.tr));
  assert.ok(p.min<=p.answer&&p.answer<=p.max);
 }
});

test('yeni havuz: tarihe dayalı cevap yok, cevaplar merkezde toplanmaz, küçük adetler azınlıktadır',()=>{
 assert.ok(questionBank.every(q=>q.unitTr!=='yıl'));
 assert.ok(questionBank.filter(q=>Math.abs((q.answer-q.min)/(q.max-q.min)-.5)<.05).length<questionBank.length/3);
 assert.ok(questionBank.filter(q=>Math.abs(q.answer)<10).length<10);
});
