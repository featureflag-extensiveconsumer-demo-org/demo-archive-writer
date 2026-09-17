# order-archive-writer

Moves closed orders into long-term storage. Runs as a single long-lived worker, taking one batch of
closed orders every two seconds and writing it to the current archive destination.

A browser build of the worker is published at
<https://featureflag-extensiveconsumer-demo-org.github.io/demo-archive-writer/> so the service's
state can be watched without shell access to the host.

## Archive destinations

| Destination | Site | Status |
| --- | --- | --- |
| `orders-archive-eu` (object storage) | eu | current |
| `arch-array-07` (disk array) | dc-eu-2 | online, failover target |
| `arch-array-01` (disk array) | dc-legacy-1 | retired with the site |

The disk array is what this service was written against on day one. The migration to object storage
shipped behind a flag, the rollout finished, and `arch-array-01` was later retired with the data
centre it stood in. A second rollout moved the disk path onto `arch-array-07` so that failing back
off object storage stays possible. The code that chooses between all three is in `src/writer.js`.

## Feature flags

| Key | Decides | Fallback in code |
| --- | --- | --- |
| `demo-order-archive-object-storage` | object storage instead of the disk path | `false` |
| `demo-archive-array-failover` | the disk path uses `arch-array-07` instead of `arch-array-01` | `false` |

The second flag is read **only** on the disk path, so while object storage is in use it is never
evaluated at all. Its fallback is `false`, meaning "failover was never rolled out", which sends the
writer to the retired array. Both rollouts are long finished, so neither fallback describes the
world the service actually runs in.

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

Append `?flag=<key>` to point the archive decision at a different flag key without a redeploy, and
`?failover=<key>` to do the same for the failover decision. Overriding the archive flag without
naming a failover flag leaves failover unconfigured, and an unconfigured failover is never looked up.

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
