import {env} from 'cloudflare:workers';
import {json} from '../../../lib/server';
export const dynamic='force-dynamic';
export function GET(){const independent=(env as unknown as {AUTH_MODE?:string}).AUTH_MODE==='cloudflare-access';return json(independent?{independent:true,login:'/admin'}:{independent:false,login:'/signin-with-chatgpt?return_to=%2Fadmin'});}
