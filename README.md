# order-archive-writer

Moves closed orders into long-term storage. Runs as a single long-lived worker, taking one batch of
closed orders every two seconds and writing it to the current archive destination.

A browser build of the worker is published at
<https://featureflag-extensiveconsumer-demo-org.github.io/demo-archive-writer/> so the service's
state can be watched without shell access to the host.

## Archive destinations

| Destination | Status |
| --- | --- |
| `orders-archive-eu` (object storage) | current |
| `arch-array-01` (disk array, old data centre) | decommissioned |

The disk array is what this service was written against on day one. The migration to object storage
shipped behind a flag, the rollout finished, and the array was later decommissioned with the data
centre it lived in. The code that chooses between them is still in `src/writer.js`.

## Feature flags

| Key | Decides | Fallback in code |
| --- | --- | --- |
| `demo-order-archive-object-storage` | object storage instead of the disk array | `false` |
| `demo-archive-array-failover` | secondary array failover, read only on the disk-array path | `false` |

The fallback is the value each call site uses when the flag cannot be evaluated, which is also what
it receives if the flag no longer exists. Both fallbacks are `false`, chosen when the disk array was
the proven path. That is no longer a safe default, and the flag has not been removed from the code,
which is the state this repository is in.

Flag keys and the LaunchDarkly client-side ID live in `config.js`. The client-side ID is not a
secret: it identifies an environment to client-side SDKs and ships in every browser bundle. No
server-side SDK key, mobile key or API token belongs in this repository.

## Running it locally

No build step and no dependencies. Serve the directory over HTTP, because the modules are loaded as
ES modules and will not load from `file://`:

```bash
python3 -m http.server 8731
```

Then open <http://127.0.0.1:8731/>.

Append `?flag=<key>` to point the archive decision at a different flag key without a redeploy.

## Layout

```text
index.html          the worker's status panel
style.css
config.js           client-side ID, context, flag keys, timings
src/app.js          wiring and rendering
src/flags.js        LaunchDarkly client wrapper
src/writer.js       the batch loop and the archive decision
src/storage.js      object storage and disk array adapters
src/queue.js        closed orders not yet archived
src/format.js       status line helpers
```

## About this repository

It belongs to a synthetic organisation built to demonstrate feature-flag lifecycle problems. Every
identifier, order count and destination here is invented, and no real system is behind it.

Licensed under the MIT Licence. See `LICENSE`.
