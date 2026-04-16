// ── Live Jobs Feed ───────────────────────────────────────────
// Tech: Remotive API (free, CORS-friendly) — filtered to US + profile match
// Modeling: Casting Call Club RSS via rss2json

(function () {
  'use strict';

  let currentType = 'tech';
  let currentTechParam = 'search=platform+engineer+golang';
  let cache = {};

  // Profile skills for match scoring
  const PROFILE_SKILLS = [
    'go', 'golang', 'kubernetes', 'k8s', 'kafka', 'terraform', 'docker',
    'prometheus', 'grafana', 'datadog', 'grpc', 'redis', 'python',
    'aws', 'ci/cd', 'devops', 'platform', 'sre', 'helm', 'github actions',
    'postgresql', 'linux', 'microservices', 'observability'
  ];

  // US-based location strings accepted
  const US_LOCATIONS = [
    'united states', 'usa', 'us only', 'u.s.', 'us,', 'us ',
    'north america', 'worldwide', 'anywhere', 'global', ''
  ];

  function isUSJob(loc) {
    if (!loc) return true; // no restriction = worldwide
    const l = loc.toLowerCase();
    return US_LOCATIONS.some(s => l.includes(s));
  }

  function profileScore(job) {
    const haystack = [
      job.title, job.description,
      (job.tags || []).join(' '), job.job_type
    ].join(' ').toLowerCase();
    return PROFILE_SKILLS.filter(s => haystack.includes(s)).length;
  }

  // ── Fetch helpers ──────────────────────────────────────────

  async function fetchTechJobs(param) {
    const key = 'tech_' + param;
    if (cache[key]) return cache[key];

    const res = await fetch(`https://remotive.com/api/remote-jobs?${param}`);
    if (!res.ok) throw new Error(`Remotive ${res.status}`);
    const data = await res.json();

    const jobs = (data.jobs || [])
      .filter(j => isUSJob(j.candidate_required_location))
      .map(j => ({ ...j, _score: profileScore(j) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 12);

    cache[key] = jobs;
    return jobs;
  }

  async function fetchModelingJobs() {
    if (cache.modeling) return cache.modeling;

    try {
      const rssUrl = encodeURIComponent('https://www.castingcallclub.com/rss/jobs/casting-calls');
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&count=15`);
      const data = await res.json();
      if (data.status === 'ok' && data.items?.length > 0) {
        cache.modeling = data.items;
        return cache.modeling;
      }
    } catch (_) {}

    // Fallback: Indeed RSS for brand/model casting in USA
    try {
      const rssUrl = encodeURIComponent(
        'https://www.indeed.com/rss?q=model+casting+brand+shoot+south+asian&l=United+States&sort=date'
      );
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&count=15`);
      const data = await res.json();
      cache.modeling = data.items || [];
      return cache.modeling;
    } catch (_) {}

    cache.modeling = [];
    return cache.modeling;
  }

  // ── Render helpers ─────────────────────────────────────────

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(h / 24);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    if (d < 30) return `${d}d ago`;
    return `${Math.floor(d / 30)}mo ago`;
  }

  function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').trim();
  }

  function matchBadge(score) {
    if (score >= 6) return `<span class="match-badge match-hot">Strong match</span>`;
    if (score >= 3) return `<span class="match-badge match-good">Good match</span>`;
    return '';
  }

  function renderTechJobs(jobs) {
    const grid = document.getElementById('tech-jobs-grid');
    if (!jobs.length) {
      grid.innerHTML = '<div class="jobs-empty">No US remote jobs found for this filter right now — try another tab.</div>';
      return;
    }
    grid.innerHTML = jobs.map(j => {
      const logo = j.company_logo
        ? `<img class="job-logo" src="${j.company_logo}" alt="${j.company_name}" loading="lazy" onerror="this.style.display='none'">`
        : '';
      const tags = (j.tags || []).slice(0, 4).map(t => `<span class="job-tag">${t}</span>`).join('');
      const salary = j.salary ? `<span class="job-salary">${stripHtml(j.salary).slice(0, 60)}</span>` : '';
      const location = j.candidate_required_location || 'Remote (Worldwide)';
      return `
        <div class="job-card">
          <div class="job-top">
            ${logo}
            <div style="flex:1;min-width:0">
              <a class="job-title" href="${j.url}" target="_blank" rel="noopener noreferrer">${j.title}</a>
              <div class="job-company">${j.company_name} ${matchBadge(j._score)}</div>
            </div>
          </div>
          <div class="job-meta">
            <span class="job-location">${location}</span>
            ${salary}
            <span class="job-date">${timeAgo(j.publication_date)}</span>
          </div>
          ${tags ? `<div class="job-tags">${tags}</div>` : ''}
        </div>`;
    }).join('');
  }

  function renderModelingJobs(items) {
    const grid = document.getElementById('modeling-jobs-grid');
    if (!items.length) {
      grid.innerHTML = '<div class="jobs-empty">No casting calls loaded right now — use the platform links above for live listings.</div>';
      return;
    }
    grid.innerHTML = items.map(item => {
      const desc = stripHtml(item.description || item.content || '').slice(0, 140);
      return `
        <div class="job-card">
          <a class="job-title" href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
          <div class="job-company">${item.author || 'Casting Call'}</div>
          <div class="job-meta">
            <span class="job-date">${timeAgo(item.pubDate)}</span>
          </div>
          ${desc ? `<p class="job-desc">${desc}…</p>` : ''}
        </div>`;
    }).join('');
  }

  // ── Load functions ─────────────────────────────────────────

  async function loadTechJobs() {
    const grid = document.getElementById('tech-jobs-grid');
    grid.innerHTML = '<div class="jobs-loading">Fetching US remote jobs…</div>';
    try {
      const jobs = await fetchTechJobs(currentTechParam);
      renderTechJobs(jobs);
    } catch (e) {
      grid.innerHTML = `<div class="jobs-empty">Could not load jobs — ${e.message}</div>`;
    }
  }

  async function loadModelingJobs() {
    const grid = document.getElementById('modeling-jobs-grid');
    grid.innerHTML = '<div class="jobs-loading">Fetching casting calls…</div>';
    try {
      const items = await fetchModelingJobs();
      renderModelingJobs(items);
    } catch (e) {
      grid.innerHTML = '<div class="jobs-empty">Could not load casting calls right now.</div>';
    }
  }

  function switchType(type) {
    currentType = type;
    document.querySelectorAll('.jobs-type-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.type === type)
    );
    document.getElementById('jobs-panel-tech').style.display = type === 'tech' ? '' : 'none';
    document.getElementById('jobs-panel-modeling').style.display = type === 'modeling' ? '' : 'none';
    if (type === 'tech') loadTechJobs();
    else loadModelingJobs();
  }

  // ── Init ───────────────────────────────────────────────────

  function initJobs() {
    if (!document.getElementById('tech-jobs-grid')) return;

    document.querySelectorAll('.jobs-type-tab').forEach(tab =>
      tab.addEventListener('click', () => switchType(tab.dataset.type))
    );

    document.querySelectorAll('.jobs-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.jobs-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTechParam = btn.dataset.param;
        delete cache['tech_' + currentTechParam];
        loadTechJobs();
      });
    });

    document.getElementById('jobs-refresh-btn').addEventListener('click', () => {
      cache = {};
      if (currentType === 'tech') loadTechJobs();
      else loadModelingJobs();
    });

    loadTechJobs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJobs);
  } else {
    initJobs();
  }
})();
