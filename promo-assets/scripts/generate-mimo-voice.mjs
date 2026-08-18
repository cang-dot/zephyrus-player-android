import fs from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.MIMO_API_KEY;
if (!apiKey) {
  throw new Error('MIMO_API_KEY is required.');
}

const [referencePath, copyPath, stylePath, outputPath] = process.argv.slice(2);
if (!referencePath || !copyPath || !stylePath || !outputPath) {
  throw new Error(
    'Usage: node generate-mimo-voice.mjs <reference.mp3> <copy.txt> <style.txt> <output.wav>'
  );
}

const [referenceBytes, copy, style] = await Promise.all([
  fs.readFile(referencePath),
  fs.readFile(copyPath, 'utf8'),
  fs.readFile(stylePath, 'utf8')
]);

const referenceBase64 = referenceBytes.toString('base64');
if (Buffer.byteLength(referenceBase64, 'utf8') > 10 * 1024 * 1024) {
  throw new Error('The Base64 reference audio exceeds the 10 MB MiMo limit.');
}

const response = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'api-key': apiKey,
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    model: 'mimo-v2.5-tts-voiceclone',
    messages: [
      { role: 'user', content: style.trim() },
      { role: 'assistant', content: copy.trim() }
    ],
    audio: {
      format: 'wav',
      voice: `data:audio/mpeg;base64,${referenceBase64}`
    }
  })
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`MiMo request failed (${response.status}): ${body.slice(0, 1200)}`);
}

const result = await response.json();
const audioBase64 = result?.choices?.[0]?.message?.audio?.data;
if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
  throw new Error('MiMo response did not contain audio data.');
}

const audioBytes = Buffer.from(audioBase64, 'base64');
if (audioBytes.length < 44 || audioBytes.subarray(0, 4).toString('ascii') !== 'RIFF') {
  throw new Error('MiMo returned an invalid WAV payload.');
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, audioBytes);

console.log(
  JSON.stringify({
    output: path.resolve(outputPath),
    bytes: audioBytes.length,
    requestId: result?.id ?? null,
    model: result?.model ?? 'mimo-v2.5-tts-voiceclone'
  })
);
