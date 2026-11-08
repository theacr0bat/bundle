// Saf (veritabanı/tarayıcı gerektirmeyen) mantık: seri, kalabalık aralıkları, paylaşım metni, meydan okuma bağlantısı.
export const CROWD_BINS=40,CROWD_MIN=5,ME_WINDOW=90;
export type Crowd={n:number;hits:number;bins:number[]};
export type Me={streak:number;capped:boolean;doneToday:boolean;bestStreak:number;played:number;average:number|null;best:number|null;hitRate:number|null};
type Q={id?:string;min:number;max:number;answer:number};
export function isHit(a:{low:number;high:number;answer:number}){return a.low<=a.answer&&a.answer<=a.high;}
export function visibleCrowd(crowd:Record<number,Crowd>,practice:boolean,index:number){return practice?undefined:crowd[index];}
export function shiftDay(day:string,n:number){return new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);}

// Diğer oyuncuların aralıkları → her soru için 40 dilimlik "kaç kişinin aralığı bu dilimi kapsıyor" oranı.
// Yalnızca bu oyuncunun cevapladığı sorular (index < cursor) ve en az CROWD_MIN kişi olan sorular döner.
export function buildCrowd(rows:{idx:number;id?:string;low:number;high:number}[],qs:Q[],cursor:number):Record<number,Crowd>{
 const acc:Record<number,{n:number;hits:number;c:number[]}>={};
 for(const r of rows){
  if(!Number.isInteger(r.idx)||r.idx<0||r.idx>=cursor)continue;const q=qs[r.idx];if(!q||(q.id&&r.id!==q.id)||!Number.isFinite(r.low)||!Number.isFinite(r.high)||r.low>r.high||r.low<q.min||r.high>q.max)continue;
  const a=acc[r.idx]??=({n:0,hits:0,c:new Array(CROWD_BINS).fill(0)});a.n++;if(r.low<=q.answer&&r.high>=q.answer)a.hits++;
  const w=(q.max-q.min)/CROWD_BINS;for(let i=0;i<CROWD_BINS;i++){const s=q.min+i*w;if(r.high>=s&&r.low<=s+w)a.c[i]++;}
 }
 const out:Record<number,Crowd>={};
 for(const [k,a] of Object.entries(acc))if(a.n>=CROWD_MIN)out[Number(k)]={n:a.n,hits:a.hits,bins:a.c.map(x=>Math.round(100*x/a.n)/100)};
 return out;
}

// Son 90 günün tamamlanmış turlarından seri ve kişisel istatistik. Seri, bugün henüz oynanmadıysa dünden sayılır (gün bitene kadar yaşar).
export function buildMe(rows:{day:string;score:number;answers:string}[],today:string):Me{
 const by=new Map(rows.map(r=>[r.day,r]));const has=(i:number)=>by.has(shiftDay(today,-i));
 const doneToday=has(0);let streak=0;for(let i=doneToday?0:1;i<ME_WINDOW&&has(i);i++)streak++;
 let best=0,run=0;for(let i=ME_WINDOW-1;i>=0;i--){if(has(i)){run++;best=Math.max(best,run);}else run=0;}
 let hits=0,total=0;for(const r of rows){try{for(const a of JSON.parse(r.answers) as {low:number;high:number;answer:number}[]){total++;if(a.low<=a.answer&&a.high>=a.answer)hits++;}}catch{}}
 const n=rows.length;
 return {streak,capped:streak>=ME_WINDOW-(doneToday?0:1),doneToday,bestStreak:best,played:n,average:n?Math.round(rows.reduce((s,r)=>s+r.score,0)/n):null,best:n?Math.max(...rows.map(r=>r.score)):null,hitRate:total?Math.round(100*hits/total):null};
}

// Paylaşım karesi: ⬛ ıska, 🟧 geniş isabet, 🟨 orta, 🟩 dar (≈ çubuğun %7'sinden dar) isabet.
export type ShareAnswer={score:number;low:number;high:number;answer:number};
export function shareSquare(a:ShareAnswer){return !isHit(a)?'⬛':a.score>=100?'🟩':a.score>=30?'🟨':'🟧';}
export function shareText(o:{edition:number;answers:ShareAnswer[];total:number;percentile:number|null;streak:number;url:string}){
 const pct=(n:number)=>`${n}%`;const parts=[`${o.total}/1000`];
 if(o.percentile!==null)parts.push(`Players outscored: ${pct(o.percentile)}`);
 if(o.streak>1)parts.push(`🔥 ${o.streak}`);
 return `BOUNDLE #${String(o.edition).padStart(3,'0')}\n${o.answers.map(shareSquare).join('')}\n${parts.join(' · ')}\n${o.url}`;
}
// ?m=puan&e=tur numarası. Yalnızca görüntülenen bir davettir; istatistiklere hiçbir zaman karışmaz.
export function parseChallenge(search:string){const p=new URLSearchParams(search);const m=p.get('m'),e=p.get('e');if(m===null||e===null||!/^\d{1,4}$/.test(m)||!/^\d{1,5}$/.test(e))return null;const score=Number(m),edition=Number(e);return score<=1000&&edition>0?{score,edition}:null;}
