/**
 * 歌词单词数据接口
 */
export interface WordData {
  /** 单词文本内容 */
  readonly text: string;
  /** 开始时间（毫秒） */
  readonly startTime: number;
  /** 持续时间（毫秒） */
  readonly duration: number;
  /** 该单词后是否有空格 */
  readonly space?: boolean;
}

/**
 * 歌词行数据接口
 */
export interface LyricLine {
  /** 行开始时间（毫秒） */
  readonly startTime: number;
  /** 行持续时间（毫秒） */
  readonly duration: number;
  /** 完整文本内容 */
  readonly fullText: string;
  /** 单词数组 */
  readonly words: readonly WordData[];
}

/**
 * 元数据接口
 */
export interface MetaData {
  /** 时间戳（可选，不带时间的元数据为 undefined） */
  readonly time?: number;
  /** 内容 */
  readonly content: string;
}

/**
 * 解析结果接口
 */
export interface ParsedLyrics {
  /** 元数据数组 */
  readonly metadata: readonly MetaData[];
  /** 歌词行数组 */
  readonly lyrics: readonly LyricLine[];
}

/**
 * 自定义解析错误类
 */
export class LyricParseError extends Error {
  constructor(
    message: string,
    public readonly line?: string
  ) {
    super(message);
    this.name = 'LyricParseError';
  }
}

/**
 * 解析结果类型
 */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: LyricParseError };

// 预编译正则表达式以提高性能
const METADATA_PATTERN = /^\{("t":|"c":)/; // 匹配 {"t": 或 {"c":
const LINE_TIME_PATTERN = /^\[(\d+),(\d+)\](.+)$/; // 逐字歌词格式: [92260,4740]...
const LRC_TIME_PATTERN = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\](.*)$/;
// 网易云 YRC 使用圆括号；部分本地逐字 LRC 使用方括号或尖括号时间段。
const WORD_PATTERN =
  /(?:\((\d+),(\d+)(?:,\d+)?\)|\[(\d+),(\d+)(?:,\d+)?\]|<(\d+),(\d+)(?:,\d+)?>)([\s\S]*?)(?=(?:\(\d+,\d+(?:,\d+)?\)|\[\d+,\d+(?:,\d+)?\]|<\d+,\d+(?:,\d+)?>)|$)/g;
// Enhanced LRC 使用绝对时间戳；同时兼容 <mm:ss.xx> 与 [mm:ss.xx] 两种标记。
const INLINE_LRC_TIME_PATTERN =
  /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>|\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

function timestampPartsToMs(minutes: string, seconds: string, fraction?: string): number {
  const ms = fraction ? parseInt(fraction.padEnd(3, '0').slice(0, 3), 10) : 0;
  return parseInt(minutes, 10) * 60000 + parseInt(seconds, 10) * 1000 + ms;
}

function applyWordSpacing(words: Array<Omit<WordData, 'space'>>, fullText: string): WordData[] {
  let currentPos = 0;
  return words.map((word) => {
    const wordIndex = fullText.indexOf(word.text, currentPos);
    if (wordIndex < 0) return word;
    const wordEnd = wordIndex + word.text.length;
    const spacedWord = {
      ...word,
      space: wordEnd < fullText.length && /\s/.test(fullText[wordEnd])
    };
    currentPos = wordEnd;
    return spacedWord;
  });
}

