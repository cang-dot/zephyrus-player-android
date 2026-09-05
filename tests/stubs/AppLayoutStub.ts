/**
 * AppLayout 的测试桩:router/index 静态引用了布局组件,任何经 store/router 的
 * 测试导入链都会把 .vue 拖进 node 环境(vitest 未装 vue 插件,无法转译)。
 * 桩只提供路由所需的默认组件空壳,不参与断言。
 */
export default { name: 'AppLayoutStub' };
