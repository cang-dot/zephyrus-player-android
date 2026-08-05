/**
 * 应用内反馈 API
 *
 * 服务器地址: https://www.mucang.xyz/api
 * 双通道：服务器 API 优先，失败时降级为邮件
 */

const API_BASE = 'https://www.mucang.xyz/api';
const FEEDBACK_EMAIL = 'feedback@mucang.xyz';

export type FeedbackType = 'bug' | 'feature' | 'other';

export interface FeedbackPayload {
  type: FeedbackType;
  content: string;
  contact?: string;
  appVersion: string;
  device: string;
  osVersion: string;
}

export interface FeedbackResult {
  success: boolean;
  message: string;
  via: 'api' | 'email' | 'failed';
}

/**
 * 提交反馈到服务器
 */
async function submitToServer(payload: FeedbackPayload): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 降级：调起系统邮件
 */
function openMailto(payload: FeedbackPayload): void {
  const subject = `[Zephyrus反馈] ${payload.type === 'bug' ? 'Bug' : payload.type === 'feature' ? '功能建议' : '其他'}`;
  const body = [
    `类型: ${payload.type}`,
    `内容: ${payload.content}`,
    payload.contact ? `联系方式: ${payload.contact}` : '',
    `---`,
    `App版本: ${payload.appVersion}`,
    `设备: ${payload.device}`,
    `系统: ${payload.osVersion}`
  ].filter(Boolean).join('\n');

  const mailtoUrl = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoUrl;
}

/**
 * 提交反馈（双通道）
 */
export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResult> {
  // 优先服务器 API
  const ok = await submitToServer(payload);
  if (ok) {
    return { success: true, message: '反馈已提交，感谢你的支持！', via: 'api' };
  }

  // 降级为邮件
  try {
    openMailto(payload);
    return { success: true, message: '已为你打开邮件，请发送反馈。', via: 'email' };
  } catch {
    return { success: false, message: '反馈提交失败，请稍后重试。', via: 'failed' };
  }
}
