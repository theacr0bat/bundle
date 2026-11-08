import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCrowd, buildMe, shiftDay, shareText, shareSquare, parseChallenge, CROWD_BINS, isHit, visibleCrowd } from '../lib/insights.ts';

const q = { min: 0, max: 100, answer: 50 };
const row = (idx, low, high) => ({ idx, low, high });
const ans = (low, high, answer = 50) => JSON.stringify([{ low, high, answer }]);

test('kalabalık: 5 kişiden azsa hiçbir şey döndürmez (küçük örnek gizlenir)', () => {
  assert.deepEqual(buildCrowd([row(0, 40, 60), row(0, 0, 100), row(0, 45, 55), row(0, 10, 20)], [q], 1), {});
});
test('kalabalık: oyuncunun henüz cevaplamadığı soru asla dönmez', () => {
  const rows = Array.from({ length: 6 }, () => row(1, 40, 60));
  assert.deepEqual(buildCrowd(rows, [q, q], 1), {});
  assert.ok(buildCrowd(rows, [q, q], 2)[1]);
});
test('kalabalık: isabet sayısı ve dilim oranları', () => {
  const rows = [row(0, 40, 60), row(0, 40, 60), row(0, 40, 60), row(0, 0, 10), row(0, 90, 100), row(0, 0, 100)];
  const c = buildCrowd(rows, [q], 1)[0];
  assert.equal(c.n, 6); assert.equal(c.hits, 4); assert.equal(c.bins.length, CROWD_BINS);
  assert.ok(c.bins[20] > c.bins[2] && c.bins[20] > c.bins[38], 'merkez dilim en yoğun olmalı');
  assert.ok(c.bins.every(b => b >= 0 && b <= 1));
});
test('kalabalık: bozuk satırlar atlanır', () => {
  const rows = [row(0, 60, 40), row(NaN, 1, 2), row(9, 1, 2), ...Array.from({ length: 5 }, () => row(0, 40, 60))];
  assert.equal(buildCrowd(rows, [q], 1)[0].n, 5);
});

test('seri: bugün oynandıysa bugünden geriye sayar', () => {
  const rows = ['2026-11-02', '2026-11-01', '2026-10-31'].map(day => ({ day, score: 100, answers: ans(40, 60) }));
  const m = buildMe(rows, '2026-11-02');
  assert.equal(m.streak, 3); assert.equal(m.doneToday, true); assert.equal(m.bestStreak, 3);
});
test('seri: bugün henüz oynanmadıysa dünden sayılır ve yaşar', () => {
  const rows = ['2026-11-01', '2026-10-31'].map(day => ({ day, score: 100, answers: ans(40, 60) }));
  const m = buildMe(rows, '2026-11-02');
  assert.equal(m.streak, 2); assert.equal(m.doneToday, false);
});
test('seri: boşluk seriyi koparır, en uzun seri korunur', () => {
  const rows = ['2026-11-02', '2026-10-30', '2026-10-29', '2026-10-28'].map(day => ({ day, score: 50, answers: ans(0, 10) }));
  const m = buildMe(rows, '2026-11-02');
  assert.equal(m.streak, 1); assert.equal(m.bestStreak, 3);
});
test('istatistik: ortalama, en iyi, isabet oranı; kayıt yoksa boş', () => {
  const rows = [{ day: '2026-11-02', score: 100, answers: ans(40, 60) }, { day: '2026-11-01', score: 300, answers: ans(0, 10) }];
  const m = buildMe(rows, '2026-11-02');
  assert.equal(m.average, 200); assert.equal(m.best, 300); assert.equal(m.hitRate, 50);
  const e = buildMe([], '2026-11-02');
  assert.equal(e.streak, 0); assert.equal(e.average, null); assert.equal(e.hitRate, null);
});
test('takvim yardımcısı: ay sınırı', () => { assert.equal(shiftDay('2026-11-01', -1), '2026-10-31'); });

test('paylaşım: sıfır puanlık isabet ıska değildir', () => {
 const zeroHit={low:0,high:100,answer:50,score:0},miss={low:0,high:10,answer:50,score:0};
 assert.equal(isHit(zeroHit),true);assert.equal(isHit(miss),false);
 assert.equal(shareSquare(zeroHit),'🟧');assert.equal(shareSquare(miss),'⬛');
 const answers=[{...zeroHit,score:120},miss,{...zeroHit,score:40},zeroHit,{...zeroHit,score:200}];
 const text=shareText({edition:4,answers,total:360,percentile:70,streak:5,url:'https://x.test/'});
 assert.equal(text,'BOUNDLE #004\n🟩⬛🟨🟧🟩\n360/1000 · Players outscored: 70% · 🔥 5\nhttps://x.test/');
});
test('kalabalık: alıştırma ve tekrar turlarında eski günlük veri gösterilmez',()=>{
 const c={0:{n:6,hits:4,bins:[]}};
 assert.equal(visibleCrowd(c,true,0),undefined);
 assert.equal(visibleCrowd(c,false,0),c[0]);
});
test('kalabalık: farklı soru kimliği ve çubuk dışı aralıklar sayılmaz',()=>{
 const rows=Array.from({length:5},()=>({...row(0,40,60),id:'old'}));
 assert.deepEqual(buildCrowd(rows,[{...q,id:'new'}],1),{});
 assert.deepEqual(buildCrowd(Array.from({length:5},()=>row(0,-1,101)),[q],1),{});
});

test('meydan okuma: geçerli bağlantı okunur, sahte/bozuk değerler reddedilir', () => {
  assert.deepEqual(parseChallenge('?m=612&e=4'), { score: 612, edition: 4 });
  for (const bad of ['', '?m=1001&e=4', '?m=-5&e=4', '?m=abc&e=4', '?m=5', '?m=5&e=0', '?m=1e3&e=4', '?m=<b>&e=4']) assert.equal(parseChallenge(bad), null, bad);
});
