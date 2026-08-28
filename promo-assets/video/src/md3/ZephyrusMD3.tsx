// Zephyrus MD3 宣传片 · 主 Composition（1650f ≈ 55s）
// SFX/BGM 由 SfxTrack（bgm inputProp 解耦）挂载
import React from 'react';
import { AbsoluteFill, continueRender,delayRender, Sequence, staticFile } from 'remotion';

import { S0Morph } from './S0Morph';
import { S1Ripple } from './S1Ripple';
import { S2Thumb } from './S2Thumb';
import { S3Lyrics } from './S3Lyrics';
import { S4IconField } from './S4IconField';
import { S5StyleCycle } from './S5StyleCycle';
import { S6Spectrum } from './S6Spectrum';
import { S7Poster } from './S7Poster';
import { SfxTrack } from './SfxTrack';
import { C,SHOTS, TOTAL_FRAMES } from './tokens';

const waitForFont = delayRender();
const fontCss = document.createElement('style');
fontCss.textContent = `@font-face{font-family:'NotoSC';src:url('${staticFile(
  'fonts/NotoSansSC-VF.ttf'
)}') format('truetype-variations');font-weight:100 900;}`;
document.head.appendChild(fontCss);
Promise.all([
  document.fonts.load('900 100px NotoSC'),
  document.fonts.load('700 40px NotoSC'),
  document.fonts.load('500 34px NotoSC')
])
  .then(() => continueRender(waitForFont))
  .catch(() => continueRender(waitForFont));

export const ZephyrusMD3: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: "'NotoSC','Microsoft YaHei',sans-serif" }}>
      <Sequence from={SHOTS.s0Morph.from} durationInFrames={SHOTS.s0Morph.dur}>
        <S0Morph />
      </Sequence>
      <Sequence from={SHOTS.s1Ripple.from} durationInFrames={SHOTS.s1Ripple.dur}>
        <S1Ripple />
      </Sequence>
      <Sequence from={SHOTS.s2Thumb.from} durationInFrames={SHOTS.s2Thumb.dur}>
        <S2Thumb />
      </Sequence>
      <Sequence from={SHOTS.s3Lyrics.from} durationInFrames={SHOTS.s3Lyrics.dur}>
        <S3Lyrics />
      </Sequence>
      <Sequence from={SHOTS.s4IconField.from} durationInFrames={SHOTS.s4IconField.dur}>
        <S4IconField />
      </Sequence>
      <Sequence from={SHOTS.s5StyleCycle.from} durationInFrames={SHOTS.s5StyleCycle.dur}>
        <S5StyleCycle />
      </Sequence>
      <Sequence from={SHOTS.s6Spectrum.from} durationInFrames={SHOTS.s6Spectrum.dur}>
        <S6Spectrum />
      </Sequence>
      <Sequence from={SHOTS.s7Poster.from} durationInFrames={SHOTS.s7Poster.dur}>
        <S7Poster />
      </Sequence>
      <SfxTrack bgm={bgm} />
    </AbsoluteFill>
  );
};
