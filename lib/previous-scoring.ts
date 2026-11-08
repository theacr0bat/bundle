export const SCORE_VERSION=2; // v2: bonus bandı = min(|cevap|×%5, çubuk×%5). v1 kayıtlarında 'v' alanı yoktur.
export function basePoints(q:{min:number;max:number},low:number,high:number){const width=Math.max(0,Math.min(1,(high-low)/(q.max-q.min)));return Math.round(160*Math.pow(1-width,6));}
export function scoreBreakdown(q:{min:number;max:number;answer:number},low:number,high:number){
 const hit=low<=q.answer&&high>=q.answer;if(!hit)return {base:0,bonus:0,total:0,hit:false};
 const tolerance=Math.min(Math.abs(q.answer)*.05,(q.max-q.min)*.05);
 const bonus=(low>q.min||high<q.max)&&low>=q.answer-tolerance&&high<=q.answer+tolerance?40:0;
 const base=basePoints(q,low,high);return {base,bonus,total:base+bonus,hit:true};
}
export function points(q:{min:number;max:number;answer:number},low:number,high:number){return scoreBreakdown(q,low,high).total;}
