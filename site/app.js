const audienceContent = {
  technical: {
    question: 'Where is bearer authentication enforced?',
    fact: 'HTTP requests require bearer authentication.',
    known: 'Directly supported by committed source.',
    inference: 'Authentication is part of the remote trust boundary.',
    gap: 'Production endpoint ownership is not registered.',
  },
  product: {
    question: 'What can users trust in a Context Brief?',
    fact: 'Every known fact includes a path, line, and commit SHA.',
    known: 'Evidence selection remains stable across audiences.',
    inference: 'Cross-functional reviews can share one evidence set.',
    gap: 'User-validation evidence is not registered.',
  },
  operations: {
    question: 'What is exposed by the remote transport?',
    fact: 'HTTP snapshots contain documentation and manifests only.',
    known: 'Source code and dirty work are excluded from the image.',
    inference: 'Snapshot freshness belongs in the deployment runbook.',
    gap: 'A production endpoint has not been deployed.',
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
  window.repocontextTrack?.('audience_changed', { audience: tab.dataset.audience });
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
