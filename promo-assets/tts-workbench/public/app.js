const state = { sentences: [], style: '', busy: false };
const list = document.querySelector('#sentence-list');
const template = document.querySelector('#sentence-template');
const apiKey = document.querySelector('#api-key');
const stylePrompt = document.querySelector('#style-prompt');
const completeButton = document.querySelector('#complete-button');
const message = document.querySelector('#global-message');

const stored = JSON.parse(sessionStorage.getItem('zephyrus-tts-workbench') || '{}');
apiKey.value = stored.apiKey || '';

const persist = () => {
  sessionStorage.setItem('zephyrus-tts-workbench', JSON.stringify({
    apiKey: apiKey.value,
    style: stylePrompt.value,
    sentences: state.sentences.map(({ id, text, instruction, gapMs, selected, accepted, dirty }) => ({ id, text, instruction, gapMs, selected, accepted, dirty }))
  }));
};

const showMessage = (text = '') => {
  message.hidden = !text;
  message.textContent = text;
};

const defaultGap = (text, isLast) => isLast ? 0 : /[。！？]$/.test(text) ? 520 : 360;

const updateProgress = () => {
  const accepted = state.sentences.filter((item) => item.accepted && item.selected).length;
  const total = state.sentences.length;
  document.querySelector('#confirmed-count').textContent = accepted;
  document.querySelector('#total-count').textContent = total;
  document.querySelector('#meter-fill').style.width = `${total ? accepted / total * 100 : 0}%`;
  completeButton.disabled = state.busy || accepted !== total;
  document.querySelector('#completion-hint').textContent = accepted === total
    ? '全部句子已确认，可以合成完整音频。'
    : `还需确认 ${total - accepted} 句。修改文字后需重新生成。`;
};

const versionUrl = (filename) => filename ? `/audio/${encodeURIComponent(filename)}?v=${Date.now()}` : '';

const render = () => {
  list.replaceChildren();
  state.sentences.forEach((item) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = item.id;
    node.classList.toggle('is-accepted', item.accepted);
    node.querySelector('.sentence-index').textContent = String(item.id).padStart(2, '0');
    const text = node.querySelector('.sentence-text');
    const lineStyle = node.querySelector('.line-style');
    const gap = node.querySelector('.gap-input');
    const select = node.querySelector('.version-select');
    const audio = node.querySelector('.line-audio');
    const play = node.querySelector('.play-button');
    const generate = node.querySelector('.generate-button');
    const accept = node.querySelector('.accept-button');
    const status = node.querySelector('.row-status');

    text.value = item.text;
    lineStyle.value = item.instruction;
    gap.value = item.gapMs;
    select.innerHTML = item.versions.length
      ? item.versions.map((version) => `<option value="${version}">${version.match(/v(\d+)\.wav$/)?.[1] || version}</option>`).join('')
      : '<option value="">暂无</option>';
    select.value = item.selected || '';
    play.disabled = !item.selected;
    accept.disabled = !item.selected || item.dirty;
    accept.textContent = item.accepted ? '已确认' : '确认此句';
    accept.classList.toggle('is-accepted', item.accepted);
    status.textContent = item.loading ? '生成中…' : item.dirty ? '文字或指令已修改' : item.accepted ? '已确认' : item.selected ? '待确认' : '未生成';
    if (item.selected) audio.src = versionUrl(item.selected);

    text.addEventListener('input', () => {
      item.text = text.value;
      item.accepted = false;
      item.dirty = true;
      node.classList.remove('is-accepted');
      accept.textContent = '确认此句';
      accept.classList.remove('is-accepted');
      status.textContent = item.selected ? '文字已修改，需重新生成' : '未生成';
      accept.disabled = true;
      persist();
      updateProgress();
    });
    lineStyle.addEventListener('input', () => {
      item.instruction = lineStyle.value;
      item.accepted = false;
      item.dirty = true;
      node.classList.remove('is-accepted');
      accept.textContent = '确认此句';
      accept.classList.remove('is-accepted');
      status.textContent = item.selected ? '指令已修改，需重新生成' : '未生成';
      accept.disabled = true;
      persist();
      updateProgress();
    });
    gap.addEventListener('change', () => {
      item.gapMs = Math.max(0, Math.min(3000, Number(gap.value) || 0));
      gap.value = item.gapMs;
      persist();
    });
    select.addEventListener('change', () => {
      item.selected = select.value;
      item.accepted = false;
      persist();
      render();
    });
    play.addEventListener('click', () => {
      document.querySelectorAll('audio').forEach((other) => { if (other !== audio) other.pause(); });
      if (audio.paused) {
        audio.play();
        play.textContent = 'Ⅱ';
      } else {
        audio.pause();
        play.textContent = '▶';
      }
    });
    audio.addEventListener('ended', () => { play.textContent = '▶'; });
    generate.addEventListener('click', async () => {
      showMessage();
      if (!apiKey.value.trim()) return showMessage('请先填写 MiMo API Key。');
      item.loading = true;
      item.accepted = false;
      state.busy = true;
      render();
      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: item.id,
            text: item.text,
            style: item.instruction.trim() ? `${stylePrompt.value.trim()}\n本句指导：${item.instruction.trim()}` : stylePrompt.value,
            apiKey: apiKey.value
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '生成失败。');
        item.versions.unshift(result.filename);
        item.selected = result.filename;
        item.dirty = false;
      } catch (error) {
        showMessage(error.message);
      } finally {
        item.loading = false;
        state.busy = false;
        persist();
        render();
      }
    });
    accept.addEventListener('click', () => {
      item.accepted = !item.accepted;
      persist();
      render();
    });
    list.append(node);
  });
  updateProgress();
};

