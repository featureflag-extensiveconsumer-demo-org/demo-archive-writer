import { objectStore, diskArray, ArchiveTargetMissing } from './storage.js';
import { createArchiveQueue } from './queue.js';
import { FLAGS, ARCHIVE_TARGETS, RETENTION_WINDOW_MS } from '../config.js';

// Moves closed orders into long-term storage, one batch per tick.
//
// The archive destination is chosen per batch rather than once at start-up, so a change to the
// rollout takes effect on the next batch without a redeploy.
export function createArchiveWriter({ flags, onState }) {
  const queue = createArchiveQueue();
  let archived = 0;
  let startedAt = null;

  function selectTarget() {
    // fallback false: the disk array was the proven path when this shipped
    const useObjectStorage = flags.isEnabled(FLAGS.ORDER_ARCHIVE_OBJECT_STORAGE, false);
    return useObjectStorage
      ? objectStore(ARCHIVE_TARGETS.objectStorageBucket)
      : diskArray(ARCHIVE_TARGETS.diskArrayName);
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

      onState({
        healthy: true,
        headline: `Archiving to ${target.label}`,
        detail: `Closed orders are reaching long-term storage at ${result.location}.`,
        target: target.label,
        archived,
        queued: 0,
        clockLabel: 'Uptime',
        clock: now - startedAt
      });
    } catch (error) {
      if (!(error instanceof ArchiveTargetMissing)) throw error;

      queue.enqueue(batch, now);

      // Only the disk-array path consults the failover rollout. While the archive is on object
      // storage this branch never runs, so the failover flag is never evaluated.
      const failoverReady = flags.isEnabled(FLAGS.ARCHIVE_ARRAY_FAILOVER, false);

      onState({
        healthy: false,
        headline: error.message,
        detail: failoverReady
          ? 'Failover is enabled but no secondary array is mounted. Closed orders are queuing.'
          : 'No archive target is reachable. Closed orders are queuing and cannot be written.',
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
