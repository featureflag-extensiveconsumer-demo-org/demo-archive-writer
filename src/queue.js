// Orders that have been closed but not yet written to long-term storage.
//
// The queue is in memory on purpose: it is a holding area between the order service and the
// archive, not a store of record. Anything still here when the retention window closes is a
// compliance problem, so the writer reports its depth and its oldest entry.

export function createArchiveQueue() {
  let depth = 0;
  let oldestEnqueuedAt = null;

  return {
    get depth() {
      return depth;
    },

    get oldestEnqueuedAt() {
      return oldestEnqueuedAt;
    },

    enqueue(count, now) {
      if (count <= 0) return;
      if (depth === 0) oldestEnqueuedAt = now;
      depth += count;
    },

    clear() {
      depth = 0;
      oldestEnqueuedAt = null;
    },

    // Time left before the oldest queued order breaches the retention window.
    remainingBefore(retentionWindowMs, now) {
      if (oldestEnqueuedAt === null) return retentionWindowMs;
      return Math.max(0, retentionWindowMs - (now - oldestEnqueuedAt));
    }
  };
}