/** 解析行内绝对时间戳格式：[行时间]<词时间>词，或 [行时间][词时间]词。 */
function parseInlineLrcWords(
  content: string,
  lineStartTime: number
): { fullText: string; words: WordData[] } | null {
  INLINE_LRC_TIME_PATTERN.lastIndex = 0;
  const markers: Array<{ index: number; end: number; time: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = INLINE_LRC_TIME_PATTERN.exec(content)) !== null) {
    const minutes = match[1] ?? match[4];
    const seconds = match[2] ?? match[5];
    const fraction = match[3] ?? match[6];
    const time = timestampPartsToMs(minutes, seconds, fraction);
    if (Number.isFinite(time)) {
      markers.push({ index: match.index, end: INLINE_LRC_TIME_PATTERN.lastIndex, time });
    }
  }
  if (!markers.length) return null;

  const rawSegments: string[] = [];
  const timedWords: Array<Omit<WordData, 'space'>> = [];
  const addWord = (rawText: string, startTime: number, endTime?: number) => {
    rawSegments.push(rawText);
    const text = rawText.trim();
    if (!text) return;
    timedWords.push({
      text,
      startTime,
      duration: endTime === undefined ? 0 : Math.max(0, endTime - startTime)
    });
  };

  const prefix = content.slice(0, markers[0].index);
  if (prefix.trim()) addWord(prefix, lineStartTime, markers[0].time);

  markers.forEach((marker, index) => {
    const nextMarker = markers[index + 1];
    const rawText = content.slice(marker.end, nextMarker?.index ?? content.length);
    addWord(rawText, marker.time, nextMarker?.time);
  });

  const fullText = rawSegments.join('').trim();
  if (!fullText || !timedWords.length) return null;
  return { fullText, words: applyWordSpacing(timedWords, fullText) };
}

/**
 * 时间格式化函数
 * @param ms 毫秒数
 * @returns 格式化的时间字符串
 */
export const formatTime = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

/**
 * 解析元数据行
 * @param line 元数据行字符串
 * @returns 解析结果
 */
