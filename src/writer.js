import { objectStore, diskArray, ArchiveTargetMissing } from './storage.js';
import { createArchiveQueue } from './queue.js';
import { FLAGS, ARCHIVE_TARGETS, RETENTION_WINDOW_MS } from '../config.js';

// Moves closed orders into long-term storage, one batch per tick.
//
// The archive destination is chosen per batch rather than once at start-up, so a change to either
// rollout takes effect on the next batch without a redeploy.
export function createArchiveWriter({ flags, failoverFlagKey, onState }) {
  const queue = createArchiveQueue();
  let archived = 0;
  let startedAt = null;

  function selectTarget() {
    // fallback false: the disk array was the proven path when this shipped
    const useObjectStorage = flags.isEnabled(FLAGS.ORDER_ARCHIVE_OBJECT_STORAGE, false);
    if (useObjectStorage) return objectStore(ARCHIVE_TARGETS.objectStorageBucket);

    // On the disk-array path, which array to use depends on whether the failover rollout finished.
    // fallback false: before failover shipped, the primary array was the only place orders went.
    // A writer with no failover rollout configured stays on the primary.
    const failoverComplete = failoverFlagKey ? flags.isEnabled(failoverFlagKey, false) : false;
    return diskArray(failoverComplete
      ? ARCHIVE_TARGETS.failoverDiskArray
      : ARCHIVE_TARGETS.primaryDiskArray);
  }

  function closedOrdersSince() {
    // Closed-order volume is bursty; the writer sizes each batch from what the order service
    // reports rather than assuming a fixed rate.
    return 3 + Math.floor(Math.random() * 6);
  }

  function tick(now) {
    if (startedAt === null) startedAt = now;
    const batch = closedOrdersSince();
    const target = selectTarget();

    try {
      target.connect();
      const pending = queue.depth + batch;
      const result = target.write(new Array(pending));
      archived += result.accepted;
      queue.clear();

      const onObjectStorage = target.kind === 'object-storage';
      onState({
        mode: onObjectStorage ? 'ok' : 'degraded',
        headline: `Archiving to ${target.label}`,
        detail: onObjectStorage
          ? `Closed orders are reaching long-term storage at ${result.location}.`
          : `Object storage is not in use. Orders are going to the failover array in ${target.site}, at ${result.location}.`,
        target: target.label,
        archived,
        queued: 0,
        clockLabel: 'Uptime',
        clock: now - startedAt
      });
    } catch (error) {
      if (!(error instanceof ArchiveTargetMissing)) throw error;

      queue.enqueue(batch, now);

      onState({
        mode: 'fallback',
        headline: error.message,
        detail: 'No archive target is reachable. Closed orders are queuing and cannot be written.',
        target: target.label,
        archived,
        queued: queue.depth,
        clockLabel: 'Retention breach in',
        clock: queue.remainingBefore(RETENTION_WINDOW_MS, now)
      });
    }
  }

  return { tick };
}
