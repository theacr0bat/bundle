import { dailyQuestions as legacyQuestions, dayIndex, today } from './legacy-game';
import type { Question as LegacyQuestion } from './legacy-game';
import { questionBank } from './previous-question-bank';
export { dayIndex, today };
export { points } from './scoring';
export const ROUND_SIZE = 5;
export const COLLECTION_START = '2026-11-03';
export const CYCLE_DAYS = 15;
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Question = LegacyQuestion & { difficulty?: Difficulty; verifiedAt?: string };
export const categories = ['space','science','history','culture','sport'] as const;
export const collections = categories.map(category => questionBank.filter(q => q.category === category));
const pattern: Difficulty[] = ['easy','easy','medium','medium','hard'];
const rank: Record<Difficulty,number> = {easy:0,medium:1,hard:2};

// Immutable legacy schedule protects started/completed rounds. New collection begins at a UTC boundary.
// Every five days a category receives 2 easy, 2 medium, 1 hard slot; three blocks use all 75 questions.
export function collectionQuestions(dayOffset:number):Question[] {
 const day = ((dayOffset % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS;
 const selected = collections.map((collection,c) => {
  const difficulty=pattern[(day+c)%5];
  const pool=collection.filter(q=>q.difficulty===difficulty);
  let occurrence=0;
  for(let previous=0;previous<day;previous++)if(pattern[(previous+c)%5]===difficulty)occurrence++;
  return {...pool[occurrence]};
 });
 return selected.sort((a,b)=>rank[a.difficulty!]-rank[b.difficulty!]);
}
export function dailyQuestions(day:string):Question[]{
 if(day<COLLECTION_START)return legacyQuestions(day);
 const offset=Math.floor((Date.parse(day+'T00:00:00Z')-Date.parse(COLLECTION_START+'T00:00:00Z'))/86400000);
 return collectionQuestions(offset);
}
export function publicQuestion({answer,source,noteTr,noteEn,verifiedAt,...rest}:Question){return rest;}