const parseMetadata = (line: string): ParseResult<MetaData> => {
  try {
    const data = JSON.parse(line);

    // 类型守卫：检查数据结构
    if (typeof data !== 'object' || data === null) {
      return {
        success: false,
        error: new LyricParseError('元数据格式无效：不是有效的对象', line)
      };
    }

    // 检查必须有 c 字段（内容数组）
    if (!Array.isArray(data.c)) {
      return {
        success: false,
        error: new LyricParseError('元数据格式无效：缺少 c 字段', line)
      };
    }

    // t 字段（时间戳）是可选的
    if (data.t !== undefined && typeof data.t !== 'number') {
      return {
        success: false,
        error: new LyricParseError('元数据格式无效：t 字段必须是数字', line)
      };
    }

    const content = data.c
      .filter((item: any) => item && typeof item.tx === 'string')
      .map((item: any) => item.tx)
      .join('');

    return {
      success: true,
      data: {
        time: data.t,
        content
      }
    };
  } catch (error) {
    return {
      success: false,
      error: new LyricParseError(
        `JSON解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
        line
      )
    };
  }
};

/**
 * 解析标准LRC格式的歌词行
 * @param line 歌词行字符串
 * @returns 解析结果
 */
const parseLrcLine = (line: string): ParseResult<LyricLine> => {
  const lrcMatch = line.match(LRC_TIME_PATTERN);
  if (!lrcMatch) {
    return {
      success: false,
      error: new LyricParseError('LRC歌词行格式无效：无法匹配时间信息', line)
    };
  }

  const minutes = parseInt(lrcMatch[1], 10);
  const seconds = parseInt(lrcMatch[2], 10);
  const milliseconds = lrcMatch[3] ? parseInt(lrcMatch[3].padEnd(3, '0').slice(0, 3), 10) : 0;
  const rawText = lrcMatch[4];
  const text = rawText.trim();

  // 验证时间值
  if (
    isNaN(minutes) ||
    isNaN(seconds) ||
    isNaN(milliseconds) ||
    minutes < 0 ||
    seconds < 0 ||
    milliseconds < 0 ||
    seconds >= 60
  ) {
    return {
      success: false,
      error: new LyricParseError('LRC歌词行格式无效：时间值无效', line)
    };
  }

  const startTime = minutes * 60000 + seconds * 1000 + milliseconds;
  const inlineWords = parseInlineLrcWords(rawText, startTime);

  return {
    success: true,
    data: {
      startTime,
      duration: 0, // LRC格式没有持续时间信息
      fullText: inlineWords?.fullText ?? text,
      words: inlineWords?.words ?? []
    }
  };
};

/**
 * 解析逐字歌词行
 * @param line 歌词行字符串
 * @returns 解析结果
 */
const parseWordByWordLine = (line: string): ParseResult<LyricLine> => {
  // 使用预编译的正则表达式
  const lineTimeMatch = line.match(LINE_TIME_PATTERN);
  if (!lineTimeMatch) {
    return {
      success: false,
      error: new LyricParseError('逐字歌词行格式无效：无法匹配时间信息', line)
    };
  }

  const startTime = parseInt(lineTimeMatch[1], 10);
  const duration = parseInt(lineTimeMatch[2], 10);
  const content = lineTimeMatch[3];

  // 验证时间值
  if (isNaN(startTime) || isNaN(duration) || startTime < 0 || duration < 0) {
    return {
      success: false,
      error: new LyricParseError('逐字歌词行格式无效：时间值无效', line)
    };
  }
  // 重置正则表达式状态
  WORD_PATTERN.lastIndex = 0;

  const words: WordData[] = [];
  let match: RegExpExecArray | null;

  // 第一遍：提取所有单词的原始文本（包含空格），构建完整文本
  const rawTextParts: string[] = [];
  const tempWords: Array<{ startTime: number; duration: number; text: string }> = [];

  while ((match = WORD_PATTERN.exec(content)) !== null) {
    const rawWordStartTime = parseInt(match[1] ?? match[3] ?? match[5], 10);
    const wordDuration = parseInt(match[2] ?? match[4] ?? match[6], 10);
    const rawWordText = match[7]; // 保留原始文本（可能包含空格）
    const wordText = rawWordText.trim(); // 去除首尾空格的文本
    // 某些本地 LRC 以行开始为基准保存相对词时间；YRC/QRC 则保存绝对时间。
    const wordStartTime =
      rawWordStartTime < startTime && rawWordStartTime <= duration
        ? startTime + rawWordStartTime
        : rawWordStartTime;

    // 验证单词数据
    const lineEndTime = startTime + duration;
    if (
      isNaN(wordStartTime) ||
      isNaN(wordDuration) ||
      wordStartTime < startTime ||
      wordStartTime >= lineEndTime ||
      wordDuration < 0
    ) {
      continue; // 跳过无效的单词数据
    }

    if (wordText) {
      tempWords.push({
        text: wordText,
        startTime: wordStartTime,
        duration: Math.min(wordDuration, lineEndTime - wordStartTime)
      });
      rawTextParts.push(rawWordText); // 保留原始格式用于分析空格
    }
  }

  // 构建完整的文本（保留原始空格）
  const fullText = rawTextParts.join('').trim();

  words.push(...applyWordSpacing(tempWords, fullText));

  return {
    success: true,
    data: {
      startTime,
      duration,
      fullText,
      words
    }
  };
};

/**
 * 解析歌词行（自动检测格式）
 * @param line 歌词行字符串
 * @returns 解析结果
 */
const parseLyricLine = (line: string): ParseResult<LyricLine> => {
  // 首先尝试解析逐字歌词格式
  if (LINE_TIME_PATTERN.test(line)) {
    return parseWordByWordLine(line);
  }

  // 然后尝试解析标准LRC格式
  if (LRC_TIME_PATTERN.test(line)) {
    return parseLrcLine(line);
  }

  return {
    success: false,
    error: new LyricParseError('歌词行格式无效：不匹配任何已知格式', line)
  };
};

/**
 * 计算LRC格式歌词的持续时间
 * @param lyrics 歌词行数组
 * @returns 更新持续时间后的歌词行数组
 */
const calculateLrcDurations = (lyrics: LyricLine[]): LyricLine[] => {
  if (lyrics.length === 0) return lyrics;

  const updatedLyrics: LyricLine[] = [];

  for (let i = 0; i < lyrics.length; i++) {
    const currentLine = lyrics[i];

    let duration = currentLine.duration;
    if (duration <= 0) {
      if (i < lyrics.length - 1) {
        duration = lyrics[i + 1].startTime - currentLine.startTime;
      } else {
        duration = 3000;
      }
    }

    // 确保持续时间不为负数
    duration = Math.max(duration, 0);

    const lineEndTime = currentLine.startTime + duration;
    const words = currentLine.words.map((word, wordIndex) => {
      const nextWord = currentLine.words[wordIndex + 1];
      const maxDuration = Math.max(0, lineEndTime - word.startTime);
      const inferredDuration = nextWord
        ? Math.max(0, nextWord.startTime - word.startTime)
        : maxDuration;
      return {
        ...word,
        duration: Math.min(word.duration > 0 ? word.duration : inferredDuration, maxDuration)
      };
    });

    updatedLyrics.push({ ...currentLine, duration, words });
  }

  return updatedLyrics;
};

/**
 * 解析不带时间戳的纯文本歌词行
 * @param line 纯文本歌词行
 * @returns 解析结果
 */
const parsePlainTextLine = (line: string): ParseResult<LyricLine> => {
  // 清理行首尾的 \r 等特殊字符
  const text = line.replace(/\r/g, '').trim();

  if (!text) {
    return {
      success: false,
      error: new LyricParseError('纯文本歌词行为空', line)
    };
  }

  return {
    success: true,
    data: {
      startTime: -1, // -1 表示没有时间信息
      duration: 0,
      fullText: text,
      words: []
    }
  };
};

/**
 * 主解析函数
 * @param lyricsStr 歌词字符串
 * @returns 解析结果
 */
export const parseLyrics = (lyricsStr: string): ParseResult<ParsedLyrics> => {
  if (typeof lyricsStr !== 'string') {
    return {
      success: false,
      error: new LyricParseError('输入参数必须是字符串')
    };
  }

  try {
    const lines = lyricsStr.trim().split('\n');
    const metadata: MetaData[] = [];
    const lyrics: LyricLine[] = [];
    const errors: LyricParseError[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      if (!trimmedLine) continue;

      // 使用预编译正则表达式进行快速检测
      if (METADATA_PATTERN.test(trimmedLine)) {
        const result = parseMetadata(trimmedLine);
        if (result.success) {
          metadata.push(result.data);
        } else {
          errors.push(result.error);
        }
      } else if (trimmedLine.startsWith('[')) {
        const result = parseLyricLine(trimmedLine);
        if (result.success) {
          lyrics.push(result.data);
        } else {
          errors.push(result.error);
        }
      } else {
        // 尝试解析为纯文本歌词行（不带时间戳）
        const result = parsePlainTextLine(trimmedLine);
        if (result.success) {
          lyrics.push(result.data);
        } else {
          errors.push(result.error);
        }
      }
    }

    // 如果有太多错误，可能整个文件格式有问题
    if (errors.length > 0 && errors.length > lines.length * 0.5) {
      return {
        success: false,
        error: new LyricParseError(
          `解析失败：错误行数过多 (${errors.length}/${lines.length})，可能文件格式不正确 ${JSON.stringify(errors)}`
        )
      };
    }

    // 按时间排序歌词行（将没有时间信息的行放在最前面）
    lyrics.sort((a, b) => {
      if (a.startTime === -1 && b.startTime === -1) return 0;
      if (a.startTime === -1) return -1;
      if (b.startTime === -1) return 1;
      return a.startTime - b.startTime;
    });

    // 计算LRC格式的持续时间
    const finalLyrics = calculateLrcDurations(lyrics);

    return {
      success: true,
      data: {
        metadata,
        lyrics: finalLyrics
      }
    };
  } catch (error) {
    return {
      success: false,
      error: new LyricParseError(
        `解析过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`
      )
    };
  }
};

/**
 * 导出默认解析函数（向后兼容）
 */
export default parseLyrics;
