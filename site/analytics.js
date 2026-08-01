const projectKey = document.querySelector('meta[name="posthog-project-key"]')?.content.trim();
const apiHost = document.querySelector('meta[name="posthog-api-host"]')?.content.trim();
const ANALYTICS_OPT_OUT_KEY = 'gitpin.analytics.opt_out';
let analyticsPreferenceAvailable = true;
let analyticsOptedOut = readAnalyticsOptOut();

const MAX_EVENT_NAME_LENGTH = 64;
const MAX_TOKEN_LENGTH = 64;
const MAX_DISTINCT_ID_LENGTH = 128;
const MAX_SESSION_ID_LENGTH = 256;
const EVENT_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function readAnalyticsOptOut() {
  try {
    return window.localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === 'true';
  } catch {
    analyticsPreferenceAvailable = false;
    return true;
  }
}

function getAnalyticsStatus() {
  if (!analyticsPreferenceAvailable) {
    return 'Website analytics are off because this browser cannot store the preference.';
  }
  if (analyticsOptedOut) return 'Website analytics are off on this browser.';
  if (!projectKey || !apiHost) {
    return 'Website analytics are not configured for this build. You can still save an opt-out for future visits.';
  }
  return 'Optional website analytics are on for this browser.';
}

function renderAnalyticsControls() {
  for (const control of document.querySelectorAll('[data-analytics-opt-out]')) {
    control.disabled = analyticsOptedOut;
    control.setAttribute('aria-pressed', String(analyticsOptedOut));
  }
  for (const status of document.querySelectorAll('[data-analytics-opt-out-status]')) {
    status.textContent = getAnalyticsStatus();
  }
}

function disableAnalytics() {
  analyticsOptedOut = true;
  try {
    window.localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
  } catch {
    analyticsPreferenceAvailable = false;
  }

  try {
    window.posthog?.opt_out_capturing?.();
  } catch {
    // The in-memory guard and before_send remain fail-closed even if the SDK cannot update its own state.
  }
  renderAnalyticsControls();
}

for (const control of document.querySelectorAll('[data-analytics-opt-out]')) {
  control.addEventListener('click', disableAnalytics);
}
renderAnalyticsControls();

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
  setup_intent: { surface: ['hero', 'navigation'] },
  setup_guide_intent: { step: ['open_setup_guide'] },
  sample_view_intent: { phase: ['sample_view'] },
  gate_result_intent: { result: ['fail_demo', 'pass_demo'] },
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

function normalizeTransportValue(value, maxLength) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function isLikelyAnonymousDistinctId(value) {
  if (!value) return false;
  if (value.length < 8 || value.length > MAX_DISTINCT_ID_LENGTH) return false;
  if (value.includes(' ')) return false;
  if (value.includes('@')) return false;
  return true;
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

function sanitizeOutboundProperties(eventName, properties) {
  const schema = launchFunnelEventSchema[eventName];
  if (!schema || typeof properties !== 'object' || properties === null) return null;

  const scrubbed = {};
  for (const [property, allowed] of Object.entries(schema)) {
    const value = sanitizeProperty(eventName, property, properties[property]);
    if (!value || !allowed.includes(value)) return null;
    scrubbed[property] = value;
  }
  return scrubbed;
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

function isLikelyAutomatedVisitor() {
  const userAgent = (navigator.userAgent || '').toLowerCase();
  if (typeof navigator.webdriver === 'boolean' && navigator.webdriver) return true;
  return /headless|puppeteer|playwright|selenium|bot|spider|crawl/i.test(userAgent);
}

function hasExplicitTestTrafficFlag() {
  if (window.__gitpinTestTraffic === true || window.__gitpinTestTraffic === 'true') return true;
  if (typeof window.location?.search !== 'string') return false;
  const params = new URLSearchParams(window.location.search);
  const flag = params.get('gitpin_test_traffic');
  return flag === '1' || /^true$/i.test(flag || '');
}

function getTrafficClass() {
  return hasExplicitTestTrafficFlag() ? 'synthetic_qa' : 'production';
}

function buildStrictPayload(event) {
  if (analyticsOptedOut) return null;
  if (isLikelyAutomatedVisitor() && hasExplicitTestTrafficFlag()) return null;

  if (!event || typeof event !== 'object') return null;
  const eventName = typeof event.event === 'string' ? event.event.trim() : '';
  if (!eventName || eventName.length > MAX_EVENT_NAME_LENGTH || !launchFunnelEventSchema[eventName]) return null;

  const properties = event.properties;
  if (!properties || typeof properties !== 'object') return null;
  const outboundProperties = sanitizeOutboundProperties(eventName, properties);
  if (!outboundProperties) return null;

  const token = normalizeTransportValue(event.token ?? properties.token, MAX_TOKEN_LENGTH);
  if (!token || token !== projectKey) return null;

  const distinctId = normalizeTransportValue(event.distinct_id ?? properties.distinct_id, MAX_DISTINCT_ID_LENGTH);
  if (!distinctId || !isLikelyAnonymousDistinctId(distinctId)) return null;

  const uuid = normalizeTransportValue(event.uuid, 36);
  if (!uuid || !EVENT_UUID_PATTERN.test(uuid)) return null;
  if (
    event.timestamp !== undefined &&
    (!(event.timestamp instanceof Date) || Number.isNaN(event.timestamp.getTime()))
  ) {
    return null;
  }

  const nextProperties = {
    ...outboundProperties,
    token,
    distinct_id: distinctId,
    traffic_class: getTrafficClass(),
    $geoip_disable: true,
  };

  if (properties.$session_id !== undefined) {
    const sessionId = normalizeTransportValue(properties.$session_id, MAX_SESSION_ID_LENGTH);
    if (!sessionId) return null;
    nextProperties.$session_id = sessionId;
  }

  if (properties.$process_person_profile !== undefined) {
    if (typeof properties.$process_person_profile !== 'boolean') return null;
    nextProperties.$process_person_profile = properties.$process_person_profile;
  }

  const payload = {
    event: eventName,
    token,
    distinct_id: distinctId,
    properties: nextProperties,
    uuid,
  };

  if (event.timestamp !== undefined) payload.timestamp = event.timestamp;
  return payload;
}

function buildBeforeSend(event) {
  return buildStrictPayload(event);
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

if (!analyticsOptedOut && projectKey && apiHost) {
  const posthog = window.posthog || [];
  window.posthog = posthog;
  posthog.__SV = posthog.__SV || 1;
  if (!Array.isArray(posthog._i)) posthog._i = [];
  if (typeof posthog.capture !== 'function') {
    posthog.capture = (...args) => posthog.push(['capture', ...args]);
  }
  if (typeof posthog.init !== 'function') {
    posthog.init = (key, config) => {
      posthog._i.push([key, config]);
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `${apiHost.replace('.i.posthog.com', '-assets.i.posthog.com')}/static/array.js`;
      document.head.append(script);
    };
  }
  window.posthog = posthog;
  window.gitpinTrack = (event, properties = {}) => track(event, properties);
  posthog.init(projectKey, {
    api_host: apiHost,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    cookieless_mode: 'always',
    disable_session_recording: true,
    person_profiles: 'never',
    before_send: buildBeforeSend,
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

function track(eventName, properties = {}) {
  if (analyticsOptedOut) return;
  if (!window.posthog?.capture) return;
  const normalizedName = String(eventName || '');
  const sanitized = sanitizeProperties(normalizedName, properties);
  if (!sanitized) return;
  window.posthog.capture(eventName, sanitized);
}
