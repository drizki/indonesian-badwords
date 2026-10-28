<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import { createModerator, initialMessage } from '../shared/moderation';

const moderator = createModerator();
const message = ref(initialMessage);
const quote = ref('');
const view = shallowRef(moderator.check(initialMessage));
function update(field: 'message' | 'quote', event: Event) {
  const value = (event.target as HTMLTextAreaElement).value;
  if (field === 'message') message.value = value;
  else quote.value = value;
  view.value = moderator.check(message.value, quote.value);
}
</script>

<template>
  <main>
    <h1>Moderate a message</h1>
    <p>Baju Bodo is allowed. The quoted text is excluded; the message stays checked.</p>
    <label for="quote">Quoted text</label>
    <textarea id="quote" :value="quote" @input="update('quote', $event)"></textarea>
    <label for="message">Message</label>
    <textarea id="message" :value="message" @input="update('message', $event)"></textarea>
    <p role="status">{{ view.status === 'complete' ? `${view.result.occurrenceCount} matches` : 'Check incomplete' }}</p>
    <p v-if="view.status === 'error'" role="alert">{{ view.error }}</p>
    <section v-else>
      <h2>Censored</h2><pre data-testid="censored">{{ view.result.censored }}</pre>
      <h2>Original highlights</h2>
      <div data-testid="highlights"><template v-for="(segment, index) in view.segments" :key="index"><mark v-if="segment.matched">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span></template></div>
      <h2>Locations (UTF-16)</h2><pre data-testid="locations">{{ JSON.stringify(view.result.locations, null, 2) }}</pre>
    </section>
  </main>
</template>
