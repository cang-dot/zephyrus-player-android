// The t2cn bundle and the main entry expose the same converter API.
// This declaration also supports our legacy TypeScript module resolution.
declare module 'opencc-js/t2cn' {
  export { Converter } from 'opencc-js';
}
