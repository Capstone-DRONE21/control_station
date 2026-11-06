# Implementation alternatives analysis

Date: 2026-11-05. Status: recommendation for review; no architecture migration implemented.

## Evidence and scope

Reviewed the root README, frontend README, Polyrepo_Strategy.md, all six architecture/interface/flow/sequence images under docs, and the current backend entry point, configuration, database, authentication, dashboard and farm scene code. This analysis covers the control station and its visualization interfaces; the scheduler's optimization algorithm and flight-control implementation are outside this repository's documented responsibility.

The README requires five simulated drones and one physical drone, persisted scheduler/pad/drone data (FR-021–023), a dashboard (FR-024), logs (FR-025), overrides (FR-026), a Gantt chart (NFR-008), graceful failures (NFR-009), and five log levels (NFR-022).

The diagrams specify React, SQLite, Unity/Quest, WebSocket JSON for live state, HTTP for operator requests, MAVLink/UDP for simulated drones, SiK radio for the physical drone, and USB serial for the pad. These are documented design choices, not all implemented features. The interface diagram routes BMS information through flight control.

Current code provides FastAPI health/authentication routes, SQLite operator/session tables, a placeholder dashboard, and three scripted flight paths in the browser scene. It does not yet provide the operational telemetry pipeline, scheduler integration, pad integration, telemetry history, command tracking, live stream, Gantt chart, or log viewer. A configured URL or timeout is not evidence of a working integration. No Unity project was found in the file inventory. Static inspection only: no runtime performance or hardware validation was performed.

## Whole-system alternatives

Effort and suitability below are engineering judgments relative to the existing repository, not measured benchmarks. Assumptions: one local control-station host, six drones, a small operator audience, and no requirement for high availability or multi-site operation.

| Alternative | Implementation | Advantages | Costs and limitations | Assessment |
| --- | --- | --- | --- | --- |
| A. Modular FastAPI application | Keep React and FastAPI; isolate adapters, state, persistence, commands and streaming into modules; SQLite initially | Reuses existing code and documented interfaces; few deployment components; straightforward end-to-end debugging | One backend failure affects the station; blocking device work must be isolated; in-memory state needs a single owner | Recommended baseline |
| B. MQTT-connected services | Separate device gateways, ingestion and scheduler integration around a broker; retain an HTTP/WebSocket API for clients | Producers and consumers can evolve independently; useful when subsystem teams run services on separate machines | Broker deployment, topic contracts, permissions, duplicate handling and recovery add work; message delivery does not prove command execution | Best expansion path if distributed integration becomes necessary |
| C. ROS 2 integration | Represent robotics interfaces through ROS nodes and bridge to the web dashboard | Could align well with a flight/simulation team already using ROS | Introduces another integration/runtime layer if peers use only MAVLink and HTTP; team expertise and platform compatibility need validation | Conditional choice; obtain evidence of existing ROS use first |
| D. Native desktop station | Replace the browser UI with a desktop client; keep a service layer for adapters and scheduler | Potential fit for a dedicated operator workstation and native device integration | Rewrites the existing UI/authentication flow; desktop packaging; separate VR client still needed | Consider only if native workstation requirements emerge |

MQTT's publish/subscribe capability is documented by [Eclipse Mosquitto](https://mosquitto.org/). The claimed project fit and relative implementation effort are this analysis's conclusions. ROS is retained as a conditional alternative, not a verified compatibility recommendation for the team's unspecified flight stack.

