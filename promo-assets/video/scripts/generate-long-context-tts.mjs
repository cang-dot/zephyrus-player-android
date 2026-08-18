import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const referencePath = path.join(root, 'public', 'audio', 'yinlang_voice_20s.wav');
const outputDir = path.join(root, 'public', 'audio', 'long-context');
const apiKey = process.env.MIMO_API_KEY?.trim();

if (!apiKey) throw new Error('MIMO_API_KEY is not set in this process.');

const entries = JSON.parse(await fs.readFile(path.join(root, 'scripts', 'long-context-script.json'), 'utf8'));
const segments = entries.map((entry) => entry.text);

const style = '自然、清楚的中文口语解说，像给不了解技术的朋友解释一张图。语速快一点，但不能含糊或连成一团；短句之间保留很短的停顿。不要播音腔，不要故作兴奋，不要夸张尖叫。英文模型名和数字读清楚。只朗读目标文案，每个句子只读一遍，禁止重复。';

await fs.mkdir(outputDir, { recursive: true });
const reference = await fs.readFile(referencePath);
const voice = `data:audio/wav;base64,${reference.toString('base64')}`;
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const requestedSegment = Number.parseInt(process.env.TTS_SEGMENT ?? '', 10);
const indexes = Number.isInteger(requestedSegment) && requestedSegment > 0
  ? [requestedSegment - 1]
  : segments.map((_, index) => index);

for (const index of indexes) {
  const target = path.join(outputDir, `segment-${String(index + 1).padStart(2, '0')}.wav`);
  let response;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: {'api-key': apiKey, 'content-type': 'application/json'},
      body: JSON.stringify({
        model: 'mimo-v2.5-tts-voiceclone',
        messages: [
          {role: 'user', content: style},
          {role: 'assistant', content: segments[index]}
        ],
        audio: {format: 'wav', voice}
      })
    });
    if (response.status !== 429 || attempt === 3) break;
    const delay = (attempt + 1) * 15000;
    console.log(`rate limited, retrying segment ${index + 1} in ${delay / 1000}s`);
    await sleep(delay);
  }

  if (!response.ok) throw new Error(`MiMo ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const result = await response.json();
  const audio = result?.choices?.[0]?.message?.audio?.data;
  if (typeof audio !== 'string' || !audio) throw new Error(`Segment ${index + 1} has no audio data.`);
  const bytes = Buffer.from(audio, 'base64');
  if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF') throw new Error(`Segment ${index + 1} is not a WAV file.`);
  await fs.writeFile(target, bytes);
  console.log(`generated ${path.basename(target)} (${bytes.length} bytes)`);
  if (index !== indexes.at(-1)) await sleep(4000);
}

await fs.writeFile(path.join(outputDir, 'script.json'), JSON.stringify({entries}, null, 2));
