const projectKey = document.querySelector('meta[name="posthog-project-key"]')?.content.trim();
const apiHost = document.querySelector('meta[name="posthog-api-host"]')?.content.trim();

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
  window.gitpinTrack = (event, properties = {}) => window.posthog.capture(event, properties);
  posthog.init(projectKey, {
    api_host: apiHost,
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    cookieless_mode: 'always',
    disable_session_recording: true,
    person_profiles: 'never',
  });
}

for (const link of document.querySelectorAll('[data-analytics]')) {
  link.addEventListener('click', () => window.gitpinTrack?.('cta_clicked', { placement: link.dataset.analytics }));
}
