import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const measurementFixturePath = 'tests/fixtures/launch-readiness/task-3-measurement-fixture.json';
const measurementProtocolPath = 'tests/fixtures/launch-readiness/task-3-measurement-protocol.md';

function readArtifact(relativePath: string): string {
  return readFileSync(join(rootDirectory, relativePath), 'utf8');
}

function readJsonArtifact<T>(relativePath: string): T {
  return JSON.parse(readArtifact(relativePath)) as T;
}

function extractDataAnalyticsTags(html: string): string[] {
  return [...html.matchAll(/<[^>]*\bdata-analytics(?:-event|-(?:prop-[^" >]+))?="[^"]+"[^>]*>/gu)].map(
    (match) => match[0],
  );
}

const launchEventSchema = {
  setup_intent: ['surface'],
  setup_guide_intent: ['step'],
  gate_result_intent: ['result'],
  sample_view_intent: ['phase'],
  feedback_intent: ['surface'],
  audience_changed: ['audience'],
  cta_clicked: ['placement'],
};

const launchEventPropertyAllowlist: Record<string, string[]> = {
  surface: ['hero', 'navigation', 'footer', 'feedback_nav', 'feedback_footer', 'feedback_footer_nav', 'footer_nav'],
  step: ['open_setup_guide'],
  result: ['fail_demo', 'pass_demo'],
  phase: ['sample_view'],
  audience: ['engineering', 'release', 'governance'],
  placement: [
    'feedback_footer',
    'feedback_footer_nav',
    'feedback_nav',
    'github_footer',
    'github_hero',
    'github_nav',
    'setup_hero',
  ],
};

const launchEventAllowlist = Object.keys(launchEventSchema);
const expectedProtocolSections = [
  'Event sequence (actual site surfaces)',
  'Launch-funnel metrics and exact numerators/denominators',
  'Distinction policy',
  'Two-session observed-validation protocol (synthetic-only)',
];

function extractPropertyMatch(tag: string, property: string): string | null {
  const pattern = new RegExp(`data-analytics-prop-${property}="([^"]+)"`, 'i');
  return pattern.exec(tag)?.[1] ?? null;
}

function extractAttribute(tag: string, attribute: string): string | null {
  const pattern = new RegExp(`${attribute}="([^"]+)"`, 'i');
  return pattern.exec(tag)?.[1] ?? null;
}

describe('launch readiness Task 3 instrumentation invariants', () => {
  it('uses strict launch-funnel event/property allowlists in site analytics code', () => {
    const analytics = readArtifact('site/analytics.js');
    const websiteGuide = readArtifact('docs/website.md');
    const fixture = readJsonArtifact<{
      events: { schema: Record<string, string[]>; allowedEventNames: string[] };
    }>(measurementFixturePath);
    const fixtureSchema = fixture.events.schema;
    const fixtureAllowedEvents = [...fixture.events.allowedEventNames].sort();
    const localAllowedEvents = [...launchEventAllowlist].sort();

    for (const eventName of localAllowedEvents) {
      expect(analytics).toContain(`${eventName}:`);
    }

    expect(localAllowedEvents).toEqual(fixtureAllowedEvents);

    for (const [eventName, props] of Object.entries(launchEventSchema)) {
      expect(fixtureSchema).toHaveProperty(eventName);
      expect(fixtureSchema[eventName]).toEqual(props);
      expect(websiteGuide).toContain(`${eventName}`);
    }

    expect(websiteGuide).not.toContain('$pageview');
    expect(analytics).toContain('capture_pageview: false');
    expect(analytics).toContain('capture_pageleave: false');
  });

  it('keeps index analytics surfaces strictly allowlisted and complete', () => {
    const index = readArtifact('site/index.html');
    const tags = extractDataAnalyticsTags(index);

    const discoveredEventNames = new Set<string>();
    const discoveredClickPlacements = new Set<string>();

    for (const tag of tags) {
      const eventName = extractAttribute(tag, 'data-analytics-event');
      const analyticsPlacement = extractAttribute(tag, 'data-analytics');
      const ctaEvent = extractAttribute(tag, 'data-analytics');

      if (eventName) {
        expect(launchEventAllowlist, `unexpected event in site HTML: ${eventName}`).toContain(eventName);
        discoveredEventNames.add(eventName);

        if (eventName === 'setup_intent') {
          const surface = extractPropertyMatch(tag, 'surface');
          expect(surface).not.toBeNull();
          expect(launchEventPropertyAllowlist.surface).toContain(surface);
        }
        if (eventName === 'setup_guide_intent') {
          const step = extractPropertyMatch(tag, 'step');
          expect(step).not.toBeNull();
          expect(launchEventPropertyAllowlist.step).toContain(step);
        }
        if (eventName === 'sample_view_intent') {
          const phase = extractPropertyMatch(tag, 'phase');
          expect(phase).not.toBeNull();
          expect(launchEventPropertyAllowlist.phase).toContain(phase);
        }
        if (eventName === 'gate_result_intent') {
          const result = extractPropertyMatch(tag, 'result');
          expect(result).not.toBeNull();
          expect(launchEventPropertyAllowlist.result).toContain(result);
        }
        if (eventName === 'feedback_intent') {
          const surface = extractPropertyMatch(tag, 'surface');
          expect(surface).not.toBeNull();
          expect(launchEventPropertyAllowlist.surface).toContain(surface);
        }

        const dataAttrs = tag.match(/data-analytics-prop-[^=]+="[^"]+"/gu) ?? [];
        const expectedProps = launchEventSchema[eventName as keyof typeof launchEventSchema] ?? [];
        for (const attr of dataAttrs) {
          const property = attr.split('-prop-')[1]?.split('="')[0];
          if (property) {
            expect(expectedProps).toContain(property.replace(/-/g, '_'));
          }
        }
      }

      if (ctaEvent) {
        if (!eventName && analyticsPlacement !== null) {
          discoveredClickPlacements.add(analyticsPlacement);
          expect(launchEventPropertyAllowlist.placement).toContain(analyticsPlacement);
        }
      }
    }

    expect(discoveredEventNames.has('setup_intent')).toBe(true);
    expect(discoveredEventNames.has('setup_guide_intent')).toBe(true);
    expect(discoveredEventNames.has('sample_view_intent')).toBe(true);
    expect(discoveredEventNames.has('gate_result_intent')).toBe(true);
    expect(discoveredEventNames.has('feedback_intent')).toBe(true);
    expect(discoveredClickPlacements.has('github_nav')).toBe(true);
    expect(discoveredClickPlacements.has('github_hero')).toBe(true);
    expect(discoveredClickPlacements.has('github_footer')).toBe(true);
  });

  it('documents synthetic protocol invariants with explicit fields and no completion status', () => {
    const protocol = readArtifact(measurementProtocolPath);
    const fixture = readJsonArtifact<{
      captureFields: string[];
      sessions: Array<{
        session_type: string;
        session_id: string;
        required_fields: string[];
        ordered_stages: string[];
      }>;
      events: { allowedEventNames: string[]; schema: Record<string, string[]> };
      analysis: { analysisWindowDays: number; sessionOrderWindowHours: number; timeToSetupGuideLimitSeconds: number };
      scoring: {
        attributionCorrectness: { formula: string };
        unsafeAssumptionRate: { formula: string };
        frictionRate: { formula: string };
      };
      protocolStatus: { actualSessionsCompleted: boolean; actualSessionsPending: number };
    }>(measurementFixturePath);

    for (const section of expectedProtocolSections) {
      expect(protocol).toContain(section);
    }

    expect(protocol.toLowerCase()).toContain('actual participant sessions are still pending and not completed');
    expect(fixture.protocolStatus.actualSessionsCompleted).toBe(false);
    expect(fixture.protocolStatus.actualSessionsPending).toBeGreaterThan(0);

    for (const eventName of fixture.events.allowedEventNames) {
      expect(launchEventAllowlist).toContain(eventName);
    }

    expect(fixture.captureFields).toEqual(
      expect.arrayContaining([
        'session_id',
        'session_type',
        'participant_role',
        'fixture_id',
        'start_ts_utc',
        'event_trace',
        'time_to_setup_guide_seconds',
        'time_to_sample_view_seconds',
        'unsafe_assumptions_count',
        'attribution_observed',
        'friction_points',
        'evidence',
      ]),
    );

    expect(fixture.scoring.attributionCorrectness.formula).toContain('sessions with ordered');
    expect(fixture.scoring.unsafeAssumptionRate.formula).toContain('unsafe_assumptions_count');
    expect(fixture.scoring.frictionRate.formula).toContain('friction_points');
    expect(fixture.analysis.analysisWindowDays).toBeGreaterThan(0);
    expect(fixture.analysis.sessionOrderWindowHours).toBeGreaterThan(0);
    expect(fixture.analysis.timeToSetupGuideLimitSeconds).toBeGreaterThan(0);

    expect(fixture.sessions.map((session) => session.session_type)).toContain('technical');
    expect(fixture.sessions.map((session) => session.session_type)).toContain('cross-functional');
    expect(
      fixture.sessions.filter((session) => session.session_type === 'cross-functional')[0]?.required_fields,
    ).toContain('time_to_sample_view_seconds');
    expect(fixture.sessions.length).toBe(2);
  });

  it('keeps feedback collection wording explicit about non-analytics and non-collection', () => {
    const issueTemplate = readArtifact('.github/ISSUE_TEMPLATE/launch_feedback.md');
    const templateLower = issueTemplate.toLowerCase();
    expect(templateLower).toContain('not analytics telemetry');
    expect(templateLower).toContain('do not include repository contents');
    expect(templateLower).toContain('optional');
  });
});
