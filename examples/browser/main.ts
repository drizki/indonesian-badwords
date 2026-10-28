import { createModerator, initialMessage } from '../shared/moderation';
import '../shared/style.css';

const moderator = createModerator();
// Only this fixed template uses HTML. User text always goes into text nodes.
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <h1>Moderate a message</h1>
  <p>Baju Bodo is allowed. The quoted text is excluded; the message stays checked.</p>
  <label for="quote">Quoted text</label><textarea id="quote"></textarea>
  <label for="message">Message</label><textarea id="message"></textarea>
  <p role="status"></p><p role="alert" hidden></p>
  <section id="results"><h2>Censored</h2><pre data-testid="censored"></pre>
  <h2>Original highlights</h2><div data-testid="highlights"></div>
  <h2>Locations (UTF-16)</h2><pre data-testid="locations"></pre></section>`;
const message = document.querySelector<HTMLTextAreaElement>('#message')!;
const quote = document.querySelector<HTMLTextAreaElement>('#quote')!;
const status = document.querySelector<HTMLElement>('[role="status"]')!;
const error = document.querySelector<HTMLElement>('[role="alert"]')!;
const results = document.querySelector<HTMLElement>('#results')!;
const highlights = document.querySelector<HTMLElement>('[data-testid="highlights"]')!;
function update() {
  const view = moderator.check(message.value, quote.value);
  const complete = view.status === 'complete';
  results.hidden = !complete;
  error.hidden = complete;
  status.textContent = complete ? `${view.result.occurrenceCount} matches` : 'Check incomplete';
  error.textContent = complete ? '' : view.error;
  highlights.replaceChildren();
  document.querySelector('[data-testid="censored"]')!.textContent = complete ? view.result.censored : '';
  document.querySelector('[data-testid="locations"]')!.textContent = complete ? JSON.stringify(view.result.locations, null, 2) : '';
  if (complete) for (const segment of view.segments) {
    const node = segment.matched ? document.createElement('mark') : document.createTextNode('');
    node.textContent = segment.text;
    highlights.append(node);
  }
}
message.value = initialMessage;
message.addEventListener('input', update);
quote.addEventListener('input', update);
update();
