import { LAUNCHDARKLY_CLIENT_SIDE_ID, SERVICE_CONTEXT, FLAGS, TICK_MS } from '../config.js';
import { createFlagClient } from './flags.js';
import { createArchiveWriter } from './writer.js';
import { duration, count, orders } from './format.js';

const panel = document.getElementById('panel');
const statusEl = document.getElementById('status');
const detailEl = document.getElementById('detail');
const archivedEl = document.getElementById('archived');
const queuedEl = document.getElementById('queued');
const clockEl = document.getElementById('clock');
const clockLabelEl = document.getElementById('clock-label');
const targetEl = document.getElementById('target');
const linkEl = document.getElementById('link');
const flagEl = document.getElementById('flagline');

// The rollout flag can be pointed at another key without a redeploy, so a rehearsal or a reserve
// flag can drive the same writer.
const requestedFlag = new URLSearchParams(window.location.search).get('flag');
const archiveFlagKey = requestedFlag || FLAGS.ORDER_ARCHIVE_OBJECT_STORAGE;
const resolveKey = (logical) =>
  logical === FLAGS.ORDER_ARCHIVE_OBJECT_STORAGE ? archiveFlagKey : logical;

flagEl.textContent = archiveFlagKey;

function render(state) {
  panel.dataset.state = state.healthy ? 'ok' : 'fallback';
  statusEl.textContent = state.headline;
  detailEl.textContent = state.detail;
  archivedEl.textContent = count(state.archived);
  queuedEl.textContent = count(state.queued);
  clockLabelEl.textContent = state.clockLabel;
  clockEl.textContent = duration(state.clock);
  targetEl.textContent = `writing to ${state.target}`;
  document.title = state.healthy
    ? 'Order archive writer'
    : `BREACH RISK - ${orders(state.queued)} queued`;
}

// The writer starts once, whether the rollout arrived or the connection failed. Starting twice
// would double the batch rate and quietly corrupt every count on screen.
let started = false;
function startWriter() {
  if (started) return;
  started = true;
  const writer = createArchiveWriter({ flags, onState: render });
  writer.tick(Date.now());
  setInterval(() => writer.tick(Date.now()), TICK_MS);
}

const flags = createFlagClient({
  clientSideId: LAUNCHDARKLY_CLIENT_SIDE_ID,
  context: SERVICE_CONTEXT,
  resolveKey,
  onStatus: (text) => { linkEl.textContent = text; },
  onChange: (keys) => {
    if (keys.includes(archiveFlagKey)) linkEl.textContent = 'rollout changed';
  },
  onReady: startWriter
});

// If LaunchDarkly cannot be reached at all, the writer still has to run: every evaluation then
// returns the fallback compiled into the call site, which is exactly what production would do.
flags.waitUntilReady().catch(() => {
  linkEl.textContent = 'no connection, using fallbacks';
  startWriter();
});
