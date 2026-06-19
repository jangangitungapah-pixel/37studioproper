import { useEffect, useMemo, useState } from 'react';
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
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!booking?.id || !user?.uid) return undefined;

    return bookingCommunicationRepository.subscribeBookingMessages(
      { booking, role, user },
      setMessages,
      () => setErrorMessage('Percakapan belum dapat dimuat.')
    );
  }, [booking, role, user]);

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
      setErrorMessage('Pesan belum berhasil dikirim.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className={'booking-conversation is-' + role} aria-label="Komunikasi booking">
      <header className="booking-conversation-head">
        <span><MessageCircle size={15} /> Komunikasi Booking</span>
        <small>Real-time</small>
      </header>

      <div className="booking-conversation-list" aria-live="polite">
        {messages.length ? messages.map((message) => (
          <article className={message.senderRole === role ? 'is-own' : 'is-other'} key={message.id}>
            <div><strong>{message.senderRole === 'admin' ? 'Admin Studio' : message.senderName}</strong><time>{formatMessageTime(message.createdAt)}</time></div>
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
          placeholder={role === 'admin' ? 'Balas client...' : 'Tulis pesan untuk admin...'}
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
