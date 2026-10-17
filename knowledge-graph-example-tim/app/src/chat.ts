import { marked } from 'marked';

export interface SourceNode { id: string; label: string; type: string }

interface ChatOptions {
  /** Node currently selected in the graph; sent so questions like "summarise this" have a subject. */
  focusId: () => string | undefined;
  /** Called with the nodes retrieved for an answer, so the graph can highlight them. */
  onSources: (nodes: SourceNode[]) => void;
  onSelect: (id: string) => void;
  colorOf: (id: string) => string;
  /** Short name of the graph's owner and example questions, both from graph.json. */
  ownerName: string;
  suggestions: string[];
}

type Msg = { role: 'user' | 'assistant'; content: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function initChat(opts: ChatOptions) {
  const panel = document.getElementById('chat')!;
  const log = document.getElementById('chat-log')!;
  const form = document.getElementById('chat-form') as HTMLFormElement;
  const input = document.getElementById('chat-input') as HTMLTextAreaElement;
  const sendBtn = document.getElementById('chat-send') as HTMLButtonElement;
  const status = document.getElementById('chat-status')!;
  const focusChip = document.getElementById('chat-focus')!;
  const thinkBox = document.getElementById('chat-think') as HTMLInputElement;
  const history: Msg[] = [];
  let controller: AbortController | null = null;
  let model = 'the local model';

  const toggle = (open = panel.hidden) => {
    panel.hidden = !open;
    document.getElementById('chat-toggle')!.classList.toggle('active', open);
    if (open) (input.focus(), refreshFocus());
  };
  document.getElementById('chat-toggle')!.addEventListener('click', () => toggle());
  document.getElementById('chat-close')!.addEventListener('click', () => toggle(false));
  document.getElementById('chat-clear')!.addEventListener('click', () => {
    controller?.abort();
    history.length = 0;
    renderEmpty();
    opts.onSources([]);
  });

  function refreshFocus() {
    const id = opts.focusId();
    focusChip.hidden = !id;
    if (id) focusChip.textContent = `Context: ${id.split(':').slice(1).join(':')}`;
  }

  fetch('/api/health')
    .then((r) => r.json())
    .then((h) => {
      const ok = h.ollama?.ok && h.ollama?.modelAvailable;
      model = h.model;
      renderEmpty();
      status.textContent = ok ? `● ${h.model}` : `● ${h.model} unavailable`;
      status.className = ok ? 'ok' : 'bad';
    })
    .catch(() => ((status.textContent = '● chat API offline'), (status.className = 'bad')));

  function renderEmpty() {
    if (history.length) return;
    log.innerHTML = `<div class="chat-empty"><p>Ask anything about ${esc(opts.ownerName)}'s profile and papers. Answers come from <b>${esc(model)}</b> running locally in Ollama and use only facts retrieved from this knowledge graph.</p>${opts.suggestions.map(
      (s) => `<button class="suggestion">${esc(s)}</button>`,
    ).join('')}</div>`;
    log.querySelectorAll<HTMLButtonElement>('.suggestion').forEach((b) =>
      b.addEventListener('click', () => ask(b.textContent!)),
    );
  }
  renderEmpty();

  function bubble(role: 'user' | 'assistant', html = '') {
    log.querySelector('.chat-empty')?.remove();
    const el = document.createElement('div');
    el.className = `msg ${role}`;
    el.innerHTML = html;
    log.append(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  async function ask(question: string) {
    question = question.trim();
    if (!question || controller) return;
    history.push({ role: 'user', content: question });
    bubble('user', esc(question));
    const out = bubble('assistant', '<span class="typing">Searching the graph…</span>');
    input.value = '';
    sendBtn.textContent = 'Stop';
    controller = new AbortController();

    let answer = '';
    let thinking = '';
    let sources: SourceNode[] = [];
    const render = (extra = '') => {
      const src = sources.length
        ? `<div class="sources">${sources
            .map((s) => `<button data-id="${esc(s.id)}" title="${esc(s.type)}"><span style="color:${opts.colorOf(s.id)}">●</span>${esc(s.label.length > 42 ? s.label.slice(0, 40) + '…' : s.label)}</button>`)
            .join('')}</div>`
        : '';
      const think = thinking ? `<details class="thinking"><summary>Reasoning</summary>${esc(thinking)}</details>` : '';
      out.innerHTML = think + (answer ? marked.parse(answer, { async: false }) : '<span class="typing">Thinking…</span>') + extra + src;
      const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 120;
      if (nearBottom) log.scrollTop = log.scrollHeight;
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, focusId: opts.focusId(), think: thinkBox.checked }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error((await res.text()) || res.statusText);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === 'sources') (sources = ev.nodes, opts.onSources(sources));
          else if (ev.type === 'token') answer += ev.text;
          else if (ev.type === 'thinking') thinking += ev.text;
          else if (ev.type === 'error') throw new Error(ev.message);
          else if (ev.type === 'done' && ev.stats?.tokens)
            return render(`<div class="stats">${ev.stats.tokens} tokens · ${ev.stats.seconds.toFixed(1)} s</div>`);
          render();
        }
      }
      render();
    } catch (err: any) {
      if (err?.name === 'AbortError') render('<div class="stats">stopped</div>');
      else render(`<div class="error">⚠ ${esc(String(err?.message ?? err))}</div>`);
    } finally {
      if (answer) history.push({ role: 'assistant', content: answer });
      else history.pop(); // drop the unanswered question so a retry doesn't send it twice
      controller = null;
      sendBtn.textContent = 'Send';
    }
  }

  log.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('.sources button[data-id]');
    if (b) opts.onSelect(b.dataset.id!);
  });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (controller) controller.abort();
    else ask(input.value);
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) (ev.preventDefault(), form.requestSubmit());
  });

  return { refreshFocus, open: () => toggle(true) };
}
