export function shouldRestartMiniPlayerIdleTimer(collapsed: boolean, musicFull: boolean) {
  return !collapsed && !musicFull;
}
