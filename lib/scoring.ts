import {scoreBreakdown as previousScore,basePoints as previousBase} from './previous-scoring';
export const SCORE_VERSION=3;
export const SCORING_START='2026-11-04';
export function scoringVersion(day:string){return day<SCORING_START?2:SCORE_VERSION;}
export function basePoints(q:{min:number;max:number},low:number,high:number,version=3){
 if(version===2)return previousBase(q,low,high);
 if(!Number.isFinite(low)||!Number.isFinite(high)||q.max<=q.min||low>high||low<q.min||high>q.max)return 0;
 const width=(high-low)/(q.max-q.min);
 return Math.round(200*(1-width)**2);
}
export function scoreBreakdown(q:{min:number;max:number;answer:number},low:number,high:number,version=3){
 if(version===2)return previousScore(q,low,high);
 const valid=Number.isFinite(low)&&Number.isFinite(high)&&q.max>q.min&&low>=q.min&&high<=q.max&&low<=high;
 const hit=valid&&low<=q.answer&&high>=q.answer;
 const base=hit?basePoints(q,low,high):0;
 return {base,bonus:0,total:base,hit};
}
export function points(q:{min:number;max:number;answer:number},low:number,high:number,version=3){return scoreBreakdown(q,low,high,version).total;}
export function missDistance(a:{low:number;high:number;answer:number}){return Math.max(a.low-a.answer,a.answer-a.high,0);}
