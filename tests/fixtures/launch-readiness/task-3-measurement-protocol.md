# Task 3 launch-funnel and observed-validation protocol

## Launch funnel instrumentation contract

The launch-funnel schema is strict and deterministic:

| Event | Required properties | Allowed values |
| --- | --- | --- |
| `setup_intent` | `surface` | `hero`, `navigation` |
| `setup_guide_intent` | `step` | `open_setup_guide` |
| `sample_view_intent` | `phase` | `sample_view` |
| `gate_result_intent` | `result` | `fail_demo`, `pass_demo` |
| `feedback_intent` | `surface` | `footer`, `footer_nav`, `feedback_nav`, `feedback_footer`, `feedback_footer_nav`, `navigation` |
| `audience_changed` | `audience` | `engineering`, `release`, `governance` |
| `cta_clicked` | `placement` | `feedback_footer`, `feedback_footer_nav`, `feedback_nav`, `github_footer`, `github_hero`, `github_nav`, `setup_hero` |

Data collected with each event is only these properties, after strict SDK stripping and allowlisted outbound filtering.
No repository contents, filesystem paths, questions, prompt text, tokens, secrets, personal identifiers, URLs, or arbitrary free-text fields are recorded.

## Event sequence (actual site surfaces)

Observed instrumentation surfaces are only:

`hero setup_intent (surface=hero)`
`setup setup_guide_intent (step=open_setup_guide)`
`setup sample_view_intent (phase=sample_view)`
`setup gate_result_intent (result=pass_demo|fail_demo)`
`feedback feedback_intent (surface=footer|footer_nav|feedback_nav|feedback_footer|feedback_footer_nav|navigation)`

Optional baseline:

`audience_changed (audience=engineering|release|governance)`
`cta_clicked (placement=... listed above)`

## Launch-funnel metrics and exact numerators/denominators

All funnel calculations use a 7-day sliding window and exclude test sessions only when both:

- an automated browser signal is present (`navigator.webdriver` or headless/automation user-agent),
- and an explicit test-traffic marker is set (`gitpin_test_traffic=true` in query or `window.__gitpinTestTraffic === true`).

For each unique visit session:

- `setup_intent_sessions` = sessions with `setup_intent`
- `setup_guide_sessions` = sessions with `setup_guide_intent` after `setup_intent` within 24h
- `sample_view_sessions` = sessions with `sample_view_intent` after `setup_guide_intent` within 24h
- `result_observed_sessions` = sessions with `gate_result_intent` after `setup_guide_intent` within 24h

Rates:

- `setup_guide_rate = setup_guide_sessions / setup_intent_sessions`
- `sample_view_rate = sample_view_sessions / setup_guide_sessions`
- `result_observed_rate = result_observed_sessions / setup_guide_sessions`
- `feedback_rate = feedback_sessions / setup_intent_sessions`

Median and p95 latency metrics:

- `time_to_setup_guide_seconds` = first `setup_guide_intent` timestamp minus first `setup_intent` timestamp (within session window)
- `time_to_sample_view_seconds` = first `sample_view_intent` timestamp minus first `setup_guide_intent` timestamp (within session window)

`time_to_sample_view_seconds` is `number` for sessions where `sample_view_intent` is observed and `null` when not applicable.

## Distinction policy

### 1) Instrumentation (what is observed directly)
- Event schema validation pass/fail
- Per-event counts by name and property signature
- Sessionized progression checks

### 2) Observed behavior (what can be stated from events alone)
- Presence/order of funnel states and latency values
- Session completion rules

### 3) Inferred adoption (what requires interpretation)
- Attribution correctness (ordered event-sequence quality from observed behavior)
- unsafe-assumption and friction proxies

### 4) PMF readiness (what is not yet proven)
- PMF is **not inferred** from clicks.
- PMF work remains pending until approved synthetic and real sessions are completed.

## Two-session observed-validation protocol (synthetic-only)

All sessions are synthetic-only. No real repository content, prompt text, tokens, secrets, or user identifiers are collected in protocol records.
Actual participant sessions are still pending and not completed.

Transport fields sent with each launch-funnel event are limited to:

- project token (`token`) validated against the deployed PostHog project key,
- anonymous `distinct_id`,
- optional `$session_id` when retained by cookieless session analysis,
- and optional `$process_person` when required by the SDK.

No other SDK-enrichment fields are retained.

### Synthetic fixture

- `fixture_id`: `task-3-synthetic-01`
- `repo_name`: `task-3-launch-fixture`
- `base_sha`: `982608f3b7521706cabbc39cd0ccf4b4036898fa`
- `head_sha`: `bab63b08df51151b6b375f2b6376fb441bcf3a8e`
- `expected_fail_snippet`: `docs/protocol.md:5-5`

### Required fields per session record

- `session_id`
- `session_type` (`technical`, `cross-functional`)
- `participant_role`
- `fixture_id`
- `start_ts_utc` (ISO-8601)
- `event_trace` list entries:
  - `event_name`
  - `event_time_utc` (ISO-8601)
  - `event_property_signature`
- `time_to_setup_guide_seconds`
- `time_to_sample_view_seconds` (for every session record; `null` when not applicable)
- `unsafe_assumptions_count`
- `attribution_observed` (`true|false`)
- `friction_points` list entries:
  - `area` (`setup`, `result`, `result_interpretation`, `navigation`)
  - `severity` (`low`, `medium`, `high`)
- `evidence` (`observed`, `none`)

### Session A (technical)

- `session_type`: `technical`
- `participant_role`: `technical_reviewer`
- Stage path: `setup_intent` -> `setup_guide_intent` -> `sample_view_intent` -> `gate_result_intent`

### Session B (cross-functional)

- `session_type`: `cross-functional`
- `participant_role`: `product_or_release_owner`
- Stage path: `setup_intent` -> `setup_guide_intent` -> `feedback_intent` -> `gate_result_intent`
- Required captures:
  - `time_to_sample_view_seconds` (`null` for sessions without `sample_view_intent`)
  - `unsafe_assumptions_count`
  - `friction_points`
  - attribution summary after `gate_result_intent`

## Data handling commitments

- Event payloads must reject unknown event names, unknown properties, missing properties, and extra properties.
- Unknown/malformed values are dropped and not logged.
- No free-text analytics fields are collected on the site.
