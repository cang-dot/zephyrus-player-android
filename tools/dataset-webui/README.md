# dataset-webui（内网数据集工具）

搜索网易云 → 服务端爬取音频落盘 → 波形上人工标注标准段落（前奏/主歌/预副歌/副歌/桥段/间奏/尾奏）→ 导出结构化训练数据。

## 启动（Node ≥18，零依赖）

```
node server.js --port 8787
```

内网任意机器浏览器访问 `http://<本机内网IP>:8787`。

## 流程

1. **搜索爬取**：搜索关键词或粘贴歌单 id 批量导入 → 勾选 → 下载全部选中（音频存 `dataset/{id}.{ext}`，同名跳过）。
2. **段落标注**：选已下载音频 → 载入 → 在波形上拖出段落（当前标签高亮），拖边缘微调，Space 播放/暂停，数字键 1-7 切换标签，Del 删除选中段；保存到 `dataset/annotations/{id}.json`（刷新不丢）。
3. **导出**：`/api/export` 返回 `{manifest, items}` 单文件 JSON，即模型训练格式。

## 数据格式

```json
{
  "manifest": { "version": 1, "labelSet": ["intro","verse","prechorus","chorus","bridge","interlude","outro"] },
  "items": [
    { "id": "123", "name": "…", "artist": "…", "duration": 240.5,
      "audioFile": "123.mp3", "sections": [{ "label": "chorus", "start": 45.2, "end": 82.0 }] }
  ]
}
```

## 备注

- 网易云解析/下载走服务端直连（带 UA/Referer/Cookie），VIP/无版权歌曲会返回占位或空链接，队列里标记失败即可；也可手动粘贴任意音频直链到下载地址。
- 爬取的音频仅用于本地研究/训练，请遵守版权边界，勿再分发。
