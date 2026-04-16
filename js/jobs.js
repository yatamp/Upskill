// ── Live Jobs Feed ───────────────────────────────────────────
// RemoteOK API (free, CORS-friendly) — fetched by tag
// Fallback: Remotive API
// All filtering (role search, location, language) is client-side

(function () {
  'use strict';

  let allJobs = [];       // full fetched set for current tag
  let currentTag = 'devops';
  let searchQuery = '';
  let locationFilter = '';
  let debounceTimer = null;
  let cache = {};

  const PROFILE = [
    'go', 'golang', 'kubernetes', 'k8s', 'kafka', 'terraform', 'docker',
    'prometheus', 'grafana', 'datadog', 'grpc', 'redis', 'python', 'aws',
    'platform', 'devops', 'sre', 'reliability', 'helm', 'github actions',
    'microservices', 'observability', 'backend', 'distributed', 'cloud',
    'linux', 'ci/cd', 'pipeline', 'infrastructure',
  ];

  // RemoteOK tag mapping
  const TAG_MAP = {
    devops: 'devops', golang: 'golang', python: 'python',
    kubernetes: 'kubernetes', kafka: 'kafka',
    terraform: 'terraform', sre: 'sre', backend: 'backend',
  };

  // Remotive category fallback
  const REMOTIVE_CAT = {
    devops: 'devops-sysadmin', golang: 'software-dev', python: 'software-dev',
    kubernetes: 'devops-sysadmin', kafka: 'devops-sysadmin',
    terraform: 'devops-sysadmin', sre: 'devops-sysadmin', backend: 'software-dev',
  };

  // ── US filter ──────────────────────────────────────────────
  function isUsAccessible(loc) {
    if (!loc || !loc.trim()) return true;
    const l = loc.toLowerCase();
    const ALLOW = [
      'remote', 'global', 'worldwide', 'anywhere', 'distributed', 'international',
      'united states', 'usa', 'u.s.', 'america', 'north america', 'canada',
      'new york', ' ny', 'san francisco', 'austin', 'chicago', 'seattle',
      'boston', 'denver', 'los angeles', 'atlanta', 'dallas', 'miami',
      'reston', 'rockville', 'chantilly', 'salt lake', 'redwood',
    ];
    return ALLOW.some(s => l.includes(s));
  }

  // ── Score ──────────────────────────────────────────────────
  function scoreJob(title, desc, tags) {
    const hay = [title, desc, (tags || []).join(' ')].join(' ').toLowerCase();
    return PROFILE.filter(k => hay.includes(k)).length;
  }

  // ── Fetch: RemoteOK ────────────────────────────────────────
  async function fetchRemoteOK(tag) {
    const key = 'rok_' + tag;
    if (cache[key]) return cache[key];
    const res = await fetch(`https://remoteok.com/api?tag=${tag}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error('RemoteOK ' + res.status);
    const data = await res.json();
    const jobs = data
      .filter(j => j && j.position && j.company)
      .filter(j => isUsAccessible(j.location))
      .map(j => ({
        title: j.position,
        company: j.company,
        logo: j.company_logo || j.logo || null,
        url: j.apply_url || j.url || `https://remoteok.com/remote-jobs/${j.slug}`,
        location: j.location || '',
        salary: j.salary_min > 0
          ? `$${Math.round(j.salary_min / 1000)}k–$${Math.round(j.salary_max / 1000)}k`
          : '',
        tags: (j.tags || []).slice(0, 6),
        epoch: j.epoch || 0,
        score: scoreJob(j.position, j.description || '', j.tags),
        source: 'RemoteOK',
      }));
    if (!jobs.length) throw new Error('no results');
    cache[key] = jobs;
    return jobs;
  }

  // ── Fetch: Remotive fallback ───────────────────────────────
  async function fetchRemotive(tag) {
    const cat = REMOTIVE_CAT[tag] || 'devops-sysadmin';
    const key = 'rem_' + cat;
    if (cache[key]) return cache[key];
    const res = await fetch(`https://remotive.com/api/remote-jobs?category=${cat}&limit=40`);
    if (!res.ok) throw new Error('Remotive ' + res.status);
    const data = await res.json();
    const jobs = (data.jobs || [])
      .filter(j => isUsAccessible(j.candidate_required_location))
      .map(j => ({
        title: j.title,
        company: j.company_name,
        logo: j.company_logo_url || j.company_logo || null,
        url: j.url,
        location: j.candidate_required_location || '',
        salary: j.salary ? j.salary.replace(/<[^>]+>/g, '').slice(0, 60) : '',
        tags: (j.tags || []).slice(0, 6),
        epoch: j.publication_date ? new Date(j.publication_date).getTime() / 1000 : 0,
        score: scoreJob(j.title, j.description || '', j.tags),
        source: 'Remotive',
      }));
    cache[key] = jobs;
    return jobs;
  }

  // ── Client-side filter + render ────────────────────────────
  function applyFilters() {
    const q = searchQuery.toLowerCase().trim();
    const loc = locationFilter.toLowerCase().trim();

    let results = allJobs.filter(j => {
      // Role / text search
      if (q) {
        const hay = [j.title, j.company, j.tags.join(' ')].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // Location filter
      if (loc) {
        const jloc = j.location.toLowerCase();
        if (!jloc.includes(loc)) return false;
      }
      return true;
    });

    // Sort: best match first, then newest
    results.sort((a, b) => b.score - a.score || b.epoch - a.epoch);

    renderJobs(results);
  }

  // ── Render ─────────────────────────────────────────────────
  function timeAgo(epoch) {
    if (!epoch) return '';
    const diff = Date.now() - epoch * 1000;
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(h / 24);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    if (d < 30) return `${d}d ago`;
    return `${Math.floor(d / 30)}mo ago`;
  }

  function renderJobs(jobs) {
    const grid = document.getElementById('tech-jobs-grid');
    const countEl = document.getElementById('jobs-count');

    if (countEl) countEl.textContent = jobs.length
      ? `${jobs.length} job${jobs.length > 1 ? 's' : ''} found`
      : '';

    if (!jobs.length) {
      grid.innerHTML = '<div class="jobs-empty-v2">No jobs match your filters — try clearing the search or switching the stack tab.</div>';
      return;
    }

    grid.innerHTML = jobs.map(j => {
      const badge = j.score >= 6
        ? '<span class="match-strong">Strong match</span>'
        : j.score >= 3 ? '<span class="match-good">Good match</span>' : '';
      const tags = j.tags.map(t => `<span class="jc-tag">${t}</span>`).join('');
      const logo = j.logo
        ? `<img class="jc-logo" src="${j.logo}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : '';
      const loc = j.location || 'Remote';
      return `
        <div class="job-card-v2">
          <div class="jc-top">
            ${logo}
            <div style="flex:1;min-width:0">
              <a class="jc-title" href="${j.url}" target="_blank" rel="noopener noreferrer">${j.title}</a>
              <div class="jc-company">${j.company} ${badge}</div>
            </div>
          </div>
          <div class="jc-meta">
            <span class="jc-loc">${loc}</span>
            ${j.salary ? `<span class="jc-salary">${j.salary}</span>` : ''}
            <span class="jc-age">${timeAgo(j.epoch)}</span>
          </div>
          ${tags ? `<div class="jc-tags">${tags}</div>` : ''}
        </div>`;
    }).join('');
  }

  // ── Load by tag ────────────────────────────────────────────
  async function loadJobs() {
    const grid = document.getElementById('tech-jobs-grid');
    grid.innerHTML = '<div class="jobs-empty-v2" style="padding:1.5rem">Fetching jobs…</div>';
    const countEl = document.getElementById('jobs-count');
    if (countEl) countEl.textContent = '';

    try {
      allJobs = await fetchRemoteOK(TAG_MAP[currentTag] || currentTag);
    } catch (_) {
      try {
        allJobs = await fetchRemotive(currentTag);
      } catch (e) {
        allJobs = [];
        grid.innerHTML = `<div class="jobs-empty-v2">Could not load jobs — ${e.message}. Try refreshing.</div>`;
        return;
      }
    }
    applyFilters();
  }

  // ── Init ───────────────────────────────────────────────────
  function initJobs() {
    if (!document.getElementById('tech-jobs-grid')) return;

    // Stack chip tabs
    document.querySelectorAll('.jobs-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.jobs-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTag = btn.dataset.tag;
        loadJobs();
      });
    });

    // Role search input — debounced
    const roleInput = document.getElementById('jobs-role-input');
    if (roleInput) {
      roleInput.addEventListener('input', () => {
        searchQuery = roleInput.value;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(applyFilters, 280);
      });
    }

    // Location select
    const locSelect = document.getElementById('jobs-location-select');
    if (locSelect) {
      locSelect.addEventListener('change', () => {
        locationFilter = locSelect.value;
        applyFilters();
      });
    }

    // Refresh
    const refreshBtn = document.getElementById('jobs-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        cache = {};
        allJobs = [];
        loadJobs();
      });
    }

    loadJobs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJobs);
  } else {
    initJobs();
  }
})();
