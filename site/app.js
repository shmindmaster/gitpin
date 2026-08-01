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
