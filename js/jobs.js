// ── Live Jobs Feed ───────────────────────────────────────────
// Tech jobs: Remotive public API (CORS-friendly, no key needed)
// Modeling/casting: Casting Call Club RSS via rss2json.com (free)

(function () {
  'use strict';

  let currentType = 'tech';
  let currentTechParam = 'category=devops-sysadmin';
  let cache = {};

  // ── Fetch helpers ──────────────────────────────────────────

  async function fetchTechJobs(param) {
    const key = 'tech_' + param;
    if (cache[key]) return cache[key];

    const res = await fetch(`https://remotive.com/api/remote-jobs?${param}`);
    if (!res.ok) throw new Error(`Remotive ${res.status}`);
    const data = await res.json();
    const jobs = (data.jobs || []).slice(0, 12);
    cache[key] = jobs;
    return jobs;
  }

  async function fetchModelingJobs() {
    if (cache.modeling) return cache.modeling;

    // Primary: Casting Call Club RSS
    try {
      const rssUrl = encodeURIComponent('https://www.castingcallclub.com/rss/jobs/casting-calls');
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&count=15`);
      const data = await res.json();
      if (data.status === 'ok' && data.items && data.items.length > 0) {
        cache.modeling = data.items;
        return cache.modeling;
      }
    } catch (_) {}

    // Fallback: Indeed RSS for brand/model/casting
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

  function renderTechJobs(jobs) {
    const grid = document.getElementById('tech-jobs-grid');
    if (!jobs.length) {
      grid.innerHTML = '<div class="jobs-empty">No remote jobs found for this filter right now — try another.</div>';
      return;
    }
    grid.innerHTML = jobs.map(j => {
      const logo = j.company_logo
        ? `<img class="job-logo" src="${j.company_logo}" alt="${j.company_name}" loading="lazy" onerror="this.style.display='none'">`
        : '';
      const tags = (j.tags || []).slice(0, 4)
        .map(t => `<span class="job-tag">${t}</span>`).join('');
      const salary = j.salary
        ? `<span class="job-salary">${stripHtml(j.salary).slice(0, 60)}</span>`
        : '';
      return `
        <div class="job-card">
          <div class="job-top">
            ${logo}
            <div>
              <a class="job-title" href="${j.url}" target="_blank" rel="noopener noreferrer">${j.title}</a>
              <div class="job-company">${j.company_name}</div>
            </div>
          </div>
          <div class="job-meta">
            <span class="job-location">${j.candidate_required_location || 'Remote'}</span>
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
      grid.innerHTML = '<div class="jobs-empty">No casting calls found right now — check the platforms above for live listings.</div>';
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
    grid.innerHTML = '<div class="jobs-loading">Fetching remote jobs…</div>';
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
    const techPanel = document.getElementById('jobs-panel-tech');
    const modelPanel = document.getElementById('jobs-panel-modeling');
    techPanel.style.display = type === 'tech' ? '' : 'none';
    modelPanel.style.display = type === 'modeling' ? '' : 'none';
    if (type === 'tech') loadTechJobs();
    else loadModelingJobs();
  }

  // ── Init ───────────────────────────────────────────────────

  function initJobs() {
    const techGrid = document.getElementById('tech-jobs-grid');
    if (!techGrid) return;

    // Type tabs (Tech / Modeling)
    document.querySelectorAll('.jobs-type-tab').forEach(tab => {
      tab.addEventListener('click', () => switchType(tab.dataset.type));
    });

    // Tech filter chips
    document.querySelectorAll('.jobs-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.jobs-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTechParam = btn.dataset.param;
        delete cache['tech_' + currentTechParam]; // force re-fetch on filter change
        loadTechJobs();
      });
    });

    // Refresh button
    document.getElementById('jobs-refresh-btn').addEventListener('click', () => {
      cache = {};
      if (currentType === 'tech') loadTechJobs();
      else loadModelingJobs();
    });

    // Initial load
    loadTechJobs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJobs);
  } else {
    initJobs();
  }
})();
