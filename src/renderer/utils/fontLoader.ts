/**
 * 字体加载工具
 * 使用 FontFace API 动态加载内置字体库
 */

import { BUILTIN_FONTS, type FontDef } from '@/types/share';

/** 已加载字体的缓存 (fontId -> FontFace) */
const loadedFonts = new Map<string, FontFace>();

/** 正在加载中的字体 Promise (防止重复加载) */
const loadingPromises = new Map<string, Promise<FontFace>>();

/**
 * 获取字体文件的 URL
 * 使用 Vite 的 import.meta.url 模式，确保 dev 和 build 环境下路径正确
 */
function getFontUrl(fontDef: FontDef): string {
  try {
    // Vite 会正确处理 new URL + import.meta.url 模式
    return new URL(`../assets/fonts/${fontDef.file}`, import.meta.url).href;
  } catch {
    // 降级：使用相对路径
    return `./assets/fonts/${fontDef.file}`;
  }
}

/**
 * 加载单个字体
 * @param fontDef 字体定义
 * @returns 加载完成的 FontFace
 */
export async function loadFont(fontDef: FontDef): Promise<FontFace> {
  // 已加载，直接返回缓存
  const cached = loadedFonts.get(fontDef.id);
  if (cached) return cached;

  // 正在加载中，等待已有的 Promise
  const loading = loadingPromises.get(fontDef.id);
  if (loading) return loading;

  const url = getFontUrl(fontDef);
  const fontFace = new FontFace(fontDef.family, `url("${url}")`, {
    style: 'normal',
    weight: 'normal'
  });

  const promise = fontFace
    .load()
    .then((loadedFace) => {
      document.fonts.add(loadedFace);
      loadedFonts.set(fontDef.id, loadedFace);
      loadingPromises.delete(fontDef.id);
      return loadedFace;
    })
    .catch((err) => {
      loadingPromises.delete(fontDef.id);
      console.error(`[FontLoader] 加载字体 "${fontDef.name}" 失败:`, err);
      throw err;
    });

  loadingPromises.set(fontDef.id, promise);
  return promise;
}

/**
 * 通过 fontId 加载字体
 */
export async function loadFontById(fontId: string): Promise<FontFace | null> {
  const fontDef = BUILTIN_FONTS.find((f) => f.id === fontId);
  if (!fontDef) {
    console.warn(`[FontLoader] 未找到字体 ID: ${fontId}`);
    return null;
  }
  try {
    return await loadFont(fontDef);
  } catch {
    return null;
  }
}

/**
 * 预加载所有内置字体
 * 在海报功能首次使用时调用
 */
export async function preloadAllFonts(): Promise<void> {
  const promises = BUILTIN_FONTS.map((font) => loadFont(font).catch(() => null));
  await Promise.all(promises);
}

/**
 * 获取字体的 CSS font-family 值
 * 如果字体已加载，返回字体 family 名称；否则返回默认字体
 */
export function getFontFamily(fontId: string): string {
  const fontDef = BUILTIN_FONTS.find((f) => f.id === fontId);
  if (fontDef && loadedFonts.has(fontDef.id)) {
    return `'${fontDef.family}', sans-serif`;
  }
  return `'HengShanMaoXing', 'PingFang SC', sans-serif`;
}

/**
 * 检查字体是否已加载
 */
export function isFontLoaded(fontId: string): boolean {
  return loadedFonts.has(fontId);
}

/**
 * 确保字体已加载，未加载则自动加载
 * 用于海报生成前的字体准备
 */
export async function ensureFontLoaded(fontId: string): Promise<boolean> {
  const fontDef = BUILTIN_FONTS.find((f) => f.id === fontId);
  if (!fontDef) return false;
  if (loadedFonts.has(fontDef.id)) return true;
  try {
    await loadFont(fontDef);
    return true;
  } catch {
    return false;
  }
}
