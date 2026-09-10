import { createRouter, createWebHashHistory } from 'vue-router';

import AppLayout from '@/layout/AppLayout.vue';
import homeRouter from '@/router/home';
import { isBareMobileLaunch, readMobileStartupTarget } from '@/router/mobileStartup';
import otherRouter from '@/router/other';

const loginRouter = {
  path: '/login',
  name: 'login',
  meta: {
    keepAlive: true,
    title: '登录',
    icon: 'icon-Home',
    back: true
  },
  redirect: { path: '/user', query: { panel: 'login' } }
};

const routes = [
  {
    path: '/',
    component: AppLayout,
    children: [...homeRouter, loginRouter, ...otherRouter]
  },
  {
    path: '/lyric',
    component: () => import('@/views/lyric/index.vue')
  }
];

const router = createRouter({
  routes,
  history: createWebHashHistory()
});

let startupRouteResolved = false;

// 添加全局前置守卫
router.beforeEach((to, _, next) => {
  if (!startupRouteResolved) {
    startupRouteResolved = true;
    if (to.path === '/' && isBareMobileLaunch(window.location.hash)) {
      const startupTarget = readMobileStartupTarget();
      if (typeof startupTarget !== 'string' || startupTarget !== '/') {
        next(startupTarget);
        return;
      }
    }
  }

  // 迷你模式为 Electron 桌面遗留（移动端永不触发），/mini 路由已随 MiniLayout 移除
  if (to.path === '/mini') {
    next('/');
    return;
  }

  // 其他情况正常导航
  next();
});

// 添加全局后置钩子，记录页面访问
router.afterEach((_to) => {
  // 使用setTimeout避免阻塞路由导航
  setTimeout(() => {}, 100);
});

export default router;
