import { gameState,identity,json } from '../../../lib/server';
import { today } from '../../../lib/game';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const {player,cookie}=await identity(req);return json(await gameState(today(),player),200,cookie);}catch{return json({error:'service_unavailable'},503);}}
