# VarCamp Myanmar Production Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the completed VarCamp world on the existing devbox with HTTPS, guest access, authenticated staff controls, working live media and verified attendance capacity.

**Architecture:** A dedicated `varcamp` Compose project uses private volumes/networks and IP-derived HTTPS hostnames on the current public address. WorkAdventure uses LiveKit for meetings/broadcasts and Coturn for P2P relay; Keycloak issues trusted staff roles. Narrow pinned source patches enforce broadcast roles and safe Q&A revocation, because stock native podium placement alone does not provide that server boundary.

**Tech Stack:** WorkAdventure v1.34.1 (`96d43a841766b22418c061744e7ed2aafd9870d3`), its matching production Compose/template, Traefik v3.6.1, LiveKit v1.13.9, Coturn 4.18.0-r0, Keycloak 26.8.0, dedicated Postgres 17.6-alpine, Redis and iconserver from the matching deployment. Pin all image digests at execution preflight.

**Spec:** [Approved world design](../specs/2026-10-10-varcamp-world-design.md); consumes [the world build plan](2026-10-11-varcamp-world-build.md).

## Global Constraints

- Design attendance is 30–100 simultaneous people; hardware inspection is not capacity evidence. Rehearse at 30, 60 and 100 for at least twenty minutes each.
- Existing devbox applications must remain running and unexposed. Use a dedicated Compose project, private volumes, compatible ingress and authenticated map editing.
- Public guests can explore and complete quests. Editor rights, presenter rights and attendee access are configured independently.
- Both halls must broadcast independently, support screen sharing and raised-hand Q&A, and keep preparation audio separate.
- Use real HTTPS and the production deployment; maps belong to one map-storage world under `/~/varcamp/maps/`, not public `/_/` test rooms.
- Full persistent Matrix chat, recording and streaming are outside the initial release.
- Keep secrets in ignored mode-0600 files; do not put passwords, JWTs, TURN secrets, OIDC secrets or map upload keys in logs, screenshots, Git or the map bundle.
- Launch claims state the attendance and camera workload actually tested. A smaller rehearsal does not validate 100 people.
- Before changing implementation code for a failure, reproduce the stock/current failure and verify the full causal chain. Record symptom, reproduction, code/infrastructure classification, cause, fixed scope, measurable end-to-end acceptance and independent reviewer in `docs/qa/failure-register.md`. Record unrelated findings separately without expanding scope. If a related failure recurs after a fix, stop patching and reassess the design.
- Plans, unit tests and commits never establish the completed user outcome. Final reporting includes exact attendee-flow evidence, remaining blockers and actual deployment status.

## Review Focus

1. Guest clients may forge presenter state, tags or space filters; trusted backend authorization must deny broadcast publication and moderation: Task 3.
2. A revoked Q&A guest may reuse a LiveKit-refreshed token; it must not regain publication by reconnecting: Task 3.
3. A network may block UDP; both LiveKit and P2P TURN/TLS must carry usable media on TCP443: Task 2.
4. IP-derived certificate issuance, proxy routing or renewal may fail; do not launch an untrusted HTTP venue or expose unrelated containers: Task 1.
5. Room transition/reload or an untested camera mix may fail despite a green health endpoint; verify actual journeys and record capacity conditions: Tasks 4–5.

---

## Verified starting state and chosen addresses

Read-only checks found ARM64 Linux, eight logical CPUs, about 32GB RAM and 81GB free disk. TCP80/443 and proposed media ports were unused; no active nginx/Caddy/Traefik ingress was found. UFW was inactive. AWS Security Group access remains unverified. Recheck these conditions before changes.

The user chose the box's Elastic IP. Its currently observed public IPv4 is `3.1.133.135`; this confirms the address, not its AWS allocation record. Use the following individual HTTPS hosts initially, resolving to that IP:

| Service | Host |
| --- | --- |
| Venue/play | `varcamp.3-1-133-135.sslip.io` |
| Map storage | `maps.3-1-133-135.sslip.io` |
| Icon service | `icons.3-1-133-135.sslip.io` |
| LiveKit signalling | `livekit.3-1-133-135.sslip.io` |
| Staff identity | `id.3-1-133-135.sslip.io` |
| LiveKit TURN/TLS | `turn-livekit.3-1-133-135.sslip.io` |
| P2P TURN/TLS | `turn-p2p.3-1-133-135.sslip.io` |

