# Zephyrus 逐句配音工作台

本地临时工具，用于把定稿文案拆成句子，逐句调用 MiMo 音色复刻、试听、重做和确认，最后合成为一条 48 kHz 单声道 WAV。

```powershell
npm start
```

打开 `http://127.0.0.1:4177`。MiMo API Key 只保存在当前浏览器标签页的 `sessionStorage` 中，并随生成请求传给本地服务；服务不会把密钥写入文件。

参考音频默认使用：

```text
C:\Users\Administrator\Desktop\Tt\yinlang_voice.mp3
```

可以通过 `ZEPHYRUS_REFERENCE_AUDIO` 环境变量覆盖。逐句音频保存在 `generated/`，最终音频保存在 `output/zephyrus-voiceclone-sentence-mix.wav`。
