import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
const title='Boundle — How sure are you?';
const description='Five questions a day. Pick your range and see how sure you really are.';
// Önizleme görselinin tam adresi için sitenin gerçek alan adı istekten okunur (alan adı sonradan değişse de çalışır).
export async function generateMetadata():Promise<Metadata>{
 let metadataBase:URL|undefined;
 try{const h=await headers();const host=h.get('x-forwarded-host')||h.get('host');if(host){const local=/^(localhost|127\.|0\.0\.0\.0)/.test(host);metadataBase=new URL(`${h.get('x-forwarded-proto')||(local?'http':'https')}://${host}`);}}catch{}
 return {metadataBase,title,description,icons:{icon:'/favicon.svg'},openGraph:{type:'website',siteName:'Boundle',title,description,images:[{url:'/og.png',width:1200,height:630,alt:'Boundle'}]},twitter:{card:'summary_large_image',title,description,images:['/og.png']}};
}
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap"/></head><body>{children}</body></html>}
