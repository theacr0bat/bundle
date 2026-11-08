// iPhone'da sessiz anahtar Web Audio'yu susturur. İki önlem: Safari'nin ses oturumunu 'playback' yapmak ve
// kullanıcı hareketi içinde sessiz bir <audio> çalmak (ikisi de eski sürümlerde yoksa sessizce atlanır).
const SILENT='data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
function unlockPlayback(){
 try{const s=(navigator as unknown as {audioSession?:{type:string}}).audioSession;if(s)s.type='playback';}catch{}
 try{const a=new Audio(SILENT);a.setAttribute('playsinline','');void a.play().catch(()=>{});}catch{}
}
export function openAudio():AudioContext|null{
 try{const C=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!C)return null;unlockPlayback();return new C();}catch{return null;}
}
// Telefon hoparlörü ~300 Hz altını zayıf verir: tarama 330→990 Hz, ardından 1046/1568 Hz çan notaları.
export async function revealSound(ctx:AudioContext|null,_hit:boolean,duration:number){
 if(!ctx||ctx.state==='closed')return false;
 try{await ctx.resume();if(ctx.state!=='running')return false;
  const t=ctx.currentTime+.025;const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';
  const curve=Float32Array.from({length:80},(_,i)=>{const p=1-Math.pow(1-i/79,2);return 330*Math.pow(3,p);});
  const sweep=.17;oscillator.frequency.setValueCurveAtTime(curve,t,duration);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(sweep,t+.04);gain.gain.setValueAtTime(sweep,t+duration-.045);gain.gain.linearRampToValueAtTime(0,t+duration);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(t);oscillator.stop(t+duration);
  for(const [offset,freq] of [[0,1046.5],[.14,1567.98]])for(const [multiple,level] of [[1,.22],[2.76,.04]]){
   const o=ctx.createOscillator(),g=ctx.createGain(),start=t+duration+offset;o.type='sine';o.frequency.value=freq*multiple;g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(level,start+.008);g.gain.exponentialRampToValueAtTime(.0001,start+.55);o.connect(g);g.connect(ctx.destination);o.start(start);o.stop(start+.6);
  }return true;
 }catch{return false;}
}
