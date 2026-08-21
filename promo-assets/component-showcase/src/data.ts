import type { ShowcaseSong } from './types';

export const FPS = 30 as const;
export const TOTAL_FRAMES = 900;
export const BGM_START = 38.01106575963719;
export const BPM = 120.00137253628395;
export const BEAT_SECONDS = 0.4999942811642278;

export const SHOTS = {
  material: [0, 99],
  database: [99, 195],
  lyrics: [195, 300],
  alignment: [300, 390],
  styles: [390, 510],
  slider: [510, 600],
  playbar: [600, 720],
  poster: [720, 852],
  brand: [852, 900]
} as const;

export const SONGS: ShowcaseSong[] = [
  {
    id: 'aurora',
    title: '云层背面',
    artist: 'Zephyrus Ensemble',
    cover: '/covers/aurora.svg',
    primaryColor: '#6750A4',
    surfaceColor: '#F4EFFA',
    ttmlFixture: 'demo'
  },
  {
    id: 'vermillion',
    title: '向晚时刻',
    artist: 'Northbound',
    cover: '/covers/vermillion.svg',
    primaryColor: '#B3261E',
    surfaceColor: '#FFF0ED',
    ttmlFixture: 'demo'
  },
  {
    id: 'lagoon',
    title: '潮汐信号',
    artist: 'Lumen Coast',
    cover: '/covers/lagoon.svg',
    primaryColor: '#006A6A',
    surfaceColor: '#E5F5F3',
    ttmlFixture: 'demo'
  }
];

export const DATABASE_TITLES = [
  '我的血换你的血', '黑夜摸象', '云端', '十公里', '穿脱', '泡沫', '讨封', '定军',
  'Sleepless', 'Moonlit', '白日梦', '夜航', '暗涌', '无问', '花火', '晚风', '回声',
  '星河', '无眠', '雨幕', '长街', '潮汐', '迷雾', '海岸线', '失重', '剪影', '余温',
  '风暴眼', '冬日来信', '透明城市', '灰烬', '晨昏线', '平行世界', '落日飞车'
];

export const LYRIC_LINES = [
  { text: '风从很远的地方来', translation: 'The wind arrives from far away' },
  { text: '把云层写成缓慢的海', translation: 'Turning clouds into a quiet sea' },
  { text: '我们在同一段时间醒来', translation: 'We wake inside the same moment' },
  { text: '让每一个字 都跟随音乐盛开', translation: 'Let every word bloom with the music' },
  { text: '下一首 正在靠近', translation: 'The next song is drawing near' }
];

export const PLAYER_STYLES = [
  { name: '默认', image: '/styles/default.jpg' },
  { name: '舞台', image: '/styles/stage.jpg' },
  { name: '星盘', image: '/styles/star-chart.jpg' },
  { name: '烟雾', image: '/styles/smoke.jpg' },
  { name: '雨夜', image: '/styles/rain.jpg' }
];
