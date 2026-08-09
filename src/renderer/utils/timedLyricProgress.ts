import type { IWordData } from '@/types/music';

function visualLength(word: IWordData): number {
  return Math.max(1, Array.from(word.text).length) + (word.space ? 1 : 0);
}

/** Keep the last started primary line visible until the next primary line starts. */
export function findStartedTimedLineIndex(startTimes: number[], currentTime: number): number {
  let result = -1;
  for (let index = 0; index < startTimes.length; index += 1) {
    if (currentTime >= startTimes[index]) result = index;
    else break;
  }
  return result;
}

/** Map irregular word timings to one continuous visual progress across the complete line. */
export function getTimedLyricLineProgress(words: IWordData[], currentTimeMs: number): number {
  if (words.length === 0) return 0;

  const totalLength = words.reduce((total, word) => total + visualLength(word), 0);
  let completedLength = 0;

  for (const word of words) {
    const length = visualLength(word);
    const start = word.startTime;
    const duration = Math.max(0, word.duration);
    const end = start + duration;

    if (currentTimeMs < start) return completedLength / totalLength;
    if (duration === 0 || currentTimeMs >= end) {
      completedLength += length;
      continue;
    }

    const wordProgress = Math.min(Math.max((currentTimeMs - start) / duration, 0), 1);
    return (completedLength + length * wordProgress) / totalLength;
  }

  return 1;
}
