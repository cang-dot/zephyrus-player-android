import React from 'react';
import { Audio } from '@remotion/media';
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export type MainProps = { bgm?: boolean };

export const FPS = 30;
export const TOTAL_FRAMES = 3758;

const C = {
  ink: '#171512',
  paper: '#e8e1d3',
  red: '#e63124',
  acid: '#ecff49',
  white: '#f7f4ec',
  grey: '#8d8981',
  blue: '#9fc3db',
};

const DISPLAY = 'STKaiti, KaiTi, FangSong, serif';
const SANS = 'Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif';

const SHOTS = {
  opening: { from: 0, duration: 338 },
  styles: { from: 338, duration: 562 },
  lyrics: { from: 900, duration: 695 },
  voices: { from: 1595, duration: 348 },
  search: { from: 1943, duration: 690 },
  local: { from: 2633, duration: 284 },
  status: { from: 2917, duration: 377 },
  ending: { from: 3294, duration: 464 },
} as const;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const p = (frame: number, start: number, end: number) => clamp((frame - start) / Math.max(1, end - start));
const out = (value: number) => 1 - Math.pow(1 - clamp(value), 3);
const inOut = (value: number) => value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;

const PaperGrain: React.FC<{ opacity?: number; light?: boolean }> = ({ opacity = 0.14, light = false }) => (
  <AbsoluteFill
    style={{
      opacity,
      backgroundImage: light
        ? 'radial-gradient(rgba(30,25,17,.34) .7px, transparent .7px)'
        : 'radial-gradient(rgba(255,255,255,.18) .7px, transparent .7px)',
      backgroundSize: '7px 7px',
      mixBlendMode: light ? 'multiply' : 'screen',
      pointerEvents: 'none',
    }}
  />
);

const CornerMark: React.FC<{ dark?: boolean }> = ({ dark = false }) => (
  <div style={{ position: 'absolute', left: 74, top: 58, zIndex: 20, color: dark ? C.ink : C.white, fontFamily: SANS, fontSize: 19, fontWeight: 800, letterSpacing: 1 }}>
    ZEPHYRUS / PLAYER
  </div>
);

const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const imageIn = out(p(frame, 48, 64));
  const imageScale = interpolate(frame, [64, 160], [1.05, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const strike = out(p(frame, 162, 214));
  const title = out(p(frame, 210, 258));
  return (
    <AbsoluteFill style={{ background: C.red, color: C.white, overflow: 'hidden' }}>
      <PaperGrain opacity={0.22} />
      <CornerMark />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.9 * imageIn, scale: imageScale }}>
        <Img src={staticFile('screenshots/festival.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(28,10,8,.32)' }} />
      <div style={{ position: 'absolute', left: 78, top: 180, width: 780, opacity: 1 - imageIn }}>
        <div style={{ fontFamily: SANS, fontSize: 26, fontWeight: 800 }}>工具推荐 / 01</div>
        <div style={{ marginTop: 26, fontFamily: DISPLAY, fontSize: 166, lineHeight: .93, fontWeight: 900 }}>音乐节<br />舞美</div>
      </div>
      <div style={{ position: 'absolute', left: 74, right: 74, bottom: 158, height: 8, background: C.white, transformOrigin: 'left', scale: `${strike} 1` }} />
      <div style={{ position: 'absolute', left: 78, bottom: 180, opacity: title, fontFamily: SANS }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: C.acid }}>把它缩进安卓手机</div>
        <div style={{ marginTop: 10, fontSize: 84, fontWeight: 900, letterSpacing: -2 }}>Zephyrus Player</div>
      </div>
    </AbsoluteFill>
  );
};

const styles = [
  { name: '默认', file: 'default.jpg', color: '#b9d4cb' },
  { name: '舞台', file: 'stage.jpg', color: '#8099b3' },
  { name: '星盘', file: 'star-chart.jpg', color: '#d7e66a' },
  { name: '狂热', file: 'frenzy.jpg', color: '#ede5d3' },
  { name: '诡谲', file: 'eerie.jpg', color: '#9fa9e2' },
  { name: '陈旧', file: 'aged.jpg', color: '#a6b8a9' },
  { name: '雨夜', file: 'rain.jpg', color: '#a5d5ee' },
  { name: '烟雾', file: 'smoke.jpg', color: '#ff3c30' },
] as const;

