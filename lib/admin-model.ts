import type {Question} from './game';
export class ValidationError extends Error{}
export type QuestionStatus='draft'|'ready'|'archived';
export type ManagedQuestion={question:Question;status:QuestionStatus;revision:number;updatedAt:string};
export const categoryOptions={space:'Uzay',science:'Doğa & Bilim',history:'Dünya & Tarih',culture:'Kültür & Oyun',sport:'Spor'};
export const difficultyOptions={easy:'Kolay',medium:'Orta',hard:'Zor'};
export const csvFields=['tr','en','answer','min','max','unitTr','unitEn','category','difficulty','noteTr','noteEn','source'] as const;
export function fingerprint(tr:string){return tr.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('tr-TR');}
export function validateQuestion(input:unknown):Question{
 const x=input as Record<string,unknown>;if(!x||typeof x!=='object')throw new ValidationError('Soru bilgileri eksik.');
 const str=(key:string,max:number,required=true)=>{const value=typeof x[key]==='string'?(x[key] as string).trim():'';if((required&&!value)||value.length>max)throw new ValidationError(`${key}: ${required?'doldurulmalı ve ':''}${max} karakteri aşmamalı.`);return value;};
 const tr=str('tr',350),en=str('en',350,false)||tr,unitTr=str('unitTr',40),unitEn=str('unitEn',40,false)||unitTr,noteTr=str('noteTr',700),noteEn=str('noteEn',700,false)||noteTr;
 const id=str('id',80),category=str('category',20),difficulty=str('difficulty',10),source=str('source',1000,false);
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw new ValidationError('Soru kimliği geçersiz.');
 if(!Object.hasOwn(categoryOptions,category)||!Object.hasOwn(difficultyOptions,difficulty))throw new ValidationError('Kategori ve zorluk seçilmeli.');
 if(source){let u:URL;try{u=new URL(source);}catch{throw new ValidationError('Kaynak geçerli bir https bağlantısı olmalı.');}if(u.protocol!=='https:')throw new ValidationError('Kaynak https ile başlamalı.');}
 const {min,max,answer}=x;if(![min,max,answer].every(v=>typeof v==='number'&&Number.isSafeInteger(v)&&Math.abs(v)<=1e12))throw new ValidationError('Sınırlar ve cevap, en fazla 1 trilyon büyüklüğünde tam sayı olmalı.');
 if(!((min as number)<(answer as number)&&(answer as number)<(max as number)))throw new ValidationError('Doğru cevap, alt ve üst çubuk sınırlarının içinde olmalı.');
 return {id,category,difficulty:difficulty as Question['difficulty'],tr,en,unitTr,unitEn,min:min as number,max:max as number,answer:answer as number,source,noteTr,noteEn};
}
export function validateRound(qs:Question[]){if(qs.length!==5||new Set(qs.map(q=>q.id)).size!==5)throw new ValidationError('Beş farklı soru seçmelisin.');if(new Set(qs.map(q=>q.category)).size!==5)throw new ValidationError('Her kategoriden bir soru seçmelisin.');if(['easy','medium','hard'].map(d=>qs.filter(q=>q.difficulty===d).length).join(',')!=='2,2,1')throw new ValidationError('Tur 2 kolay, 2 orta ve 1 zor soru içermeli.');}
export function validDay(day:string){return /^\d{4}-\d{2}-\d{2}$/.test(day)&&!Number.isNaN(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;}
export function canManage(identity:{id:string|null;email:string|null},ownerId:string|null,ownerEmail:string){return !!identity.id&&(ownerId?identity.id===ownerId:!!ownerEmail&&identity.email?.trim().toLowerCase()===ownerEmail.trim().toLowerCase());}
// RFC-style quoting, BOM, CRLF, embedded newlines and comma/semicolon delimiters.
export function parseCsv(text:string):Record<string,string>[] {
 if(text.length>500000)throw new ValidationError('CSV en fazla 500 KB olabilir.');
 text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/,1)[0];let inQuote=false,commas=0,semis=0;
 for(let i=0;i<first.length;i++){if(first[i]==='"'){if(inQuote&&first[i+1]==='"')i++;else inQuote=!inQuote;}else if(!inQuote){if(first[i]===',')commas++;if(first[i]===';')semis++;}}
 const delimiter=semis>commas?';':',';const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 const cell=()=>{row.push(field);field='';closed=false;};const line=()=>{cell();if(row.some(v=>v.trim()))rows.push(row);row=[];};
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
 if(c==='"'){if(field||closed)throw new ValidationError('CSV tırnak yapısı hatalı.');quoted=true;}
 else if(c===delimiter)cell();else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;line();}
 else{if(closed&&c.trim())throw new ValidationError('CSV kapanan tırnaktan sonra beklenmeyen metin içeriyor.');if(!closed)field+=c;}}
 if(quoted)throw new ValidationError('CSV içinde kapanmamış tırnak var.');if(field||row.length)line();
 if(rows.length<2)throw new ValidationError('CSV en az bir soru içermeli.');if(rows.length>101)throw new ValidationError('Bir seferde en fazla 100 soru yükleyebilirsin.');
 const headers=rows.shift()!.map(v=>v.trim());if(new Set(headers).size!==headers.length)throw new ValidationError('Tekrarlayan CSV sütunu var.');
 for(const name of ['tr','answer','min','max','unitTr','category','difficulty','noteTr'])if(!headers.includes(name))throw new ValidationError(`CSV sütunu eksik: ${name}`);
 return rows.map((r,i)=>{if(r.length!==headers.length)throw new ValidationError(`CSV ${i+2}. satırında sütun sayısı hatalı.`);return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));});
}
export function csvQuestions(text:string){return parseCsv(text).map((r,i)=>{try{for(const key of ['answer','min','max'])if(!/^-?\d+$/.test(r[key].trim()))throw new ValidationError(`${key} tam sayı olmalı; binlik ayırıcı kullanma.`);return validateQuestion({...r,id:newQuestionId(),answer:Number(r.answer),min:Number(r.min),max:Number(r.max)});}catch(e){throw new ValidationError(`Satır ${i+2}: ${(e as Error).message}`);}});}
export function csvCell(value:unknown){let s=String(value??'');if(typeof value==='string'&&/^[=+@\t\r-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function makeCsv(rows:Record<string,unknown>[],fields:readonly string[]){return '\uFEFF'+[fields.map(csvCell).join(';'),...rows.map(r=>fields.map(f=>csvCell(r[f])).join(';'))].join('\r\n');}
export function selectAutomatic(pool:Question[],day:string,used:Map<string,string>){
 const offset=Math.floor(Date.parse(day+'T00:00:00Z')/86400000),pattern=['easy','easy','medium','medium','hard'];
 const hash=(s:string)=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
 const chosen=Object.keys(categoryOptions).map((category,i)=>{
  const difficulty=pattern[(offset+i)%5];const candidates=pool.filter(q=>q.category===category&&q.difficulty===difficulty);
  candidates.sort((a,b)=>(used.get(a.id)||'').localeCompare(used.get(b.id)||'')||hash(day+a.id)-hash(day+b.id)||a.id.localeCompare(b.id));
  if(!candidates.length)throw new ValidationError(`${categoryOptions[category as keyof typeof categoryOptions]} / ${difficultyOptions[difficulty as keyof typeof difficultyOptions]} için yayına hazır soru yok. Havuzdan hazır soru ekle veya takvimde elle beş soru seç.`);
  return candidates[0];
 });
 return chosen.sort((a,b)=>['easy','medium','hard'].indexOf(a.difficulty!)-['easy','medium','hard'].indexOf(b.difficulty!));
}
export function newQuestionId(){const bytes=crypto.getRandomValues(new Uint8Array(16));return 'q-'+Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');}
