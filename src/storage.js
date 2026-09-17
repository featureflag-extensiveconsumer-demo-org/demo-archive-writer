// Long-term archive destinations for closed orders.
//
// Two adapters exist because the archive moved out of the old data centre. The object store is
// the current destination; the disk array is what this service was written against on day one.

export function objectStore(bucket) {
  return {
    kind: 'object-storage',
    name: bucket,
    label: `object storage ${bucket}`,
    connect() {
      return { endpoint: `s3://${bucket}`, durable: true };
    },
    write(orders) {
      return { accepted: orders.length, location: `s3://${bucket}` };
    }
  };
}

export function diskArray(arrayName) {
  return {
    kind: 'disk-array',
    name: arrayName,
    label: `disk array ${arrayName}`,
    connect() {
      // The array was decommissioned with the data centre it lived in. Nothing answers on the
      // storage network any more, so the mount never comes up.
      throw new ArchiveTargetMissing(arrayName);
    },
    write() {
      throw new ArchiveTargetMissing(arrayName);
    }
  };
}

export class ArchiveTargetMissing extends Error {
  constructor(arrayName) {
    super(`PRIMARY ARCHIVE DISK ARRAY ${arrayName} IS MISSING`);
    this.name = 'ArchiveTargetMissing';
    this.arrayName = arrayName;
  }
}
