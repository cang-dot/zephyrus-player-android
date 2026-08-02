import { useDateFormat } from '@vueuse/core';
import axios from 'axios';

import config from '../../../package.json';

interface GithubReleaseInfo {
  tag_name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: Array<{
    browser_download_url: string;
    name: string;
    size: number;
  }>;
}

interface ProxyNode {
  url: string;
  server: string;
  ip: string;
  location: string;
  latency: number;
  speed: number;
}

interface ProxyResponse {
  code: number;
  msg: string;
  data: ProxyNode[];
  total: number;
  update_time: string;
}

export interface UpdateResult {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseInfo: {
    tag_name: string;
    body: string;
    html_url: string;
    assets: Array<{
      browser_download_url: string;
      name: string;
      size?: number;
    }>;
  } | null;
}

// 缓存相关配置
const CACHE_KEY = 'github_proxy_nodes';
const CACHE_EXPIRE_TIME = 1000 * 60 * 10; // 10分钟过期

// 请求配置
const REQUEST_TIMEOUT = 2000; // 2秒超时

// 服务器直连的发布信息（国内可达性最好，且可返回服务器直链）
const SERVER_RELEASE_INFO_URL = 'https://mucang.xyz/zephyrus/apks/latest.json';

/**
 * 从缓存获取代理节点
 */
const getCachedProxyNodes = (): { nodes: string[]; timestamp: number } | null => {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { nodes, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_EXPIRE_TIME) {
      return { nodes, timestamp };
    }
  }
  return null;
};

/**
 * 缓存代理节点
 */
const cacheProxyNodes = (nodes: string[]) => {
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      nodes,
      timestamp: Date.now()
    })
  );
};

/**
 * 获取代理节点列表
 */
export const getProxyNodes = async (): Promise<string[]> => {
  // 尝试从缓存获取
  const cached = getCachedProxyNodes();
  if (cached) {
    return cached.nodes;
  }

  try {
    // 获取最新代理节点
    const { data } = await axios.get<ProxyResponse>('https://api.akams.cn/github', {
      timeout: REQUEST_TIMEOUT
    });
    if (data.code === 200) {
      // 按速度排序并获取前10个节点
      const nodes = data.data
        .sort((a, b) => b.speed - a.speed)
        .slice(0, 10)
        .map((node) => node.url);

      // 缓存节点
      cacheProxyNodes(nodes);
      return nodes;
    }
  } catch (error) {
    console.error('获取代理节点失败:', error);
  }

  // 使用备用节点
  return [
    'https://gh.lk.cc',
    'https://ghproxy.cn',
    'https://ghproxy.net',
    'https://gitproxy.click',
    'https://github.tbedu.top',
    'https://github.moeyy.xyz'
  ];
};

/**
 * 获取 GitHub 最新发布版本信息
 */
export const getLatestReleaseInfo = async (): Promise<GithubReleaseInfo | null> => {
  try {
    // 0) 服务器直连优先：国内网络稳定，且确保下载走服务器直链
    try {
      const serverResp = await axios.get<GithubReleaseInfo>(SERVER_RELEASE_INFO_URL, {
        timeout: 5000
      });
      if (serverResp.data?.tag_name) {
        return serverResp.data;
      }
    } catch (error) {
      console.warn('服务器更新信息获取失败，回退 GitHub:', error);
    }

    const token = import.meta.env.VITE_GITHUB_TOKEN;
    const headers = {};
    // 构建 API URL 列表
    const apiUrls = [
      // Android 仓库
      'https://api.github.com/repos/cang-dot/zephyrus-player-android/releases/latest',

      // 桌面版仓库（备用）
      'https://api.github.com/repos/cang-dot/zephyrus-player/releases/latest'
    ];

    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    for (const url of apiUrls) {
      try {
        const response = await axios.get(url, {
          headers,
          timeout: REQUEST_TIMEOUT
        });

        // 所有 URL 都返回 GitHub Release JSON 格式
        return response.data;
        return response.data;
      } catch (err) {
        console.warn(`尝试访问 ${url} 失败:`, err);
        continue;
      }
    }
    throw new Error('所有 API 地址均无法访问');
  } catch (error) {
    console.error('获取 GitHub Release 信息失败:', error);
    return null;
  }
};

/**
 * 格式化时间
 */
export const formatDate = (dateStr: string): string => {
  return useDateFormat(new Date(dateStr), 'YYYY-MM-DD HH:mm').value;
};

/**
 * 比较两个版本号
 * @param v1 版本号1
 * @param v2 版本号2
 * @returns 如果v1大于v2返回1，如果v1小于v2返回-1，如果相等返回0
 */
export const compareVersions = (v1: string, v2: string): number => {
  // 兼容 1.1.3-beta 这类预发布后缀：数字段取前缀数值，后缀仅在数字相同时参与比较
  const parse = (value: string): number[] =>
    String(value)
      .replace(/^v/i, '')
      .split('.')
      .map((part) => {
        const match = part.match(/^\d+/);
        return match ? Number(match[0]) : 0;
      });
  const v1Parts = parse(v1);
  const v2Parts = parse(v2);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }

  // 数字相同：预发布后缀（-beta/-rc 等）小于正式版
  const v1Suffix = String(v1).replace(/^v?[\d.]+/, '');
  const v2Suffix = String(v2).replace(/^v?[\d.]+/, '');
  if (!v1Suffix && v2Suffix) return 1;
  if (v1Suffix && !v2Suffix) return -1;
  return 0;
};

/**
 * 检查更新
 */
export const checkUpdate = async (
  currentVersion: string = config.version
): Promise<UpdateResult | null> => {
  try {
    const releaseInfo = await getLatestReleaseInfo();
    if (!releaseInfo) {
      return null;
    }

    const latestVersion = releaseInfo.tag_name.replace('v', '');
    // 比较版本号，只有当新版本大于当前版本时才返回更新信息
    if (compareVersions(latestVersion, currentVersion) <= 0) {
      return null;
    }

    return {
      hasUpdate: true,
      latestVersion,
      currentVersion,
      releaseInfo: {
        tag_name: latestVersion,
        body: `## 更新内容\n\n- 版本: ${latestVersion}\n${releaseInfo.body}`,
        html_url: releaseInfo.html_url,
        assets: releaseInfo.assets.map((asset) => ({
          browser_download_url: asset.browser_download_url,
          name: asset.name,
          size: asset.size
        }))
      }
    };
  } catch (error) {
    console.error('检查更新失败:', error);
    return null;
  }
};
