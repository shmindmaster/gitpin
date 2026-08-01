const audienceContent = {
  engineering: {
    question: 'Did the agent cover every material file it changed?',
    fact: 'Every material changed path must map to a named claim.',
    known: 'Coverage is checked against the merge-base diff.',
    inference: 'Reviewers can see which claims cover which files.',
    gap: 'GitPin does not judge whether a claim is semantically true.',
  },
  release: {
    question: 'Was this evidence generated for the exact pull-request head?',
    fact: 'Each locator is re-hashed at the full base or head commit SHA.',
    known: 'Dirty work and stale indexes are excluded.',
    inference: 'A passing required check can gate merge on exact committed evidence.',
    gap: 'Tests and release approval remain separate controls.',
  },
  governance: {
    question: 'Can a pull request weaken its own evidence policy?',
    fact: 'Policy is loaded from the trusted base branch.',
    known: 'The submitted manifest is read from the pull-request head.',
    inference: 'Policy and evidence have separate trust origins.',
    gap: 'GitPin verifies evidence integrity, not business truth.',
  },
};

const tabs = [...document.querySelectorAll('[role="tab"]')];
const fields = {
  question: document.querySelector('#audience-question'),
  fact: document.querySelector('#audience-fact'),
  known: document.querySelector('#audience-known'),
  inference: document.querySelector('#audience-inference'),
  gap: document.querySelector('#audience-gap'),
};

function selectAudience(tab, moveFocus = false) {
  const content = audienceContent[tab.dataset.audience];
  if (!content) return;
  for (const candidate of tabs) {
    const selected = candidate === tab;
    candidate.setAttribute('aria-selected', String(selected));
    candidate.tabIndex = selected ? 0 : -1;
  }
  for (const [name, node] of Object.entries(fields)) node.textContent = content[name];
  document.querySelector('#evidence-panel').setAttribute('aria-labelledby', tab.id);
  if (moveFocus) tab.focus();
  window.gitpinTrack?.('audience_changed', { audience: tab.dataset.audience });
}

for (const tab of tabs) {
  tab.addEventListener('click', () => selectAudience(tab));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.indexOf(tab);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectAudience(tabs[nextIndex], true);
  });
}

const menuToggle = document.querySelector('.menu-toggle');
const primaryNavigation = document.querySelector('#primary-nav');

function setMenuOpen(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.textContent = open ? 'Close navigation' : 'Open navigation';
  if (open) primaryNavigation.setAttribute('data-open', 'true');
  else primaryNavigation.removeAttribute('data-open');
}

menuToggle.addEventListener('click', () => setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true'));
primaryNavigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenuOpen(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenuOpen(false);
});

const heroDemo = document.querySelector('[data-hero-demo]');

