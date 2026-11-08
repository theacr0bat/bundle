import {liveRound} from '../../../lib/content';
import {getRun,identity,json} from '../../../lib/server';
import {dailyQuestions,today} from '../../../lib/game';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const {player,cookie}=await identity(req);const run=await getRun(today(),player);if(!run?.completed)return json({error:'finish_daily_first'},403,cookie);return json(await liveRound(today()),200,cookie);}catch{return json({error:'service_unavailable'},503);}}
