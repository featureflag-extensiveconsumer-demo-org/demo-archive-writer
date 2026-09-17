// Presentation helpers for the writer's status line.

export function duration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

export function count(value) {
  return new Intl.NumberFormat('en-GB').format(value);
}

export function orders(value) {
  return `${count(value)} ${value === 1 ? 'order' : 'orders'}`;
}
