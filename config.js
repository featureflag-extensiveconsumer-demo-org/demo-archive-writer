// Runtime configuration for the order archive writer.
//
// The LaunchDarkly client-side ID is not a secret: it identifies an environment to client-side
// SDKs and is published with every browser bundle. Server-side SDK keys and mobile keys are
// secrets and must never appear here.
export const LAUNCHDARKLY_CLIENT_SIDE_ID = '6a80dd8bcc3c650a840adfe0';

// This writer is one long-lived worker, so it reports itself as a single service context rather
// than as a user. One stable key keeps the monthly active count at one however many instances run.
export const SERVICE_CONTEXT = { kind: 'service', key: 'order-archive-writer-01' };

export const FLAGS = {
  ORDER_ARCHIVE_OBJECT_STORAGE: 'demo-order-archive-object-storage',
  ARCHIVE_ARRAY_FAILOVER: 'demo-archive-array-failover'
};

export const ARCHIVE_TARGETS = {
  objectStorageBucket: 'orders-archive-eu',
  diskArrayName: 'arch-array-01'
};

// One batch of closed orders every two seconds.
export const TICK_MS = 2000;

// Re-identifying on a short interval refreshes flag state even if a streaming update is missed.
//
// Measured 2026-09-17 over five archive and restore cycles: a rollout change usually arrives over
// the stream in well under a second, but twice in five the stream delivered nothing and the writer
// only noticed on the next re-identify, at 10.2 s and 11.3 s. Archiving a flag appears to drop the
// streaming connection rather than push a change. Three seconds bounds that worst case without
// changing the monthly active count, which is keyed on the context and not on the call.
export const IDENTIFY_INTERVAL_MS = 3000;

// Closed orders must reach long-term storage within this window or the retention policy is breached.
export const RETENTION_WINDOW_MS = 36 * 60 * 60 * 1000;
