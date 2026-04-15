// Track progress stored in localStorage
const STORAGE_KEY = 'upskill_progress';

function getProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// On index page: update badges and overall bar
function initDashboard() {
  const progress = getProgress();
  const tracks = document.querySelectorAll('.track');
  let totalTopics = 0;
  let doneTopics = 0;

  tracks.forEach(track => {
    const links = track.querySelectorAll('.topic-list a');
    let trackDone = 0;
    links.forEach(link => {
      const key = link.getAttribute('href');
      const li = link.closest('li');
      if (progress[key] === 'done') {
        trackDone++;
        li.style.textDecoration = 'line-through';
        li.style.opacity = '0.5';
      }
    });
    totalTopics += links.length;
    doneTopics  += trackDone;

    const badge = track.querySelector('.badge');
    if (trackDone === 0) {
      badge.textContent = 'Not started';
      badge.className = 'badge todo';
    } else if (trackDone === links.length) {
      badge.textContent = 'Completed';
      badge.className = 'badge done';
    } else {
      badge.textContent = `${trackDone}/${links.length} done`;
      badge.className = 'badge inprogress';
    }
  });

  const pct = totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0;
  const fill = document.querySelector('.bar-fill');
  const pctEl = document.querySelector('.pct');
  if (fill) fill.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
}

// On topic page: mark-as-done button
function initTopicPage() {
  const btn = document.getElementById('mark-done-btn');
  if (!btn) return;
  const key = btn.dataset.key;
  const progress = getProgress();

  if (progress[key] === 'done') {
    btn.textContent = 'Completed!';
    btn.style.background = '#22c55e';
    btn.disabled = true;
  }

  btn.addEventListener('click', () => {
    progress[key] = 'done';
    saveProgress(progress);
    btn.textContent = 'Completed!';
    btn.style.background = '#22c55e';
    btn.disabled = true;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.tracks')) initDashboard();
  if (document.querySelector('.topic-page')) initTopicPage();
});
