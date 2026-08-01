const projectKey = document.querySelector('meta[name="posthog-project-key"]')?.content.trim();
const apiHost = document.querySelector('meta[name="posthog-api-host"]')?.content.trim();

const launchFunnelEventSchema = {
  cta_clicked: {
    placement: [
      'feedback_footer',
      'feedback_footer_nav',
      'feedback_nav',
      'github_footer',
      'github_hero',
      'github_nav',
      'setup_hero',
    ],
  },
  audience_changed: { audience: ['engineering', 'release', 'governance'] },
  setup_intent: { surface: ['hero', 'install', 'navigation'] },
  setup_progress: { step: ['open_setup_guide', 'open_install_section'] },
  gate_result_intent: { result: ['fail_demo', 'pass_demo'] },
  first_pass_intent: { phase: ['first_pass'] },
  feedback_intent: {
    surface: ['footer', 'footer_nav', 'feedback_nav', 'feedback_footer', 'feedback_footer_nav', 'navigation'],
  },
};

function toSnakeCase(value) {
  return value.replace(/([a-z0-9])([A-Z])/gu, '$1_$2').toLowerCase();
}

function normalizePropertyValue(value) {
  if (typeof value !== 'string') return null;
  return value.trim().slice(0, 40);
}

function sanitizeProperty(eventName, property, value) {
  const allowed = launchFunnelEventSchema[eventName]?.[property];
  const normalized = normalizePropertyValue(value);
  if (!allowed || !normalized || !allowed.includes(normalized)) return undefined;
  return normalized;
}

function sanitizeProperties(eventName, properties) {
  const schema = launchFunnelEventSchema[eventName];
  if (!schema || typeof properties !== 'object' || properties === null) return null;

  const sanitized = {};
  const schemaKeys = Object.keys(schema);
  const propertyKeys = Object.keys(properties);

  for (const key of propertyKeys) {
    if (!schemaKeys.includes(key)) return null;
  }

  for (const propertyName of Object.keys(schema)) {
    const value = sanitizeProperty(eventName, propertyName, properties[propertyName]);
    if (!value) return null;
    sanitized[propertyName] = value;
  }

  if (propertyKeys.length !== Object.keys(schema).length) return null;
  return sanitized;
}

function parseEventProperties(element, eventName) {
  const properties = {};

  for (const [key, value] of Object.entries(element.dataset)) {
    if (!key.startsWith('analyticsProp')) continue;
    const propertyName = toSnakeCase(key.slice('analyticsProp'.length));
    properties[propertyName] = value;
  }

  return sanitizeProperties(eventName, properties);
}

function parseCtaProperties(element) {
  const hasFunnelProperties = Object.keys(element.dataset).some((key) => key.startsWith('analyticsProp'));
  if (hasFunnelProperties) return null;
  return sanitizeProperties('cta_clicked', { placement: element.dataset.analytics });
}

function track(eventName, properties = {}) {
  if (!window.posthog?.capture) return;
  const sanitized = sanitizeProperties(eventName, properties);
  if (!sanitized) return;
  window.posthog.capture(eventName, sanitized);
}

function getEventName(element) {
  const eventName = element.dataset.analyticsEvent?.trim();
  if (eventName) return launchFunnelEventSchema[eventName] ? eventName : null;
  if (element.dataset.analytics) return 'cta_clicked';
  return null;
}

function getEventProperties(element, eventName) {
  if (eventName === 'cta_clicked') {
    return parseCtaProperties(element);
  }
  return parseEventProperties(element, eventName);
}

if (projectKey && apiHost) {
  const posthog = [];
  posthog._i = [];
  posthog.__SV = 1;
  posthog.capture = (...args) => posthog.push(['capture', ...args]);
  posthog.init = (key, config) => {
    posthog._i.push([key, config]);
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `${apiHost.replace('.i.posthog.com', '-assets.i.posthog.com')}/static/array.js`;
    document.head.append(script);
  };
  window.posthog = posthog;
  window.gitpinTrack = (event, properties = {}) => track(event, properties);
  posthog.init(projectKey, {
    api_host: apiHost,
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    cookieless_mode: 'always',
    disable_session_recording: true,
    person_profiles: 'never',
  });

  for (const link of document.querySelectorAll('[data-analytics], [data-analytics-event]')) {
    link.addEventListener('click', () => {
      const eventName = getEventName(link);
      if (!eventName) return;
      const properties = getEventProperties(link, eventName);
      if (!properties) return;
      track(eventName, properties);
    });
  }
}