const StyleArchive: React.FC = () => {
  const frame = useCurrentFrame();
  const index = Math.min(styles.length - 1, Math.floor(Math.max(0, frame - 18) / 53));
  const item = styles[index];
  const local = (frame - 18) % 53;
  const enter = out(p(local, 0, 8));
  const pan = interpolate(local, [0, 53], [1.08, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const listShift = interpolate(frame, [16, 438], [0, -360], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: C.paper, color: C.ink, overflow: 'hidden' }}>
      <PaperGrain light opacity={0.3} />
      <CornerMark dark />
      <div style={{ position: 'absolute', left: 74, top: 126, width: 400, zIndex: 10 }}>
        <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 800, color: C.red }}>播放器样式档案 / 02</div>
        <div style={{ marginTop: 14, fontFamily: DISPLAY, fontSize: 76, lineHeight: .95, fontWeight: 900 }}>九种样式，<br />八张实机截图。</div>
        <div style={{ marginTop: 30, width: 280, height: 3, background: C.ink }} />
        <div style={{ marginTop: 25, fontFamily: SANS, fontSize: 18, lineHeight: 1.6 }}>每种样式都换掉了<br />歌词排版、字体和动效。</div>
      </div>
      <div style={{ position: 'absolute', left: 520, right: 0, top: 0, bottom: 0, overflow: 'hidden', background: '#171615' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .24, background: item.color }} />
        <div style={{ position: 'absolute', left: 90, top: 116, width: 1240, height: 555, overflow: 'hidden', border: `1px solid ${item.color}`, boxShadow: '0 30px 80px rgba(0,0,0,.35)', opacity: enter, scale: pan }}>
          <Img src={staticFile(`screenshots/styles/${item.file}`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ position: 'absolute', left: 94, bottom: 122, color: item.color, fontFamily: DISPLAY, fontSize: 104, fontWeight: 900 }}>{item.name}</div>
        <div style={{ position: 'absolute', right: 100, bottom: 138, fontFamily: SANS, fontSize: 18, fontWeight: 800, color: C.white }}>REAL UI / {String(index + 1).padStart(2, '0')} — 08</div>
        <div style={{ position: 'absolute', left: 94, right: 94, bottom: 92, height: 3, background: 'rgba(255,255,255,.35)' }}><div style={{ width: `${((index + 1) / styles.length) * 100}%`, height: '100%', background: item.color }} /></div>
        <div style={{ position: 'absolute', left: 94, bottom: 42, display: 'flex', gap: 18, transform: `translateX(${listShift}px)` }}>
          {styles.map((screen, i) => <div key={screen.file} style={{ minWidth: 110, color: i === index ? item.color : 'rgba(255,255,255,.5)', fontFamily: SANS, fontSize: 16, fontWeight: 800 }}>{screen.name}</div>)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FeaturePoster: React.FC<{ kind: 'lyrics' | 'voices' | 'search' | 'local' | 'status'; title: React.ReactNode; kicker: string; children: React.ReactNode; color?: string }> = ({ kind, title, kicker, children, color = C.red }) => {
  const frame = useCurrentFrame();
  const sceneIn = out(p(frame, 0, 22));
  return (
    <AbsoluteFill style={{ background: C.ink, color: C.paper, overflow: 'hidden' }}>
      <PaperGrain opacity={0.18} />
      <CornerMark />
      <div style={{ position: 'absolute', left: 76, top: 142, width: 520, zIndex: 4, opacity: sceneIn }}>
        <div style={{ color, fontFamily: SANS, fontSize: 20, fontWeight: 900 }}>FEATURE / {kind.toUpperCase()}</div>
        <div style={{ marginTop: 24, fontFamily: DISPLAY, fontSize: 108, lineHeight: .9, fontWeight: 900 }}>{title}</div>
        <div style={{ marginTop: 28, fontFamily: SANS, fontSize: 21, color: '#d1c9bb', lineHeight: 1.5 }}>{kicker}</div>
      </div>
      {children}
    </AbsoluteFill>
  );
};

const LyricsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const fill = out(p(frame, 48, 210));
  return <FeaturePoster kind="lyrics" title={<>逐字<br /><span style={{ color: C.acid }}>歌词</span></>} kicker="按 TTML、YRC、QRC、LRC 的顺序查找。逐字数据跟着进度变化，普通 LRC 也能整句滚动。" color={C.acid}>
    <div style={{ position: 'absolute', left: 730, right: 80, top: 148, bottom: 150, border: `2px solid ${C.paper}`, padding: 46, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#22201b' }}>
      <div style={{ display: 'flex', gap: 12, fontFamily: SANS, fontSize: 18, fontWeight: 900 }}>{['TTML', 'YRC', 'QRC', 'LRC'].map((v, i) => <React.Fragment key={v}><span style={{ padding: '8px 16px', background: i <= Math.floor(frame / 45) ? C.acid : '#3e3b35', color: C.ink }}>{v}</span>{i < 3 ? <span style={{ color: C.grey, paddingTop: 8 }}>→</span> : null}</React.Fragment>)}</div>
      <div style={{ marginTop: 100, fontFamily: DISPLAY, fontSize: 94, fontWeight: 900, color: C.paper, whiteSpace: 'nowrap' }}>风从<span style={{ color: C.acid }}>人海</span>升起</div>
      <div style={{ marginTop: 28, height: 5, background: '#514d43' }}><div style={{ width: `${fill * 100}%`, height: '100%', background: C.acid }} /></div>
      <div style={{ marginTop: 30, display: 'flex', justifyContent: 'space-between', fontFamily: SANS, color: C.grey, fontSize: 17 }}><span>逐字同步</span><span>普通 LRC / 整句滚动</span></div>
    </div>
  </FeaturePoster>;
};

const VoicesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = ['主歌词', '背景声部', '对唱', '翻译 / 罗马音'];
  return <FeaturePoster kind="voices" title={<>不止<br /><span style={{ color: C.blue }}>一层</span></>} kicker="背景声部、对唱、翻译和罗马音可以同时显示，合唱、和声或外语歌更完整。" color={C.blue}>
    <div style={{ position: 'absolute', left: 720, right: 94, top: 142, bottom: 158, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
      {rows.map((row, i) => { const enter = out(p(frame, 30 + i * 16, 66 + i * 16)); return <div key={row} style={{ opacity: enter, translate: `${(1 - enter) * 90}px 0`, borderTop: `1px solid ${i === 0 ? C.paper : '#4b4942'}`, paddingTop: 20, paddingBottom: 10 }}><div style={{ color: i === 0 ? C.acid : i === 1 ? C.blue : C.grey, fontFamily: SANS, fontSize: 17, fontWeight: 900 }}>{row}</div><div style={{ marginTop: 8, fontFamily: i === 0 ? DISPLAY : SANS, fontSize: i === 0 ? 68 : 32, fontWeight: 800 }}>{['风从人海升起', '和声渐入 · 背景声部', '另一边回应 · 对唱', 'Across the lights · across'][i]}</div></div>; })}
    </div>
  </FeaturePoster>;
};

const SearchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const typed = Math.floor(p(frame, 36, 92) * 4);
  const query = '风起现场'.slice(0, typed);
  const warning = p(frame, 230, 252) * (1 - p(frame, 314, 330));
  return <FeaturePoster kind="search" title={<>一个<br /><span style={{ color: C.red }}>列表</span></>} kicker="多个平台的搜索结果放进同一个列表，还能按来源筛选。能不能播放，仍然取决于账号、接口和网络。" color={C.red}>
    <div style={{ position: 'absolute', left: 720, right: 92, top: 146, bottom: 170, background: C.paper, color: C.ink, padding: 34, transform: `rotate(${interpolate(frame, [0, 70], [2, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}deg)` }}>
      <div style={{ height: 70, borderBottom: `3px solid ${C.ink}`, display: 'flex', alignItems: 'center', gap: 18, fontFamily: SANS, fontSize: 30, fontWeight: 900 }}>{query}<span style={{ color: C.red }}>_</span></div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20, fontFamily: SANS, fontSize: 16, fontWeight: 900 }}>{['全部', '网易云', 'QQ', '酷狗'].map((x, i) => <div key={x} style={{ padding: '8px 14px', background: i === 0 ? C.red : '#d4cabb', color: i === 0 ? C.white : C.ink }}>{x}</div>)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 24 }}>{Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: 92, border: `1px solid ${C.ink}`, padding: 14, display: 'grid', gridTemplateColumns: '48px 1fr', gap: 12, alignItems: 'center', opacity: out(p(frame, 92 + i * 12, 120 + i * 12)), translate: `0 ${(1 - out(p(frame, 92 + i * 12, 120 + i * 12))) * 35}px` }}><div style={{ width: 44, height: 44, background: [C.red, C.blue, C.ink][i % 3] }} /><div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 900 }}>搜索结果 {String(i + 1).padStart(2, '0')}<br /><span style={{ fontSize: 13, color: C.grey }}>{['网易云', 'QQ', '酷狗'][i % 3]}</span></div></div>)}</div>
      {warning > 0 ? <div style={{ position: 'absolute', left: 160, right: 160, top: 230, padding: 26, background: C.red, color: C.white, fontFamily: SANS, fontSize: 25, fontWeight: 900, textAlign: 'center', opacity: warning }}>先别急着高兴：账号 / 接口 / 网络</div> : null}
    </div>
  </FeaturePoster>;
};

const LocalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const formats = ['MP3', 'FLAC', 'M4A', 'OGG', 'Opus'];
  return <FeaturePoster kind="local" title={<>本地<br /><span style={{ color: C.acid }}>曲库</span></>} kicker="扫描本地文件，歌词和封面等元数据一起识别。" color={C.acid}>
    <div style={{ position: 'absolute', left: 720, right: 92, top: 170, bottom: 180, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, alignItems: 'center' }}>{formats.map((format, i) => { const q = out(p(frame, 18 + i * 14, 52 + i * 14)); return <div key={format} style={{ height: 360, border: `2px solid ${i % 2 ? C.paper : C.acid}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 22, opacity: q, translate: `0 ${(1 - q) * 120}px`, rotate: `${(1 - q) * (i % 2 ? 2 : -2)}deg` }}><div style={{ fontFamily: SANS, fontSize: 15, color: C.grey }}>FILE / 0{i + 1}</div><div style={{ fontFamily: SANS, fontSize: 32, fontWeight: 900, writingMode: 'vertical-rl' }}>{format}</div><div style={{ fontFamily: SANS, fontSize: 14, color: C.acid }}>LYRIC + COVER</div></div>; })}</div>
  </FeaturePoster>;
};

const StatusScene: React.FC = () => {
  const frame = useCurrentFrame();
  const drop = out(p(frame, 80, 152));
  return <FeaturePoster kind="status" title={<>切出去<br /><span style={{ color: C.red }}>还在</span></>} kicker="允许悬浮窗权限后，切回桌面或打开别的应用，主歌词仍然留在状态栏。" color={C.red}>
    <div style={{ position: 'absolute', left: 770, right: 150, top: 164, bottom: 170, border: `2px solid ${C.paper}`, background: '#20201d', overflow: 'hidden' }}>
      <div style={{ height: 90, background: '#0d0d0c', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', color: C.grey, fontFamily: SANS, fontSize: 17 }}><span>22:18</span><span>5G · 86%</span></div>
      <div style={{ padding: 54, opacity: 1 - drop }}><div style={{ fontFamily: DISPLAY, fontSize: 72, color: C.acid }}>灯海越过人群</div><div style={{ marginTop: 40, width: 350, height: 4, background: C.grey }} /></div>
      <div style={{ position: 'absolute', left: 60, right: 60, top: 60 + drop * 330, padding: '22px 26px', background: C.red, color: C.white, fontFamily: DISPLAY, fontSize: 57, fontWeight: 900, boxShadow: '0 16px 40px rgba(0,0,0,.45)' }}>灯海越过人群</div>
    </div>
  </FeaturePoster>;
};

const Ending: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = out(p(frame, 80, 150));
  const title = out(p(frame, 150, 210));
  return <AbsoluteFill style={{ background: C.red, color: C.white, overflow: 'hidden' }}>
    <PaperGrain opacity={0.25} />
    <CornerMark />
    <div style={{ position: 'absolute', left: 72, top: 130, width: 1780, height: 600, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, opacity: reveal, scale: `${.94 + reveal * .06}` }}>{styles.filter((_, i) => i % 2 === 0).map((screen) => <div key={screen.file} style={{ overflow: 'hidden', border: `2px solid ${C.white}` }}><Img src={staticFile(`screenshots/styles/${screen.file}`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>)}</div>
    <div style={{ position: 'absolute', left: 80, bottom: 170, opacity: title }}><div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 900, color: C.acid }}>OPEN SOURCE MUSIC PLAYER</div><div style={{ marginTop: 8, fontFamily: SANS, fontSize: 88, fontWeight: 900 }}>Zephyrus Player</div></div>
    <div style={{ position: 'absolute', right: 82, bottom: 192, textAlign: 'right', opacity: title, fontFamily: SANS }}><div style={{ fontSize: 24, fontWeight: 900 }}>Android 8.0+</div><div style={{ marginTop: 10, fontSize: 22, color: C.acid, fontWeight: 900 }}>下载地址放在视频简介</div></div>
  </AbsoluteFill>;
};

const cues = [
  [0.0, 4.96, '这可能是今年最“花里胡哨”的播放器：Zephyrus Player。'],
  [5.48, 10.76, '它可以说把音乐节的整套舞美缩进一台安卓手机上。'],
  [11.28, 14.0, '这是一款开源音乐播放器。'],
  [14.52, 16.6, '它有九种播放器样式。'],
  [17.12, 24.16, '每种样式不只是换一张背景，歌词排版、字体和动效也会跟着变化。'],
  [24.68, 29.48, '背景、歌词颜色、字重和高潮效果还能分别保存。'],
  [30.0, 33.36, '样式做得热闹，歌词数据也没有落下。'],
  [33.88, 42.68, '播放歌曲后，它会按 TTML、YRC、QRC、LRC 的顺序查找歌词。'],
  [43.2, 52.64, '匹配到逐字数据，每个字会跟着进度变化；只有普通 LRC 时，也能按整句滚动。'],
  [53.16, 58.28, '背景声部、对唱、翻译和罗马音可以同时显示。'],
  [58.8, 64.24, '合唱、和声或者外语歌的信息会更完整。'],
  [64.76, 71.48, '搜索歌曲时，多个平台的结果会放进同一个列表，还能按来源筛选。'],
  [72.0, 77.28, '先别急着高兴，能否播放仍然要看账号、接口和网络状态。'],
  [77.8, 87.4, '不过，应用内还内置了一个输入解锁密钥的地方，输入从群里获得的密钥之后就能播放所有网易云的歌曲了'],
  [87.76, 96.72, '它也支持本地曲库，支持扫描 MP3、FLAC、M4A 等多种格式，元数据的歌词、封面等也能一起识别。'],
  [97.24, 104.76, '允许悬浮窗权限后，切回桌面或者打开别的应用，主歌词仍然会留在状态栏。'],
  [105.28, 109.28, '位置、字体和颜色都能调整。'],
  [109.8, 116.52, '如果你喜欢音乐节舞美的效果，或者厌倦了网易云等平台的广告和臃肿的体形，可以试试它。'],
  [117.04, 119.6, '它支持 Android 8.0 及以上。'],
  [120.12, 125.24, '安装包的下载地址放在视频简介里了，我们下期视频再见。'],
] as const;

const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const cue = cues.find(([start, end]) => sec >= start && sec < end);
  if (!cue) return null;
  const [start, end, text] = cue;
  const fade = Math.min(1, (sec - start) / .12, (end - sec) / .12);
  return <div style={{ position: 'absolute', left: 100, right: 100, bottom: 35, zIndex: 100, display: 'flex', justifyContent: 'center', opacity: fade }}><div style={{ maxWidth: 1500, padding: '11px 22px 13px', background: 'rgba(0,0,0,.82)', color: C.white, fontFamily: SANS, fontSize: 42, fontWeight: 800, lineHeight: 1.28, textAlign: 'center' }}>{text}</div></div>;
};

export const Main: React.FC<MainProps> = () => (
  <AbsoluteFill style={{ background: C.ink }}>
    <Audio src={staticFile('audio/voice-v2.wav')} volume={1} />
    <Sequence from={SHOTS.opening.from} durationInFrames={SHOTS.opening.duration}><Opening /></Sequence>
    <Sequence from={SHOTS.styles.from} durationInFrames={SHOTS.styles.duration}><StyleArchive /></Sequence>
    <Sequence from={SHOTS.lyrics.from} durationInFrames={SHOTS.lyrics.duration}><LyricsScene /></Sequence>
    <Sequence from={SHOTS.voices.from} durationInFrames={SHOTS.voices.duration}><VoicesScene /></Sequence>
    <Sequence from={SHOTS.search.from} durationInFrames={SHOTS.search.duration}><SearchScene /></Sequence>
    <Sequence from={SHOTS.local.from} durationInFrames={SHOTS.local.duration}><LocalScene /></Sequence>
    <Sequence from={SHOTS.status.from} durationInFrames={SHOTS.status.duration}><StatusScene /></Sequence>
    <Sequence from={SHOTS.ending.from} durationInFrames={SHOTS.ending.duration}><Ending /></Sequence>
    <Subtitles />
  </AbsoluteFill>
);
