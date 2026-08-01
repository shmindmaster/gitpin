# Task 3 launch-funnel and observed-validation protocol

## Launch funnel instrumentation contract

The launch-funnel schema is strict and deterministic:

| Event | Required properties | Allowed values |
| --- | --- | --- |
| `setup_intent` | `surface` | `hero`, `install`, `navigation` |
| `setup_progress` | `step` | `open_setup_guide`, `open_install_section` |
| `first_pass_intent` | `phase` | `first_pass` |
| `gate_result_intent` | `result` | `fail_demo`, `pass_demo` |
| `feedback_intent` | `surface` | `footer`, `footer_nav`, `feedback_nav`, `feedback_footer`, `feedback_footer_nav`, `navigation` |
| `audience_changed` | `audience` | `engineering`, `release`, `governance` |
| `cta_clicked` | `placement` | `feedback_footer`, `feedback_footer_nav`, `feedback_nav`, `github_footer`, `github_hero`, `github_nav`, `setup_hero` |

Data collected with each event is only these properties plus cookieless session metadata from PostHog.
No repository contents, filesystem paths, questions, prompt text, tokens, secrets, personal identifiers, arbitrary URLs, or identifiers are recorded.

## Event sequence (actual site surfaces)

Observed instrumentation surfaces are only:

`hero setup_intent (surface=hero)`  
`install setup_progress (step=open_setup_guide)`  
`install first_pass_intent (phase=first_pass)`  
`install gate_result_intent (result=pass_demo|fail_demo)`  
`feedback feedback_intent (surface=footer|footer_nav|feedback_nav|feedback_footer|feedback_footer_nav|navigation)`  

Optional baseline:

`audience_changed (audience=engineering|release|governance)`  
`cta_clicked (placement=... listed above)`

### Sequence definition

Canonical progression is:

1. `setup_intent`  
2. `setup_progress` (must occur after step 1 in same session window)  
3. either:
   - `first_pass_intent` then `gate_result_intent`, or  
   - `gate_result_intent` directly  
4. optional `feedback_intent` after result interpretation or navigation friction

`feedback_intent` does not imply completion and is never treated as installation or passing evidence.

## Launch-funnel metrics and exact numerators/denominators

All funnel calculations use a 7-day sliding window and exclude bot/test sessions.

For each unique visit session:

- `setup_intent_sessions` = sessions with `setup_intent`  
- `setup_progress_sessions` = sessions with `setup_progress` after `setup_intent` within 24h  
- `first_pass_sessions` = sessions with `first_pass_intent` after `setup_progress` within 24h  
- `result_observed_sessions` = sessions with `gate_result_intent` after `setup_progress` within 24h  
- `result_informed_sessions` = sessions with `result_observed_sessions` and an explicit result interpretation (`pass_demo|fail_demo`) in notes
- `feedback_sessions` = sessions with `feedback_intent`

Rates:

- `setup_progress_rate = setup_progress_sessions / setup_intent_sessions`
- `first_pass_rate = first_pass_sessions / setup_progress_sessions`
- `result_observed_rate = result_observed_sessions / setup_progress_sessions`
- `feedback_rate = feedback_sessions / setup_intent_sessions`

Median and p95 latency metrics:

- `time_to_install_seconds` = first `setup_progress` timestamp minus first `setup_intent` timestamp (within session window)  
- `time_to_first_pass_seconds` = first `first_pass_intent` timestamp minus first `setup_progress` timestamp (within session window)

Deduplication and identity:

- Primary key for this analysis is cookieless session ID and event sequence buckets.
- Cross-session identity is intentionally limited in cookieless mode; repeat visits may not be linked.
- Count values are therefore lower bounds unless additional identity is independently provided.

## Distinction policy

### 1) Instrumentation (what is observed directly)
- Event schema validation pass/fail
- Per-event counts by name and property signature
- Sessionized progression checks

### 2) Observed behavior (what can be stated from events alone)
- Presence/order of funnel states and friction signals
- Time-to-install and time-to-first-pass medians/p95
- Session completion rules (e.g., invalid events dropped)

### 3) Inferred adoption (what requires interpretation)
- `attribution_correctness` (ordered event sequence quality from observed behavior)
- `unsafe_assumption_rate` and `friction_rate` (must be interpreted with explicit reviewer judgment)

### 4) PMF readiness (what is not yet proven)
- PMF is **not inferred** from site clicks.
- PMF work remains pending until approved field sessions complete.

## Two-session observed-validation protocol (synthetic-only)

All sessions are synthetic and synthetic-only. No real repository content, prompt text, tokens, secrets, or user identifiers are collected in protocol records.
Actual participant sessions are still pending and not completed.

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
- `time_to_install_seconds`
- `time_to_first_pass_seconds`
- `unsafe_assumptions_count`
- `attribution_observed` (`true|false`)
- `friction_points` list entries:
  - `area` (`setup`, `result`, `result_interpretation`, `navigation`)
  - `severity` (`low`, `medium`, `high`)
- `evidence` (`observed`, `none`)

### Session A (technical)

- `session_type`: `technical`
- `participant_role`: `technical_reviewer`
- Path: `setup_intent` -> `setup_progress` -> `first_pass_intent` -> `gate_result_intent`
- Expected scoring:
  - `attribution_observed = true` when each required event occurs in order
  - `score = sum(required_stage_completed_in_order, max 4)`

### Session B (cross-functional)

- `session_type`: `cross-functional`
- `participant_role`: `product_or_release_owner`
- Path: `setup_intent` -> `setup_progress` -> `feedback_intent` -> `gate_result_intent`
- Required captures:
  - `unsafe_assumptions_count`
  - `friction_points`
  - attribution summary after `gate_result_intent`
- Expected scoring:
  - `score = 1` when attribution statement is explicit and ordered correctly

### Scoring and output fields

- `attribution_correctness = sessions with expected event order / sessions with result_observed`
- `unsafe_assumption_rate = sum(unsafe_assumptions_count) / sessions_with_feedback`
- `friction_rate = total(friction_points) / sessions_with_feedback`
- `time_to_install_seconds` and `time_to_first_pass_seconds` reported as median + p95
- A session is a successful observed run when:
  - event trace has no schema-invalid events,
  - `setup_intent` is present,
  - `time_to_install_seconds <= 1800`,
  - `attribution_observed = true`

## Data handling commitments

- Event payloads must reject unknown event names, unknown properties, missing properties, and extra properties.
- Unknown/malformed values are dropped and not logged.
- No free-text analytics fields are collected on the site.
