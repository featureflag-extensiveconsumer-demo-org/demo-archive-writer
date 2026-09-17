// Long-term archive destinations for closed orders.
//
// Two kinds of destination exist because the archive moved out of the old data centre. Object
// storage is the current destination; the disk arrays are what this service was written against.

// The disk estate, as it stands. arch-array-01 was retired with dc-legacy-1 when that site closed;
// arch-array-07 in dc-eu-2 replaced it.
const DISK_ARRAYS = {
  'arch-array-01': { site: 'dc-legacy-1', online: false },
  'arch-array-07': { site: 'dc-eu-2', online: true }
};

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
  const array = DISK_ARRAYS[arrayName];
  const reachable = Boolean(array && array.online);
  return {
    kind: 'disk-array',
    name: arrayName,
    label: `disk array ${arrayName}`,
    site: array ? array.site : null,
    connect() {
      // A retired array has nothing answering on the storage network, so the mount never comes up.
      if (!reachable) throw new ArchiveTargetMissing(arrayName);
      return { mount: `/mnt/${arrayName}`, site: array.site };
    },
    write(orders) {
      if (!reachable) throw new ArchiveTargetMissing(arrayName);
      return { accepted: orders.length, location: `/mnt/${arrayName}/orders` };
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
