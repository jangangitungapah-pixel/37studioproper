import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  Clipboard,
  ImagePlus,
  LoaderCircle,
  MessageCircleMore,
  Paperclip,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  generateRoleBrief,
  streamRoleAssistant,
} from '../../services/firebaseAiService.js';
import '../../styles/ai-assistant.css';

const ROLE_PROFILES = Object.freeze({
  client: Object.freeze({
    eyebrow: 'Booking concierge',
    greeting: 'Saya bisa membantu memilih jadwal, memahami status booking, pembayaran, dan persiapan sesi Anda.',
    label: 'Client AI',
    suggestions: [
      'Ringkas booking saya berikutnya',
      'Apa yang perlu saya siapkan sebelum sesi?',
      'Jelaskan status pembayaran saya',
    ],
  }),
  guard: Object.freeze({
    eyebrow: 'Operations copilot',
    greeting: 'Saya bisa membuat briefing shift, checklist serah terima, dan merangkum attendance Anda.',
    label: 'Guard AI',
    suggestions: [
      'Buat briefing shift saya',
      'Ringkas attendance bulan ini',
      'Buat checklist serah terima studio',
    ],
  }),
  admin: Object.freeze({
    eyebrow: 'Workspace copilot',
    greeting: 'Saya menganalisis hanya workspace dan data yang diizinkan untuk akun Admin Anda.',
    label: 'Admin AI',
    suggestions: [
      'Apa yang perlu saya prioritaskan?',
      'Cari anomali di workspace ini',
      'Buat checklist tindak lanjut hari ini',
    ],
  }),
  owner: Object.freeze({
    eyebrow: 'Executive intelligence',
    greeting: 'Saya membantu membaca kesehatan studio, risiko operasional, dan keputusan yang memerlukan perhatian Owner.',
    label: 'Owner AI',
    suggestions: [
      'Buat executive briefing hari ini',
      'Apa risiko terbesar studio sekarang?',
      'Prioritaskan tindakan dengan dampak tertinggi',
    ],
  }),
});

function createMessage(role, content, extra = {}) {
  return {
    content,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    ...extra,
  };
}

function getErrorMessage(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');

  if (code === 'ai/app-check-required') {
    return 'AI belum aktif di production karena App Check belum dikonfigurasi. Hubungi Owner.';
  }

  if (code === 'ai/disabled') {
    return message;
  }

  if (/app\s*check|401|invalid token/i.test(`${code} ${message}`)) {
    return 'Firebase App Check menolak koneksi AI. Muat ulang aplikasi; untuk localhost, pastikan debug token sudah terdaftar.';
  }

  if (/high demand|temporar|unavailable|\b500\b|\b502\b|\b503\b|\b504\b/i.test(message)) {
    return 'Model AI sedang padat untuk sementara. Tunggu sebentar lalu coba kembali.';
  }

  if (/permission|403|unauthorized/i.test(message)) {
    return 'Firebase AI Logic menolak request. Periksa aktivasi API dan App Check project.';
  }

  if (/quota|429|resource.exhausted/i.test(message)) {
    return 'Kuota AI sedang penuh. Tunggu sebentar lalu coba lagi.';
  }

  if (/network|fetch|offline/i.test(message)) {
    return 'Koneksi AI terputus. Periksa internet lalu coba kembali.';
  }

  return message || '37 AI belum dapat merespons. Coba kembali.';
}

function AiMessageText({ content }) {
  const blocks = String(content || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const isList = lines.every((line) => /^[-*•]|^\d+[.)]/.test(line));

    if (isList) {
      return (
        <ul key={`${block.slice(0, 18)}-${index}`}>
          {lines.map((line) => (
            <li key={line}>{line.replace(/^[-*•]\s*|^\d+[.)]\s*/, '')}</li>
          ))}
        </ul>
      );
    }

    return <p key={`${block.slice(0, 18)}-${index}`}>{block}</p>;
  });
}