[sslip.io/nip.io](https://nip.io/) supports IP-derived names and individual HTTP-01 certificates. Use individual certificates; no wildcard issuance is assumed. If issuance is rate-limited, switch the identical host prefixes to `nip.io` and regenerate the deployment URLs. Do not purchase a domain or launch insecure HTTP as a fallback.

Before Task 1 deployment, obtain the organiser's ACME contact email and staff login emails, and determine whether the existing AWS access can administer the instance Security Group. These are actual configuration inputs, not invented sample identities. Local map construction does not depend on them.

## Files and boundaries

| Path | Responsibility |
| --- | --- |
| `ops/compose.yml`, `ops/.env.example`, `ops/images.lock.json` | Isolated release-pinned services, variable names and immutable image references |
| `ops/traefik/{static,dynamic}.yml` | HTTPS routes, individual certificates and two TURN/TLS SNI routes |
| `ops/keycloak/varcamp-realm.json` | Realm/client configuration and trusted role-to-tags mapper; no user passwords |
| `ops/livekit.yaml`, `ops/turnserver.conf` | Media listeners, relay ranges and secret references |
| `ops/patches/{workadventure-broadcast,livekit-broadcast-refresh}.patch`, `ops/broadcast-manifest.json` | Auditable narrow patches and server-owned hall channel definitions |
| `ops/{preflight,build-images,deploy,publish,backup,restore}.sh` | Repeatable checks, scoped deployment, uploads and recovery |
| `ops/tests/` | Configuration isolation, role and real media acceptance scripts |
| `docs/qa/{deployment,roles,journeys,capacity}.md` | Actual commands, conditions, failures and results |
| `docs/operating/{hosting,rehearsal,incident-response}.md` | Practical operating and recovery instructions |

Remote application root: `/srv/varcamp`; Compose project name: `varcamp`. Existing projects and volumes are never included in stop, prune, backup or restore commands. Source builds run in a task-specific build directory and produce only the custom back and LiveKit images.

### Task 1: Isolated HTTPS venue, staff identity and production preflight

**Files:** Create `ops/compose.yml`, `ops/.env.example`, `ops/images.lock.json`, Traefik configs, Keycloak realm, `ops/preflight.sh`, `ops/tests/config-isolation.test.ts`, `docs/qa/deployment.md`.

**Interfaces:** `ops/preflight.sh` exits zero only when architecture, available ports, source/image pins, DNS and required external port checks pass; it prints no secrets. Compose exposes only named venue services and media listeners. Keycloak userinfo supplies an administrator-managed string-array `tags` claim. WorkAdventure explicitly receives `OPENID_TAGS_CLAIM=tags`, `DISABLE_ANONYMOUS=false`, an organiser-only `MAP_EDITOR_ALLOWED_USERS`, and `MAP_EDITOR_ALLOW_ALL_USERS=false`.

- [ ] Write the isolation test for the rendered Compose configuration: project-owned networks/volumes, no public database/gRPC/management port, no route to unrelated containers, no anonymous editor access, and explicit trusted tag mapping. Require `linux/arm64` for every chosen image, including the build toolchain. A fixture exposing Postgres or routing all Docker containers must fail.

```ts
expect(renderedConfig.services.back.ports ?? []).not.toContain('50051:50051');
expect(renderedConfig.services.play.environment.MAP_EDITOR_ALLOW_ALL_USERS).toBe('false');
expect(renderedConfig.services.play.environment.OPENID_TAGS_CLAIM).toBe('tags');
```
- [ ] Run `npm test -- ops/tests/config-isolation.test.ts`; confirm failure before configuration exists.
- [ ] Adapt the v1.34.1 production Compose and environment template; retain only required services. Create dedicated secrets and private files, Keycloak plus its own Postgres, Redis, map storage and icons. Use the pinned optional-chat settings verified in the source to omit Matrix. Traefik takes TCP80/443 with HTTP-01 and routes only VarCamp-labelled services. Create named staff accounts using the supplied emails; organiser roles control editor access, speaker roles do not automatically grant editing.
- [ ] Recheck devbox state, image manifests and all host DNS; record digests. Verify AWS port reachability from outside. Deploy only this project after missing inputs are resolved. Require trusted HTTPS without bypass flags, certificate renewal configuration, successful guest entry and staff OIDC login, and unrelated application health unchanged. Keep gRPC50051 and databases private. No public event invitation yet.
- [ ] Commit non-secret configuration and actual preflight evidence: `ops: establish isolated HTTPS VarCamp services`.

### Task 2: Native media and two verified TURN paths

**Files:** Create `ops/livekit.yaml`, `ops/turnserver.conf`, `ops/tests/media-paths.ts`, `docs/qa/media.md`; extend Compose and Traefik routing.

**Interfaces:** LiveKit signalling is privately proxied from7880; public ICE TCP7881 and UDP mux7882. Its embedded TURN listens internally on5349 with external TLS and trusted PROXYv2 from loopback, advertising the `turn-livekit` host on443. Coturn uses REST shared-secret credentials, public UDP3478 and a private TCP PROXYv2 listener3479 routed by the `turn-p2p` hostname on443. Selected relay ranges are LiveKit40000–40999 and Coturn55000–55999; verify the pinned configurations actually allocate from those ranges.

- [ ] Write configuration assertions that the two TURN hosts/ranges are distinct, both TLS routes use the correct SNI and backend listener, and no management/signalling listener is accidentally public. Define real media checks for direct UDP, UDP-blocked LiveKit relay and UDP-blocked P2P relay; a signalling connection without audible media fails.

```ts
expect(livekitTurnHost).not.toBe(p2pTurnHost);
expect(observedLivekitRelay.transport).toBe('tcp');
expect(observedP2pRelay.transport).toBe('tcp');
expect(audibleMediaChecks.every(result => result.passed)).toBe(true);
```
- [ ] Run the config checks before implementation; require expected failure. Confirm the pinned LiveKit source advertises TURN443 rather than assuming its5349 listener is the public port.
- [ ] Configure host networking only where needed, private signalling/backend listeners, both Traefik TCP TLS routes and PROXYv2, trusted proxy restrictions and isolated shared secrets. Keep Coturn on the private bridge with its TCP proxy listener mapped to host loopback only, UDP3478 and matching relay ports published, and its configured external/private IP mapping; verify NAT/candidate correctness. Open only required inbound AWS ports: TCP80/443/7881, UDP7882/3478 and the selected relay ranges; never change unrelated rules. WorkAdventure receives the P2P TURN URLs and LiveKit signalling/API configuration from its matching env template. Diagnose SG, DNS, certificates, candidates and relay connectivity before any code change for a media failure.
- [ ] Run actual two-browser conversations and screen sharing on direct and restricted-network paths. Inspect candidate selection without exposing credentials, verify LiveKit relayed media and a separate proximity bubble relayed through Coturn, and include Firefox where possible. Confirm restarts preserve configuration and certificates. Record any external AWS administration that could not be completed instead of claiming media ready.
- [ ] Commit: `ops: verify direct and relayed venue media`.

### Task 3: Enforced broadcast roles and revocable guest Q&A

**Files:** Create both patch files, `ops/broadcast-manifest.json`, `ops/build-images.sh`, `ops/tests/broadcast-authorization.test.ts`, `ops/tests/livekit-revocation.ts`, `docs/qa/roles.md`; update image locks. Patches touch the pinned WorkAdventure back files `Services/SocketManager.ts`, `Model/Space.ts`, `Model/RaiseHandManager.ts`, `Model/Strategies/LivekitCommunicationStrategy.ts`, `Model/Services/LivekitService.ts`, `App.ts`, and proposed `Controller/LivekitParticipantWebhookController.ts` / `Model/Services/BroadcastAuthorization.ts`. Add pinned-source tests `back/tests/BroadcastAuthorization.test.ts` and `back/tests/LivekitParticipantWebhookController.test.ts`. LiveKit changes target `pkg/service/roommanager.go` token refresh and `pkg/service/roommanager_test.go`.

**Interfaces:** This task depends on the world plan's committed hall WAMs. Define backend `canBroadcast(trustedTags:readonly string[],hasFloor:boolean):boolean`, allowing `speaker`, `organizer` or `admin`, or an authoritative floor holder. Server-owned broadcast channel registry records the two WAM stage IDs, their actual `${world}.${slug}` keys and required `LIVE_STREAMING_USERS` filter. Define LiveKit helper `sanitizeBroadcastRefreshClaims(grants *auth.ClaimGrants) *auth.ClaimGrants` using `grants.Clone()`. The SFU token attribute `varcamp.broadcastRole` is `listener` or `presenter`, set only from server-held identity; a guest remains `listener` while holding the floor. Listener initial/refreshed JWTs never carry publication grants; live guest-floor permissions are granted/revoked through `RoomServiceClient.updateParticipant`.

- [ ] Write unit/integration cases denying guest forged `megaphoneState`, forged staff tags, client-declared `state.kind`, and known podium names with an `ALL_USERS` filter. Allow trusted staff start/stop, guest floor grant followed by revoke, and ordinary workshop publication. Deny guest moderation. The SFU test must capture the token refreshed during guest promotion, revoke the floor, reconnect directly with that token, and require publication denial while audience subscription still works.

```ts
expect(canBroadcast([], false)).toBe(false);
expect(canBroadcast(['speaker'], false)).toBe(true);
expect(canBroadcast([], true)).toBe(true); // server-owned floor grant
```
- [ ] On an isolated stock deployment, reproduce guest presenter publication and promoted-token replay before patching implementation. Trace authenticated/guest identity → space name/filter → backend state/moderation → minted/refreshed claims → SFU track publication. Confirm TLS/networking is functioning independently, use ordinary meetings as a control, and record the causal evidence and fixed scope. Prepare the stock source's locked build/test dependencies and protobufs using its existing instructions. Run `npm run test --workspace=workadventureback -- --run tests/BroadcastAuthorization.test.ts tests/LivekitParticipantWebhookController.test.ts` in the WorkAdventure checkout and `go test ./pkg/service -run TestBroadcastRefreshClaims -count=1` in the LiveKit checkout, showing the failing-first assertions. Source inspection alone is not proof.
- [ ] Patch the backend join/update/moderation hooks using trusted tags and `floorHolders`. Always permit stopping. Denied listeners have no populated `canPublishSources`. Set JWT `canUpdateOwnMetadata:false` and retain server participant permission `canUpdateMetadata:false` during every promotion/revocation. Patch LiveKit refresh with cloned listener claims, clearing publication permission/sources while leaving live participant grants untouched. Add `POST /internal/livekit/participants` in the existing back Express app, registered before global JSON parsing with route-local raw-body parsing; verify `WebhookReceiver.receive(rawBodyString,authorizationHeader)` with no authentication bypass. Configure LiveKit's host-network webhook to a loopback-only backend HTTP mapping (`127.0.0.1:18080` → back `HTTP_PORT`), with no public proxy route. Verified `participant_joined` events regrant only a current floor holder. Serialize grant/revoke/rejoin per room+identity, reread floor state inside the queue, deduplicate webhook IDs, and reject stale participant SIDs. Staff and unmarked meetings retain their normal behavior.
- [ ] Build immutable ARM64 back and LiveKit images from exact pinned revisions. Repeat the preceding test commands and `npm run typecheck --workspace=workadventureback`, requiring pass; run the full causal reproduction again, plus real staff/guest publication, grant/revoke, refreshed-token replay, resumptions/full reconnects and cross-hall isolation. Test unsigned/tampered webhooks, duplicate/stale events, role-attribute mutation and delayed join racing with revoke. Require an independent reviewer to assess the root-cause evidence, source patches and end-to-end results. If related failures recur, stop patching and reassess; short TTL alone does not pass this gate.
- [ ] Commit the minimal patches, their pins, image digests and actual role-test evidence: `fix: enforce broadcast staff roles and guest floor revocation`.

### Task 4: Publish one world and verify complete attendee journeys

**Files:** Create `ops/publish.sh`, `ops/tests/hosted-journeys.ts`, `docs/qa/journeys.md`; consume the completed map package and catalog.

**Interfaces:** Publish to the dedicated map-storage directory `varcamp`, preserving `maps/` so all nine rooms use `/~/varcamp/maps/<map>.wam`. Upload keys are private. `ops/publish.sh` exits nonzero if the built package is incomplete, uses the wrong destination, or would replace unrelated worlds; it backs up current WAMs before an update.

- [ ] Write destination/package tests requiring nine source maps and nine WAMs, one common world namespace, sibling route resolution, existing entry fragments and a nonempty explicit upload directory. Reject `/_/` URLs as production persistence evidence and reject an empty upload directory.

```ts
expect(productionRooms).toHaveLength(9);
expect(productionRooms.every(url => new URL(url).pathname.startsWith('/~/varcamp/maps/'))).toBe(true);
expect(uploadDirectory).toBe('varcamp');
```
- [ ] Run those tests; confirm failure before the publication script exists.
- [ ] Implement publication with the pinned starter CLI and map-storage URL/API key. Back up existing VarCamp editor metadata before later uploads. Save/export any native room edits and keep the actual WAM sidecars in Git. Configure the default venue entry to the overworld.
- [ ] Use two independent guest browser profiles and authenticated staff: walk all nine maps, complete each personal quest independently, refresh and change maps, and verify private progress and no duplicate counts. Use four real sessions for two simultaneous presenters and one listener in each hall; verify correct audio/screen sharing, no other-hall or preparation audio, hand raise and give/revoke floor. Test guest editor denial, staff controls and interrupted navigation. On a midrange laptop and phone under10Mbps/150ms, measure first walkable map≤15s, next map≤8s and no movement freeze>1s over a two-minute route. Record real conditions and failures.
- [ ] Commit the publication script and evidence: `ops: publish and verify connected VarCamp journeys`.

### Task 5: Rehearsal, recovery and event handover

**Files:** Create `ops/backup.sh`, `ops/restore.sh`, `docs/operating/{hosting,rehearsal,incident-response}.md`, `docs/qa/capacity.md`; update README with the working venue URL only after it is verified.

**Interfaces:** Backups cover VarCamp map storage/WAMs, identity database and deployment configuration with secrets handled privately. Restore targets only a VarCamp rehearsal/restore project until verified. The operating guide records the actual launch attendance and camera workload that passed, plus the exact venue URL and monitoring/recovery steps.

- [ ] Define the acceptance runs: 30,60,100 connected people for≥20minutes each, walking, concurrent halls and the expected workshop/camera mix. For each run record connected count, active camera/screen-share mix, resource use, room/media failures and participant audio checks. Synthetic connections alone cannot certify real media quality. Define a backup/restore verification that restores a saved map edit and quest/staff configuration in an isolated project.

```ts
expect(run.connectedPeople).toBe(targetAttendance); // 30, 60 or 100
expect(run.durationSeconds).toBeGreaterThanOrEqual(1200);
expect(run.serverRestarts).toBe(0);
expect(run.unresolvedRoomLoadFailures).toBe(0);
```
- [ ] Run a restore smoke check before the recovery scripts exist; require the expected failure. Reserve real audience rehearsal sessions with the organiser; no invented participants or measurements.
- [ ] Implement project-scoped backup/restore, basic health/resource checks, certificate-renewal checks and incident steps for returning attendees to the plaza, restarting only VarCamp services and restoring a bad map release. Include how to revoke staff access and where private credentials are stored, without embedding them in the guide.
- [ ] Run restore verification and the real staged rehearsals. At the chosen launch attendance require no restart or unresolved room-load failure; every participant must hear the correct presenter and regain audio after transitions. Fix measured failures and repeat only affected checks. If a100-person rehearsal has not occurred, state the lower verified attendance and keep100 as unverified. Hand over the completed venue with the actual readiness results; organiser availability/AWS access are external prerequisites, not automatic passes.
- [ ] Commit: `docs: validate capacity and event operating procedures`. Run the whole-branch review and appropriate integration checks before declaring production ready.

## Primary deployment references

- [Release-matched Compose](https://github.com/workadventure/workadventure/blob/v1.34.1/contrib/docker/docker-compose.prod.yaml), [production guide](https://github.com/workadventure/workadventure/blob/v1.34.1/contrib/docker/README.md), [OIDC](https://github.com/workadventure/workadventure/blob/v1.34.1/docs/others/self-hosting/openid.md), [editor allowlist](https://github.com/workadventure/workadventure/blob/v1.34.1/docs/others/self-hosting/self-hosted-access.md).
- [Native WAM property schemas](https://github.com/workadventure/workadventure/blob/v1.34.1/libs/map-editor/src/types.ts), [backend space updates](https://github.com/workadventure/workadventure/blob/v1.34.1/back/src/Model/Space.ts), [floor authority](https://github.com/workadventure/workadventure/blob/v1.34.1/back/src/Model/RaiseHandManager.ts), [LiveKit grants](https://github.com/workadventure/workadventure/blob/v1.34.1/back/src/Model/Services/LivekitService.ts).
- [LiveKit pinned configuration](https://github.com/livekit/livekit/blob/v1.13.9/config-sample.yaml), [port/firewall requirements](https://docs.livekit.io/transport/self-hosting/ports-firewall/), [self-hosted token revocation limitation](https://docs.livekit.io/frontends/reference/tokens-grants/), [refresh implementation](https://github.com/livekit/livekit/blob/v1.13.9/pkg/service/roommanager.go).
- [Coturn configuration](https://github.com/coturn/coturn/blob/4.18.0/examples/etc/turnserver.conf), [PROXY support](https://github.com/coturn/coturn/blob/4.18.0/README.turnserver), [Traefik TCP routing](https://doc.traefik.io/traefik/reference/dynamic-configuration/file/), [Keycloak production containers](https://www.keycloak.org/server/containers).
