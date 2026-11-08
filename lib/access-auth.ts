import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';

export type AccessSettings={AUTH_MODE?:string;ACCESS_TEAM_DOMAIN?:string;ACCESS_AUD?:string;ADMIN_OWNER_EMAIL?:string};
export class AccessError extends Error {
 status:number;
 constructor(message:string,status:number){super(message);this.status=status;}
}
const keySets=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
export function accessConfig(settings:AccessSettings){
 const issuer=settings.ACCESS_TEAM_DOMAIN||'',audience=settings.ACCESS_AUD||'';
 if(!/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(issuer)||!audience||!settings.ADMIN_OWNER_EMAIL)
  throw new AccessError('Yönetici girişi henüz yapılandırılmadı.',503);
 return {issuer,audience};
}
// A decoded JWT or an email header is never an identity. Verify the signature,
// application audience, team issuer and expiration before reading any claims.
export async function accessIdentity(req:Request,settings:AccessSettings,testKey?:JWTVerifyGetKey){
 const {issuer,audience}=accessConfig(settings);
 const token=req.headers.get('cf-access-jwt-assertion');
 if(!token)throw new AccessError('Yönetici hesabınla güvenli giriş yapmalısın.',401);
 if(token.length>16384)throw new AccessError('Yönetici oturumu geçersiz.',401);
 let remote=keySets.get(issuer);
 if(!testKey&&!remote){remote=createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'),{timeoutDuration:5000});keySets.set(issuer,remote);}
 const keys=testKey||remote!;
 try{
  const {payload}=await jwtVerify(token,keys,{issuer,audience,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email'],clockTolerance:5});
  if(payload.type!=='app'||typeof payload.sub!=='string'||!payload.sub||typeof payload.email!=='string'||!payload.email)
   throw new Error('Invalid application identity');
  return {id:payload.sub,email:payload.email.trim().toLowerCase()};
 }catch{throw new AccessError('Yönetici oturumu geçersiz veya süresi dolmuş.',401);}
}
