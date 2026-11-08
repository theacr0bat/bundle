import {ValidationError} from '../../../lib/admin-model';
import {requireOwner,questionRows,overview,calendar,mutate,AdminError,exportCsv,rangeSamples} from '../../../lib/admin-server';
import {json} from '../../../lib/server';
import {today} from '../../../lib/game';
export const dynamic='force-dynamic';
function failure(e:unknown){if(e instanceof ValidationError)return json({error:e.message},400);if(e instanceof AdminError)return json({error:e.message},e.status);const message=e instanceof Error?e.message:'';if(message.includes('UNIQUE constraint'))return json({error:'Bu soru zaten havuzda var. Mevcut soruyu düzenleyebilirsin; toplu yükleme kaydedilmedi.'},409);console.error('Admin operation failed',message);return json({error:'İşlem tamamlanamadı. Bağlantını kontrol edip yeniden dene.'},503);}
export async function GET(req:Request){try{await requireOwner(req);const url=new URL(req.url),view=url.searchParams.get('view')||'overview';
 if(view==='access')return json({owner:true});
 if(view==='questions')return json({items:await questionRows(),today:today()});
 if(view==='calendar')return json(await calendar(url.searchParams.get('day')||today()));
 if(view==='ranges')return json(await rangeSamples(url));
 if(view==='export')return new Response(await exportCsv(url),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="aralik-${url.searchParams.get('kind')==='questions'?'sorular':'sonuclar'}.csv"`,'Cache-Control':'no-store, private','Vary':'Cookie'}});
 return json(await overview(url));
 }catch(e){return failure(e);}}
export async function POST(req:Request){try{const actor=await requireOwner(req,true);const text=await req.text();if(text.length>500000)return json({error:'İstek 500 KB sınırını aşıyor.'},413);let body;try{body=JSON.parse(text);}catch{return json({error:'İstek biçimi geçersiz.'},400);}if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'İstek biçimi geçersiz.'},400);return json(await mutate(body,actor));}catch(e){return failure(e);}}
