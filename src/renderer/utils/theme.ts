export type ThemeType = 'dark' | 'light';

// 检测系统主题
export const getSystemTheme = (): ThemeType => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

// 应用主题
export const applyTheme = (theme: ThemeType) => {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark', 'theme-dark');
    root.classList.remove('theme-light', 'theme-gray');
  } else if (theme === 'light') {
    root.classList.add('theme-light');
    root.classList.remove('dark', 'theme-dark', 'theme-gray');
  }

  // 同时设置 data-theme 属性，供封面取色等模块检测当前主题
  root.setAttribute('data-theme', theme);

  // 保存主题到本地存储
  localStorage.setItem('theme', theme);
};

// 获取当前主题
export const getCurrentTheme = (): ThemeType => {
  return (localStorage.getItem('theme') as ThemeType) || 'light';
};

// 监听系统主题变化
export const watchSystemTheme = (callback: (theme: ThemeType) => void) => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      callback(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);

    // 返回清理函数
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }
  return () => {};
};
