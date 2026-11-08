'use client';
import { useEffect,useRef,useState } from 'react';
export default function AnswerSweep({min,max,answer,hit,onComplete}:{min:number;max:number;answer:number;hit:boolean;onComplete:()=>void}){
 const [progress,setProgress]=useState(0);const callback=useRef(onComplete);callback.current=onComplete;
 useEffect(()=>{let frame=0;let start:number|null=null;const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?100:2200;
 function tick(now:number){if(start===null)start=now;const x=Math.min(1,(now-start)/duration);setProgress(1-Math.pow(1-x,2));if(x<1)frame=requestAnimationFrame(tick);else callback.current();}
 frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[answer,min,max]);
 const point=100*(answer-min)/(max-min);const left=point*progress,right=100-(100-point)*progress;
 return <div className={`answer-sweep ${progress===1?'arrived':''} ${hit?'hit':'miss'}`} aria-hidden="true"><div className="sweep-fill" style={{left:`${left}%`,width:`${right-left}%`}}/><span className="sweep-edge left" style={{left:`${left}%`}}/><span className="sweep-edge right" style={{left:`${right}%`}}/>{progress===1&&<span className="arrival-ring" style={{left:`${point}%`}}/>}</div>;
}
