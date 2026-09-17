import { IDENTIFY_INTERVAL_MS } from '../config.js';

// Thin wrapper over the LaunchDarkly client-side SDK.
//
// Evaluation is synchronous once the client is ready, so callers ask per batch rather than
// caching a decision at start-up. Every call supplies the fallback the caller wants if the flag
// cannot be evaluated, which is also what it receives if the flag no longer exists.
export function createFlagClient({ clientSideId, context, resolveKey, onReady, onChange, onStatus }) {
  const client = window.LDClient.initialize(clientSideId, context, {
    // Evaluation reasons are not needed and streaming is what makes a targeting change visible
    // to a running worker without a restart.
    streaming: true,
    sendEventsOnlyForVariation: false
  });

  const key = (logical) => (resolveKey ? resolveKey(logical) : logical);

  client.on('ready', () => {
    onStatus('connected');
    if (onReady) onReady();
  });

  client.on('failed', (error) => {
    onStatus(`connection failed: ${error && error.message ? error.message : 'unknown'}`);
  });

  client.on('error', (error) => {
    onStatus(`error: ${error && error.message ? error.message : 'unknown'}`);
  });

  // A change to any flag this client can see. The writer picks the new value up on its next batch.
  client.on('change', (changes) => {
    if (onChange) onChange(Object.keys(changes));
  });

  // Re-identifying with the same context refreshes the flag set even if a streaming update was
  // missed, for instance after a suspend or a dropped connection.
  const identifyTimer = setInterval(() => {
    client.identify(context).catch(() => onStatus('re-identify failed'));
  }, IDENTIFY_INTERVAL_MS);

  return {
    isEnabled(logicalKey, fallback) {
      return client.variation(key(logicalKey), fallback);
    },

    waitUntilReady() {
      return client.waitForInitialization(5);
    },

    stop() {
      clearInterval(identifyTimer);
      return client.close();
    }
  };
}