function AiBrief({ brief }) {
  if (!brief) return null;

  return (
    <article className="role-ai-brief">
      <span className="role-ai-brief-label">
        <BrainCircuit size={14} />
        AI Briefing
      </span>
      <h4>{brief.headline}</h4>
      <p>{brief.summary}</p>

      {brief.risks?.length ? (
        <section>
          <strong>Perlu perhatian</strong>
          <ul>
            {brief.risks.slice(0, 4).map((risk) => <li key={risk}>{risk}</li>)}
          </ul>
        </section>
      ) : null}

      {brief.actions?.length ? (
        <section>
          <strong>Langkah prioritas</strong>
          <div className="role-ai-brief-actions">
            {brief.actions.slice(0, 4).map((action) => (
              <div className={`is-${action.priority || 'medium'}`} key={`${action.label}-${action.reason}`}>
                <span>{action.priority}</span>
                <b>{action.label}</b>
                <small>{action.reason}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <small>Confidence: {brief.confidence || 'medium'}</small>
    </article>
  );
}

export default function RoleAiAssistant({
  context = {},
  loadContext,
  role = 'client',
  surface = '',
  user,
}) {
  const profile = ROLE_PROFILES[role] || ROLE_PROFILES.client;
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [messages, setMessages] = useState(() => [
    createMessage('assistant', profile.greeting),
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState('');
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageListRef = useRef(null);
  const contextCacheRef = useRef(new Map());
  const profileName = String(user?.displayName || '')
    .trim()
    .split(/\s+/)[0]
    .slice(0, 40);

  const filePreviewUrl = useMemo(
    () => file ? URL.createObjectURL(file) : '',
    [file],
  );

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isThinking) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isThinking]);

  useEffect(() => {
    if (!isOpen || !messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [isOpen, messages]);

  async function resolveContext({ refresh = false } = {}) {
    const cacheKey = `${role}:${surface}`;

    if (!refresh && contextCacheRef.current.has(cacheKey)) {
      return {
        ...context,
        ...contextCacheRef.current.get(cacheKey),
      };
    }

    if (typeof loadContext !== 'function') {
      return context;
    }

    const loadedContext = await loadContext();
    contextCacheRef.current.set(cacheKey, loadedContext || {});

    return {
      ...context,
      ...(loadedContext || {}),
    };
  }

  function updateMessage(messageId, patch) {
    setMessages((current) => current.map((message) => (
      message.id === messageId
        ? { ...message, ...patch }
        : message
    )));
  }

  async function sendMessage(overrideMessage = '') {
    const cleanMessage = String(overrideMessage || input).trim();

    if ((!cleanMessage && !file) || isThinking) return;

    const userMessage = createMessage('user', cleanMessage || 'Analisis gambar ini.', {
      attachmentName: file?.name || '',
    });
    const assistantMessage = createMessage('assistant', '', {
      isStreaming: true,
    });
    const history = messages.filter((message) => !message.brief && message.content);

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput('');
    setError('');
    setIsThinking(true);

    try {
      const resolvedContext = await resolveContext();
      const result = await streamRoleAssistant({
        context: resolvedContext,
        file,
        history,
        message: userMessage.content,
        onChunk: (_chunk, completeText) => {
          updateMessage(assistantMessage.id, {
            content: completeText,
          });
        },
        role,
        surface,
      });

      updateMessage(assistantMessage.id, {
        content: result.text || 'Tidak ada jawaban yang dapat ditampilkan.',
        isStreaming: false,
        model: result.model,
      });
      setFile(null);
    } catch (sendError) {
      const message = getErrorMessage(sendError);
      console.error('[role-ai-assistant] Request AI gagal:', sendError);
      setError(message);
      updateMessage(assistantMessage.id, {
        content: message,
        isError: true,
        isStreaming: false,
      });
    } finally {
      setIsThinking(false);
    }
  }

  async function generateBrief() {
    if (isThinking) return;

    const assistantMessage = createMessage('assistant', '', {
      isStreaming: true,
    });
    setMessages((current) => [...current, assistantMessage]);
    setError('');
    setIsThinking(true);

    try {
      const resolvedContext = await resolveContext({ refresh: true });
      const result = await generateRoleBrief({
        context: resolvedContext,
        role,
        surface,
      });

      updateMessage(assistantMessage.id, {
        brief: result.brief,
        content: result.brief?.summary || 'Briefing selesai dibuat.',
        isStreaming: false,
        model: result.model,
      });
    } catch (briefError) {
      const message = getErrorMessage(briefError);
      console.error('[role-ai-assistant] Briefing AI gagal:', briefError);
      setError(message);
      updateMessage(assistantMessage.id, {
        content: message,
        isError: true,
        isStreaming: false,
      });
    } finally {
      setIsThinking(false);
    }
  }

  function clearConversation() {
    if (isThinking) return;
    setMessages([createMessage('assistant', profile.greeting)]);
    setError('');
    setFile(null);
    contextCacheRef.current.clear();
  }

  async function copyMessage(message) {
    if (!message.content) return;

    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(''), 1400);
    } catch {
      setError('Jawaban belum dapat disalin.');
    }
  }

  function handleFileChange(event) {
    const nextFile = event.target.files?.[0] || null;

    if (!nextFile) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)) {
      setError('Lampiran hanya mendukung JPG, PNG, atau WEBP.');
      event.target.value = '';
      return;
    }

    if (nextFile.size > 7 * 1024 * 1024) {
      setError('Ukuran lampiran maksimal 7 MB.');
      event.target.value = '';
      return;
    }

    setError('');
    setFile(nextFile);
  }

  function openAssistant() {
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 120);
  }

  return (
    <aside className="role-ai-assistant" data-ai-role={role}>
      {!isOpen ? (
        <button
          aria-label={`Buka ${profile.label}`}
          className="role-ai-launcher"
          type="button"
          onClick={openAssistant}
        >
          <span className="role-ai-launcher-orbit" aria-hidden="true" />
          <Sparkles size={19} />
          <span>
            <strong>37 AI</strong>
            <small>{profile.label}</small>
          </span>
        </button>
      ) : (
        <section
          aria-label={`${profile.label} assistant`}
          aria-modal="false"
          className="role-ai-panel"
          role="dialog"
        >
          <header className="role-ai-header">
            <div className="role-ai-mark" aria-hidden="true">
              <Sparkles size={18} />
            </div>
            <div>
              <span>{profile.eyebrow}</span>
              <strong>37 AI {profileName ? `· ${profileName}` : ''}</strong>
            </div>
            <span className="role-ai-live"><i /> Gemini</span>
            <button
              aria-label="Bersihkan percakapan AI"
              disabled={isThinking}
              title="Bersihkan percakapan"
              type="button"
              onClick={clearConversation}
            >
              <Trash2 size={16} />
            </button>
            <button
              aria-label="Tutup 37 AI"
              disabled={isThinking}
              type="button"
              onClick={() => setIsOpen(false)}
            >
              <ChevronDown size={18} />
            </button>
          </header>

          <div className="role-ai-context-bar">
            <ShieldCheck size={14} />
            <span>Context-aware · read-only · permission scoped</span>
            <b>{surface || 'portal'}</b>
          </div>

          <div className="role-ai-messages" ref={messageListRef} aria-live="polite">
            {messages.map((message) => (
              <article
                className={[
                  'role-ai-message',
                  `is-${message.role}`,
                  message.isError ? 'is-error' : '',
                ].filter(Boolean).join(' ')}
                key={message.id}
              >
                {message.role === 'assistant' ? (
                  <span className="role-ai-message-avatar" aria-hidden="true">
                    <Bot size={15} />
                  </span>
                ) : null}
                <div>
                  {message.attachmentName ? (
                    <span className="role-ai-attachment-label">
                      <Paperclip size={12} />
                      {message.attachmentName}
                    </span>
                  ) : null}
                  {message.brief ? (
                    <AiBrief brief={message.brief} />
                  ) : message.content ? (
                    <AiMessageText content={message.content} />
                  ) : message.isStreaming ? (
                    <span className="role-ai-thinking">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : null}
                  {message.role === 'assistant' && message.content && !message.isStreaming ? (
                    <footer>
                      <small>{message.model || '37 AI'}</small>
                      <button
                        aria-label="Salin jawaban AI"
                        type="button"
                        onClick={() => copyMessage(message)}
                      >
                        {copiedMessageId === message.id ? <Check size={13} /> : <Clipboard size={13} />}
                      </button>
                    </footer>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {messages.length <= 1 ? (
            <div className="role-ai-suggestions">
              <button disabled={isThinking} type="button" onClick={generateBrief}>
                <BrainCircuit size={15} />
                Buat briefing otomatis
              </button>
              {profile.suggestions.map((suggestion) => (
                <button
                  disabled={isThinking}
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                >
                  <MessageCircleMore size={14} />
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          {file ? (
            <div className="role-ai-file-preview">
              <img alt="Preview lampiran untuk AI" src={filePreviewUrl} />
              <span>
                <strong>{file.name}</strong>
                <small>{Math.max(1, Math.round(file.size / 1024))} KB · tidak disimpan aplikasi</small>
              </span>
              <button aria-label="Hapus lampiran" type="button" onClick={() => setFile(null)}>
                <X size={15} />
              </button>
            </div>
          ) : null}

          {error ? (
            <div className="role-ai-error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
              <button aria-label="Tutup error AI" type="button" onClick={() => setError('')}>
                <X size={14} />
              </button>
            </div>
          ) : null}

          <footer className="role-ai-composer">
            <div>
              <textarea
                aria-label="Tulis pesan untuk 37 AI"
                disabled={isThinking}
                maxLength={6000}
                placeholder={`Tanya ${profile.label}...`}
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <div>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  ref={fileInputRef}
                  tabIndex={-1}
                  type="file"
                  onChange={handleFileChange}
                />
                <button
                  aria-label="Lampirkan gambar untuk dianalisis AI"
                  disabled={isThinking}
                  title="Analisis gambar"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={17} />
                </button>
                <span>Enter untuk kirim · Shift+Enter baris baru</span>
                <button
                  aria-label="Kirim ke 37 AI"
                  className="role-ai-send"
                  disabled={isThinking || (!input.trim() && !file)}
                  type="button"
                  onClick={() => sendMessage()}
                >
                  {isThinking ? <LoaderCircle className="is-spinning" size={17} /> : <Send size={17} />}
                </button>
              </div>
            </div>
            <p>
              <Sparkles size={11} />
              AI dapat keliru. Verifikasi data penting sebelum mengambil tindakan.
            </p>
          </footer>
        </section>
      )}
    </aside>
  );
}
