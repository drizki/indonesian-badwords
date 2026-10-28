import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createModerator, initialMessage } from '../shared/moderation';
import '../shared/style.css';

function App() {
  const [moderator] = useState(() => createModerator());
  const [message, setMessage] = useState(initialMessage);
  const [quote, setQuote] = useState('');
  const [view, setView] = useState(() => moderator.check(initialMessage));
  function update(nextMessage: string, nextQuote: string) {
    setMessage(nextMessage);
    setQuote(nextQuote);
    setView(moderator.check(nextMessage, nextQuote));
  }
  return <main>
    <h1>Moderate a message</h1>
    <p>Baju Bodo is allowed. The quoted text is excluded; the message stays checked.</p>
    <label htmlFor="quote">Quoted text</label>
    <textarea id="quote" value={quote} onChange={event => update(message, event.target.value)} />
    <label htmlFor="message">Message</label>
    <textarea id="message" value={message} onChange={event => update(event.target.value, quote)} />
    <p role="status">{view.status === 'complete' ? `${view.result.occurrenceCount} matches` : 'Check incomplete'}</p>
    {view.status === 'error' ? <p role="alert">{view.error}</p> : <section>
      <h2>Censored</h2><pre data-testid="censored">{view.result.censored}</pre>
      <h2>Original highlights</h2><div data-testid="highlights">{view.segments.map((segment, index) =>
        segment.matched ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>)}</div>
      <h2>Locations (UTF-16)</h2><pre data-testid="locations">{JSON.stringify(view.result.locations, null, 2)}</pre>
    </section>}
  </main>;
}
createRoot(document.getElementById('app')!).render(<StrictMode><App /></StrictMode>);
