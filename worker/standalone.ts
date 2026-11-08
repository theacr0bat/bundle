import handler from 'vinext/server/fetch-handler';

// Direct hosting has no Sites dispatch layer. Never accept its identity headers.
export default {
 fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  if((env as unknown as {AUTH_MODE?:string}).AUTH_MODE!=='cloudflare-access')
   return new Response('Yayın yapılandırması tamamlanmadı.',{status:503});
  const headers=new Headers(request.headers);
  for(const name of [...headers.keys()])if(name.toLowerCase().startsWith('oai-'))headers.delete(name);
  return handler.fetch(new Request(request,{headers}),env,ctx);
 }
};
