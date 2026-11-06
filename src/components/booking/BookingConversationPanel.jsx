import { useEffect, useMemo, useState } from 'react';
import '../../styles/modules/booking.css';
import { MessageCircle, Send } from 'lucide-react';
import { bookingCommunicationRepository } from '../../services/bookingCommunicationRepository.js';

function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

export default function BookingConversationPanel({ booking, role, user }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(booking?.id && user?.uid));
  const [loadError, setLoadError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    if (!booking?.id || !user?.uid) {
      setMessages([]);
      setIsLoading(false);
      setLoadError('');
      return undefined;
    }

    let active = true;
    setMessages([]);
    setIsLoading(true);
    setLoadError('');

    try {
      const unsubscribe = bookingCommunicationRepository.subscribeBookingMessages(
        { booking, role, user },
        (nextMessages) => {
          if (!active) return;
          setMessages(nextMessages);
          setIsLoading(false);
          setLoadError('');
        },
        () => {
          if (!active) return;
          setIsLoading(false);
          setLoadError('Percakapan belum dapat dimuat. Periksa koneksi lalu coba lagi.');
        }
      );

      return () => {
        active = false;
        unsubscribe?.();
      };
    } catch (error) {
      console.error('Gagal memasang subscription percakapan:', error);
      setIsLoading(false);
      setLoadError('Percakapan belum dapat dimuat. Periksa koneksi lalu coba lagi.');
      return () => {
        active = false;
      };
    }
  }, [booking, role, user, retryVersion]);

  const unreadMessages = useMemo(
    () => messages.filter((message) => message[role === 'admin' ? 'readByAdmin' : 'readByClient'] === false),
    [messages, role]
  );

  useEffect(() => {
    if (!booking?.id || !unreadMessages.length) return;

    bookingCommunicationRepository.markBookingMessagesRead({ booking, messages: unreadMessages, role })
      .catch((error) => console.error('Gagal menandai pesan telah dibaca:', error));
  }, [booking, role, unreadMessages]);

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanDraft = draft.trim();
    if (!cleanDraft || isSending) return;

    setIsSending(true);
    setErrorMessage('');

    try {
      await bookingCommunicationRepository.sendBookingMessage({ booking, role, text: cleanDraft, user });
      setDraft('');
    } catch (error) {
      console.error('Gagal mengirim pesan booking:', error);
      setErrorMessage('Pesan belum berhasil dikirim. Isi pesan tetap tersimpan agar bisa dicoba lagi.');
    } finally {
      setIsSending(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <section className={'booking-conversation is-' + role} aria-label="Komunikasi booking">
      <header className="booking-conversation-head">
        <span><MessageCircle size={15} /> Komunikasi Booking</span>
        <small>Real-time</small>
      </header>

      <div aria-busy={isLoading} aria-live="polite" className="booking-conversation-list">
        {isLoading ? (
          <div className="booking-conversation-empty" role="status">Memuat percakapan…</div>
        ) : loadError ? (
          <div className="booking-conversation-load-error" role="alert">
            <span>{loadError}</span>
            <button onClick={() => setRetryVersion((value) => value + 1)} type="button">
              Coba lagi
            </button>
          </div>
        ) : messages.length ? messages.map((message) => (
          <article className={message.senderRole === role ? 'is-own' : 'is-other'} key={message.id}>
            <div>
              <strong>{message.senderRole === 'admin' ? 'Admin Studio' : message.senderName}</strong>
              <time>{formatMessageTime(message.createdAt)}</time>
            </div>
            <p>{message.text}</p>
          </article>
        )) : (
          <div className="booking-conversation-empty">Belum ada pesan. Mulai percakapan untuk booking ini.</div>
        )}
      </div>

      <form className="booking-conversation-form" onSubmit={handleSubmit}>
        <textarea
          aria-label="Tulis pesan booking"
          maxLength={600}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder={role === 'admin' ? 'Balas client…' : 'Tulis pesan untuk admin… (Enter untuk kirim, Shift+Enter untuk baris baru)'}
          rows={2}
          value={draft}
        />
        <button disabled={!draft.trim() || isSending} type="submit">
          <Send size={14} />
          {isSending ? 'Mengirim' : 'Kirim'}
        </button>
      </form>

      {errorMessage ? <p className="booking-conversation-error" role="alert">{errorMessage}</p> : null}
    </section>
  );
}
