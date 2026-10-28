<script lang="ts">
  import { createModerator, initialMessage } from '../shared/moderation';
  const moderator = createModerator();
  let message = $state(initialMessage);
  let quote = $state('');
  let view = $state(moderator.check(initialMessage));
  function update(field: 'message' | 'quote', event: Event) {
    const value = (event.target as HTMLTextAreaElement).value;
    if (field === 'message') message = value;
    else quote = value;
    view = moderator.check(message, quote);
  }
</script>

<main>
  <h1>Moderate a message</h1>
  <p>Baju Bodo is allowed. The quoted text is excluded; the message stays checked.</p>
  <label for="quote">Quoted text</label>
  <textarea id="quote" value={quote} oninput={event => update('quote', event)}></textarea>
  <label for="message">Message</label>
  <textarea id="message" value={message} oninput={event => update('message', event)}></textarea>
  <p role="status">{view.status === 'complete' ? `${view.result.occurrenceCount} matches` : 'Check incomplete'}</p>
  {#if view.status === 'error'}
    <p role="alert">{view.error}</p>
  {:else}
    <section>
      <h2>Censored</h2><pre data-testid="censored">{view.result.censored}</pre>
      <h2>Original highlights</h2>
      <div data-testid="highlights">{#each view.segments as segment}{#if segment.matched}<mark>{segment.text}</mark>{:else}<span>{segment.text}</span>{/if}{/each}</div>
      <h2>Locations (UTF-16)</h2><pre data-testid="locations">{JSON.stringify(view.result.locations, null, 2)}</pre>
    </section>
  {/if}
</main>
