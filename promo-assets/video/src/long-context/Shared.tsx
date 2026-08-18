import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';

export const colors = {
  bg: '#080b0e', panel: '#11171c', panel2: '#182028', white: '#f5f7f8', muted: '#8b99a5', line: '#29343d',
  green: '#38d39f', yellow: '#ffd052', blue: '#78a0ff', red: '#ff6f61', purple: '#bd8cff', cyan: '#52cbe0',
};
export const sans = 'Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif';
export const mono = 'Cascadia Mono, Consolas, monospace';

export type Cue = {start:number; end:number; text:string; chapter:string; company:string; visual:string};
export type SceneProps = {cue:Cue; progress:number};

export const clamp = (value:number) => Math.max(0, Math.min(1, value));
export const ease = (value:number) => Easing.bezier(0.16, 1, 0.3, 1)(clamp(value));

export const Base:React.FC<{cue:Cue; accent:string; children:React.ReactNode}> = ({cue, accent, children}) => {
  const frame = useCurrentFrame();
  const durationInFrames = Math.max(1,Math.ceil((cue.end-cue.start+.12)*30));
  return <AbsoluteFill style={{background:colors.bg, color:colors.white, overflow:'hidden', fontFamily:sans}}>
    <AbsoluteFill style={{backgroundImage:`linear-gradient(${colors.line}45 1px,transparent 1px),linear-gradient(90deg,${colors.line}45 1px,transparent 1px)`, backgroundSize:'48px 48px'}}/>
    <div style={{position:'absolute',left:64,top:45,fontFamily:mono,fontSize:17,color:accent,fontWeight:800}}>{cue.chapter.toUpperCase()}</div>
    <div style={{position:'absolute',right:64,top:45,fontFamily:mono,fontSize:16,color:colors.muted}}>{cue.company}</div>
    <div style={{position:'absolute',left:64,right:64,top:92,height:2,background:colors.line}}><div style={{height:'100%',width:`${interpolate(frame,[0,durationInFrames],[0,100],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}%`,background:accent}}/></div>
    {children}
    <div style={{position:'absolute',left:110,right:110,bottom:45,textAlign:'center'}}>
      <span style={{display:'inline-block',maxWidth:1540,padding:'12px 24px 14px',background:'rgba(3,5,7,.9)',fontSize:42,lineHeight:1.3,fontWeight:900}}>{cue.text}</span>
    </div>
  </AbsoluteFill>;
};

export const BigText:React.FC<{children:React.ReactNode; accent:string; progress:number; size?:number}> = ({children,accent,progress,size=104}) => <div style={{position:'absolute',left:80,right:80,top:145,textAlign:'center',fontSize:size,lineHeight:1.08,fontWeight:950,color:accent,opacity:ease(progress),scale:0.88+ease(progress)*0.12}}>{children}</div>;

export const TokenRow:React.FC<{count:number; active:number; accent:string; top?:number; left?:number; width?:number}> = ({count,active,accent,top=420,left=170,width=1580}) => <div style={{position:'absolute',left,top,width,display:'flex',gap:10}}>{Array.from({length:count}).map((_,i)=><div key={i} style={{height:58,flex:1,background:i<active?accent:colors.panel2,border:`1px solid ${i<active?accent:colors.line}`,opacity:i<active?1:.45}}/>)}</div>;

export const Stat:React.FC<{value:string; label:string; accent:string; x:number}> = ({value,label,accent,x}) => <div style={{position:'absolute',left:x,top:390,width:420,borderTop:`4px solid ${accent}`,paddingTop:22,textAlign:'center'}}><div style={{fontFamily:mono,fontSize:104,fontWeight:900,color:accent}}>{value}</div><div style={{fontSize:28,color:colors.muted}}>{label}</div></div>;