const load = async () => {
  try {
    const response = await fetch('/api/project');
    const project = await response.json();
    if (!response.ok) throw new Error(project.error || '读取项目失败。');
    const savedItems = new Map((stored.sentences || []).map((item) => [item.id, item]));
    state.style = stored.style || project.style;
    stylePrompt.value = state.style;
    state.sentences = project.sentences.map((item, index) => {
      const saved = savedItems.get(item.id) || {};
      const selected = item.versions.includes(saved.selected) ? saved.selected : item.versions[0] || '';
      return {
        ...item,
        text: saved.text || item.text,
        instruction: saved.instruction || '',
        gapMs: Number.isFinite(saved.gapMs) ? saved.gapMs : defaultGap(item.text, index === project.sentences.length - 1),
        selected,
        accepted: Boolean(saved.accepted && selected),
        dirty: Boolean(saved.dirty),
        loading: false
      };
    });
    render();
  } catch (error) {
    showMessage(error.message);
  }
};

apiKey.addEventListener('input', persist);
stylePrompt.addEventListener('input', persist);
document.querySelector('#toggle-key').addEventListener('click', () => {
  apiKey.type = apiKey.type === 'password' ? 'text' : 'password';
});

completeButton.addEventListener('click', async () => {
  showMessage();
  state.busy = true;
  completeButton.textContent = '正在合成…';
  updateProgress();
  try {
    const response = await fetch('/api/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ selections: state.sentences.map(({ selected, gapMs }) => ({ filename: selected, gapMs })) })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '合成失败。');
    const output = document.querySelector('#final-output');
    const finalAudio = document.querySelector('#final-audio');
    const download = document.querySelector('#download-output');
    finalAudio.src = result.url;
    download.href = result.url;
    download.download = result.filename;
    output.hidden = false;
    document.querySelector('#completion-hint').textContent = `已生成：${result.path}`;
  } catch (error) {
    showMessage(error.message);
  } finally {
    state.busy = false;
    completeButton.textContent = '完成并合成';
    updateProgress();
  }
});

load();
