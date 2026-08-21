import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'out');
const frames = resolve(out, 'frames');
const ffmpeg = process.env.FFMPEG || 'C:/Users/Administrator/AppData/Local/Programs/Python/Python312/Scripts/ffmpeg.exe';
const run = (args) => new Promise((resolveRun, reject) => { const p = spawn(ffmpeg, args, { cwd: root, stdio: 'inherit', shell: false }); p.on('exit', c => c ? reject(new Error(`ffmpeg exited ${c}`)) : resolveRun()); });
await mkdir(out, { recursive: true });
await run(['-y', '-framerate', '30', '-i', `${frames}/frame-%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'medium', resolve(out, 'zephyrus-component-showcase-silent.mp4')]);
await run(['-y', '-ss', '38.0110657596', '-t', '30', '-i', resolve(root, 'public/audio/bgm.mp3'), '-c:a', 'aac', '-b:a', '192k', resolve(out, 'showcase-bgm.m4a')]);
await run(['-y', '-i', resolve(out, 'zephyrus-component-showcase-silent.mp4'), '-i', resolve(out, 'showcase-bgm.m4a'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-shortest', resolve(out, 'zephyrus-component-showcase-bgm.mp4')]);
await run(['-y', '-i', resolve(root, 'public/audio/sfx/whoosh.mp3'), '-af', 'adelay=3300|3300,volume=0.22', resolve(out, 'sfx-whoosh.m4a')]);
await run(['-y', '-i', resolve(root, 'public/audio/sfx/impact.mp3'), '-af', 'adelay=20000|20000,volume=0.25', resolve(out, 'sfx-impact.m4a')]);
await run(['-y', '-i', resolve(out, 'showcase-bgm.m4a'), '-i', resolve(out, 'sfx-whoosh.m4a'), '-i', resolve(out, 'sfx-impact.m4a'), '-filter_complex', '[0:a][1:a][2:a]amix=inputs=3:duration=longest:normalize=0[a]', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k', resolve(out, 'showcase-mix.m4a')]);
await run(['-y', '-i', resolve(out, 'zephyrus-component-showcase-silent.mp4'), '-i', resolve(out, 'showcase-mix.m4a'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-shortest', resolve(out, 'zephyrus-component-showcase.mp4')]);
await rm(frames, { recursive: true, force: true });
