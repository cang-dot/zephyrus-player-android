import React from 'react';
import {Audio} from '@remotion/media';
import {AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import timingData from './longContextTimings.json';
import {DeepSeekScenes, MemAgentScenes} from './long-context/DeepSeekMemAgentScenes';
import {KimiScenes, MiniMaxScenes} from './long-context/MiniMaxKimiScenes';
import {OpeningScenes, QwenScenes} from './long-context/OpeningQwenScenes';
import {Base, colors, Cue} from './long-context/Shared';
import {SummaryScenes, WriterScenes} from './long-context/WriterSummaryScenes';

const FPS = 30;
const cues = timingData.cues as Cue[];
export const LONG_CONTEXT_FRAMES = Math.ceil((timingData.duration + 1.5) * FPS);

const accentFor = (chapter:string) => ({
  开场: colors.green,
  Qwen: colors.green,
  MiniMax: colors.yellow,
  Kimi: colors.blue,
  DeepSeek: colors.red,
  MemAgent: colors.purple,
  LongWriter: colors.cyan,
  总结: colors.white,
}[chapter] ?? colors.white);

const Visual:React.FC<{cue:Cue; duration:number}> = ({cue,duration}) => {
  const frame = useCurrentFrame();
  const progress = Math.max(0,Math.min(1,frame/Math.max(1,duration-1)));
  const props = {cue,progress};
  const scene = cue.chapter==='开场' ? <OpeningScenes {...props}/>
    : cue.chapter==='Qwen' ? <QwenScenes {...props}/>
    : cue.chapter==='MiniMax' ? <MiniMaxScenes {...props}/>
    : cue.chapter==='Kimi' ? <KimiScenes {...props}/>
    : cue.chapter==='DeepSeek' ? <DeepSeekScenes {...props}/>
    : cue.chapter==='MemAgent' ? <MemAgentScenes {...props}/>
    : cue.chapter==='LongWriter' ? <WriterScenes {...props}/>
    : <SummaryScenes {...props}/>;
  return <Base cue={cue} accent={accentFor(cue.chapter)}>{scene}</Base>;
};

export const LongContextExplainer:React.FC = () => {
  const {durationInFrames} = useVideoConfig();
  return <AbsoluteFill style={{background:colors.bg}}>
    <Audio src={staticFile('audio/deadman-instrumental.mp3')} trimBefore={12*FPS} volume={(frame)=>interpolate(frame,[0,1.5*FPS,durationInFrames-2*FPS,durationInFrames],[0,.075,.075,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}/>
    <Audio src={staticFile('audio/long-context-voice.wav')} volume={1}/>
    {cues.map((cue,index)=>{
      const from=Math.floor(cue.start*FPS);
      const duration=Math.max(1,Math.ceil((cue.end-cue.start+.12)*FPS));
      const chapterChanged=index===0||cues[index-1].chapter!==cue.chapter;
      return <React.Fragment key={`${cue.visual}-${index}`}>
        <Sequence from={from} durationInFrames={duration}><Visual cue={cue} duration={duration}/></Sequence>
        {chapterChanged&&index>0?<Sequence from={from} durationInFrames={20}><Audio src={staticFile('audio/transition-soft.mp3')} volume={.16}/></Sequence>:null}
      </React.Fragment>;
    })}
  </AbsoluteFill>;
};