function initializeHeroDemo(heroDemo) {
  const heroFields = {
    path: heroDemo.querySelector('[data-hero-path]'),
    fail: heroDemo.querySelector('[data-hero-fail]'),
    locator: heroDemo.querySelector('[data-hero-locator]'),
    hash: heroDemo.querySelector('[data-hero-hash]'),
    pass: heroDemo.querySelector('[data-hero-pass]'),
    result: heroDemo.querySelector('[data-hero-result]'),
    summary: heroDemo.querySelector('[data-hero-summary]'),
    play: heroDemo.querySelector('[data-hero-play]'),
    pause: heroDemo.querySelector('[data-hero-pause]'),
    replay: heroDemo.querySelector('[data-hero-replay]'),
  };
  if (Object.values(heroFields).some((field) => !field)) {
    heroDemo.setAttribute('aria-busy', 'false');
    heroDemo.dataset.heroUnavailable = 'true';
    return;
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phases = ['material', 'uncovered', 'evidence', 'pass'];
  let artifact;
  let phase = 'loading';
  let paused = false;
  let complete = false;
  let timer;
  let inViewport = true;

  const clearTimer = () => {
    if (timer) window.clearTimeout(timer);
    timer = undefined;
  };

  const setControls = () => {
    const available = Boolean(artifact) && !reducedMotion;
    heroFields.play.disabled = !available || complete;
    heroFields.pause.disabled = !available || paused || complete;
    heroFields.replay.disabled = !artifact || reducedMotion;
  };

  const render = () => {
    heroDemo.dataset.heroPhase = phase;
    heroDemo.dataset.heroPaused = String(paused);
    heroDemo.dataset.heroComplete = String(complete);
    heroDemo.dataset.heroReducedMotion = String(reducedMotion);
    const message =
      phase === 'material'
        ? `Material diff includes ${artifact.fixture.changedPath}.`
        : phase === 'uncovered'
          ? artifact.failCase.message
          : phase === 'evidence'
            ? `Exact locator added: ${artifact.passCase.coverage.citation}.`
            : artifact.passCase.message;
    heroFields.result.textContent = message;
    setControls();
  };

  const advance = () => {
    clearTimer();
    const nextIndex = phases.indexOf(phase) + 1;
    if (nextIndex >= phases.length) {
      phase = 'pass';
      complete = true;
      paused = false;
      render();
      return;
    }
    phase = phases[nextIndex];
    paused = false;
    complete = phase === 'pass';
    render();
    if (!complete && inViewport && !document.hidden) timer = window.setTimeout(advance, 900);
  };

  const pause = () => {
    if (!artifact || complete) return;
    clearTimer();
    paused = true;
    render();
  };

  const replay = () => {
    if (!artifact || reducedMotion) return;
    clearTimer();
    phase = 'material';
    paused = true;
    complete = false;
    render();
  };

  const play = () => {
    if (!artifact || reducedMotion || complete || !inViewport || document.hidden) return;
    advance();
  };

  heroFields.play.addEventListener('click', play);
  heroFields.pause.addEventListener('click', pause);
  heroFields.replay.addEventListener('click', replay);
  heroFields.play.setAttribute('aria-label', 'Play gate walkthrough');
  heroFields.pause.setAttribute('aria-label', 'Pause gate walkthrough');
  heroFields.replay.setAttribute('aria-label', 'Replay gate walkthrough');

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  if (typeof window.IntersectionObserver === 'function') {
    new IntersectionObserver(
      ([entry]) => {
        inViewport = entry.isIntersecting;
        if (!inViewport) pause();
      },
      { threshold: 0.15 },
    ).observe(heroDemo);
  }

  fetch('./_gitpin-artifacts/pr-gate-fail-to-pass.artifact.json')
    .then((response) => {
      if (!response.ok) throw new Error(`Artifact request failed (${response.status})`);
      return response.json();
    })
    .then((loadedArtifact) => {
      artifact = loadedArtifact;
      const coverage = artifact.passCase.coverage;
      heroFields.path.textContent = artifact.fixture.changedPath;
      heroFields.fail.textContent = artifact.failCase.message;
      heroFields.locator.textContent = `${coverage.path}:${coverage.lineStart} @ ${coverage.sha}`;
      heroFields.hash.textContent = coverage.contentSha256;
      heroFields.pass.textContent = artifact.passCase.message;
      heroFields.summary.textContent = artifact.accessibility.caption;
      heroDemo.setAttribute('aria-busy', 'false');

      if (reducedMotion) {
        phase = 'pass';
        complete = true;
        paused = false;
        render();
        return;
      }

      phase = 'material';
      paused = false;
      complete = false;
      render();
      if (inViewport && !document.hidden) timer = window.setTimeout(advance, 900);
    })
    .catch(() => {
      heroDemo.setAttribute('aria-busy', 'false');
      heroFields.result.textContent = 'The deterministic walkthrough artifact is unavailable.';
      heroFields.summary.textContent = 'Static evidence walkthrough unavailable.';
    });
}

if (heroDemo) initializeHeroDemo(heroDemo);
