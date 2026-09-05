/**
 * 通用文本工具
 */

/** 截断文本：超过 max 字符时取前 max 字符并追加省略号 */
export function truncateText(text: string | undefined | null, max = 30): string {
  const value = String(text ?? '').trim();
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}……` : value;
}
