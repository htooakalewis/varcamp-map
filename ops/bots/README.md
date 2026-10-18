# Dedicated guide browser and service source

The browser source in this directory is the renderer-aware Canvas implementation used by the dedicated Lyra, Nova and Orion service. The persistent service algorithms are in [persistent-service](persistent-service/README.md). Its public release binding is unbound, so this checkout cannot authorize container operations.

Visitors use the avatar menu's **Talk to Nearby Guides** panel: choose an actual nearby guide, then type a zodiac name or select a zodiac button. Commands and replies use supported targeted `WA` events. Dedicated bots disable only their own proximity-meeting participation through `disablePlayerProximityMeeting`; native bubble chat is not a guide transport or fallback. Normal human proximity meetings, the core app and iframe SDK remain unchanged. This source contract still requires separate current live acceptance.

The old `cli.mjs` launcher is retired and exits2 before loading any provider. `manager.mjs` remains historical regression source; its name/label ownership model is not a deployment path. The old `-dev` container names and finite disposable trials do not describe the persistent service. Do not use them to adopt or control a running guide.

The image's inherited default remains `node runner.mjs`. The qualified service supplies the explicit override `node runner.mjs --renderer-mode=canvas`, with one fixed persona environment value. Bare image startup or npm start is not a supported launch path. The runner refuses missing, alternate or extra mode arguments before browser startup. The COPY closure contains config, browser session, evidence, runner, healthcheck and renderer policy, with the separately pinned Playwright dependency and browser base. Building this Dockerfile produces a new candidate image that needs its own actual content and runtime qualification.

Readiness requires current native controller progress, exact fixed identity and room, a live controller lease, captured executing response bytes, and a fresh observation of the retained initialized Canvas renderer. Every heartbeat renews that evidence. Native exceptions and late asynchronous completions cannot restore a terminal runner. Atomic runtime health is published at `/tmp/lyra-health.json`; the service reads that mounted publication through its fixed bounded Node reader, while immutable rootfs sources use the separate bounded TAR path.

The service uses one explicit Lyra, Nova or Orion slot per transaction and private immutable-ID ownership, complete configuration/security checks, a durable journal and current evidence. The private installation, release binding, actual image/content receipts, protected host baseline, plan and journals are intentionally absent. Public tests use synthetic peers and grant no production authority. Ordinary Git checkout modes are not private installation modes; keep the verifier unchanged.

Focused offline checks from the repository root:

```sh
node --test ops/tests/guide-publication.test.mjs ops/tests/guide-renderer.test.mjs
npx vitest run ops/tests/guide-identity-contract.test.ts ops/tests/guide-fresh-bootstrap.test.ts ops/tests/guide-session.test.ts ops/tests/guide-welcome.test.ts ops/tests/guide-observer.test.ts ops/tests/guide-profiles.test.ts ops/tests/lyra-healthcheck.test.ts ops/tests/lyra-container-config.test.ts ops/tests/lyra-launcher.test.ts tests/guide-evidence.test.ts tests/guide-retained-proofs.test.ts
python3 -I -S -B -m unittest discover -s ops/bots/persistent-service/tests
```

These checks do not call Docker, a browser or a network provider. They do not prove current shared attendees, replies or prolonged runtime reliability; those require separate actual acceptance evidence.