Alternative A can satisfy all listed requirements; none requires a broker or distributed service architecture. Its main condition is disciplined ownership of connections and state. FastAPI workers normally do not share memory, so adding workers to an in-memory stream manager would split state and could open duplicate hardware connections. Start with one owning process and supervised adapters; introduce shared messaging or a dedicated gateway before scaling workers. See [FastAPI deployment concepts](https://fastapi.tiangolo.com/deployment/concepts/).

## Decisions within the recommended architecture

| Area | Alternatives | Recommendation and decision trigger |
| --- | --- | --- |
| Drone integration | Pymavlink; MAVSDK | Prototype Pymavlink for explicit message/dialect access and BMS fields. Prefer MAVSDK if the actual autopilot and required commands/telemetry are covered and its deployment is acceptable. Validate against the selected firmware before committing. |
| Browser updates | Polling; server-sent events plus HTTP commands; WebSocket plus HTTP commands | Keep the documented WebSocket stream and HTTP commands. Polling is useful for an early mock slice; SSE is viable if browser updates remain one-way but changes the documented stream approach. |
| Storage | SQLite; PostgreSQL; specialized time-series storage | Keep SQLite for the local baseline, with serialized/batched telemetry writes and explicit retention. Move to PostgreSQL when concurrent writers or shared hosting are demonstrated needs; consider time-series storage only after measuring history/query volume. |
| VR | Unity/Quest as documented; browser WebXR using the existing Three.js scene | Keep Unity if Quest calibration and native VR are committed requirements. Investigate WebXR only if reducing separate client code is a priority; demonstrate headset compatibility and calibration first. Existing browser animation does not establish VR readiness. |
| Gantt display | Small custom SVG timeline; chart library | A read-only SVG timeline is a reasonable first implementation for six drones. Evaluate a library if zoom, complex interaction or accessibility requirements outgrow it. Scheduling decisions remain backend data. |
| Repository organization | Existing subsystem polyrepos; one system monorepo | Retain subsystem boundaries if ownership follows the strategy document. Keep control-station frontend/backend together and version shared interface contracts. Repository separation does not require service separation. |

[Pymavlink](https://mavlink.io/en/mavgen_python/) is a low-level message-processing library. [MAVSDK's Python guide](https://mavsdk.mavlink.io/develop/en/python/quickstart.html) demonstrates higher-level vehicle actions and telemetry. The preferred choice remains conditional on firmware, message coverage, and multi-vehicle integration tests.

SQLite permits one writer per database file at a time; fleet count alone is insufficient to prove capacity. For illustration, six drones at ten stored samples per second produce 5,184,000 samples per day before pad/scheduler records. Ten Hz is an assumption, not a requirement. Agree on sampling and retention, then measure batch latency, history query time and database growth. See [SQLite's suitability guidance](https://sqlite.org/whentouse.html).

## Design corrections needed regardless of alternative

1. **Support mixed sources concurrently.** Current settings have one global mock/simulation/hardware mode and one simulated-drone URL. Define a vehicle registry with stable drone IDs, source type, connection endpoint and MAVLink system/component identity. Five simulators may share a transport or use distinct endpoints; specify routing explicitly. Mock data must be distinguishable from physical data.
2. **Define contracts before integrating.** Specify units, coordinate frames relative to the pad, pose orientation, battery identity, nullable SoH, field timestamps, sequence numbers and schema versions. Do not treat unavailable SoH as zero or fabricate it from SoC. Agree how BMS fields are carried by flight control.
3. **Detect silence as well as invalid messages.** Run freshness checks on a timer even when no new data arrives. Preserve last-known values with age/quality flags. Track freshness per field where update rates differ. Existing two-second freshness and three-second command settings are defaults requiring validation.
4. **Separate command acceptance from completion.** Persist an operator request ID before dispatch; track validation failure, sent, acknowledged, rejected, in-progress, completed and timed-out/unknown outcomes as appropriate. Correlate acknowledgements by target and command and constrain concurrent identical commands where correlation is ambiguous. A lost acknowledgement does not prove the action failed. Apply bounded protocol retries and avoid creating duplicate operator operations. MAVLink explicitly distinguishes acceptance from completed execution: [command protocol](https://mavlink.io/en/services/command.html).
5. **Resolve command authority.** Route charge-priority requests through the scheduler; define which abort/return actions may go directly to flight control and how the scheduler learns about them. Prevent a scheduler decision from immediately undoing an operator override. Flight-control interlocks remain authoritative.
6. **Bound work and recover deliberately.** Isolate blocking serial reads and database operations from the async event loop. Supervise adapter reconnects; cap queues; coalesce live pose updates for slow viewers; preserve command/audit events under a separate policy. On stream reconnect, send a versioned snapshot before subsequent updates. Report database-write failures rather than implying history is complete.
7. **Extend authentication to operational paths.** Apply existing backend session checks and origin/CSRF protections to command APIs. Define WebSocket authentication and origin validation, session expiry/revocation, and a separate read-only credential flow for Unity. Browser cookies use the /api path, so endpoint placement matters.
8. **Complete logging semantics.** Persist source, time, severity and correlation ID; expose filtering/history and live updates. Normalize WARNING to WARN and CRITICAL to FATAL when using Python logging so the UI meets NFR-022.

## Requirement coverage and validation

| Requirement | Implementation unit | Evidence required for acceptance |
| --- | --- | --- |
| FR-021 | Scheduler adapter and schedule history | Persist and reload decisions; reject stale revisions; display scheduler disconnects |
| FR-022 | Pad serial adapter and pad history | Validate status/temperature frames; survive malformed/partial input and unplug/reconnect |
| FR-023 | Drone adapters and telemetry history | Distinguish all six vehicles; store required available fields with units and freshness; preserve history through restart |
| FR-024 | Fleet snapshot/stream and dashboard | Fleet, per-drone telemetry, pad and scheduler views agree on state and mark stale data |
| FR-025, NFR-022 | Structured logs and viewer | Filter and retrieve INFO/WARN/ERROR/FATAL/DEBUG from relevant sources |
| FR-026 | Authorized command service | Reject unauthorized requests; correlate acknowledgements; test rejection, duplicate submission, timeout and restart |
| NFR-008 | Schedule timeline | Render drone/pad/time allocation and schedule revisions as a Gantt chart |
| NFR-009 | Validation, supervision and recovery | Inject invalid packets, silence, slow clients, disconnects and storage errors without presenting false success |

## Proposed implementation sequence

1. Agree interface contracts and ownership with flight-control, BMS, pad and scheduler teams. Confirm autopilot, MAVLink dialect, pad framing, coordinate origin, rates, retention, scheduler override rules and headset target. These unknowns affect adapters, but need not block mock development.
2. Build a deterministic six-drone mock pipeline through validation, persistence, latest-state storage, an authenticated snapshot endpoint and live updates. Include a pad and versioned scheduler decisions; demonstrate stale-data behavior.
3. Build the dashboard, logs and Gantt timeline against that pipeline. Add command tracking with mock acceptance/rejection/timeouts and persisted audit history.
4. Add simulator MAVLink and scheduler adapters; verify identities, field coverage and command semantics. Add physical-drone and pad adapters using the same contracts, then exercise simultaneous mixed operation.
5. Connect Unity to the same normalized stream; verify coordinate conversion, calibration, timestamps, selection and offline behavior. Keep visualization independent of command authority.
6. Measure actual ingestion and storage load, disconnect recovery, restart reconciliation and client latency. Set acceptance budgets with the team; reconsider MQTT or PostgreSQL only if results or deployment requirements justify them.

The recommendation is to complete the existing architecture as a modular application, with clear interfaces that permit later extraction of gateways or messaging. The first deliverable should be a working mock-to-database-to-dashboard slice, followed by command lifecycle tests and real integrations.
