// ── Live Jobs Feed ───────────────────────────────────────────
// Primary: Greenhouse ATS API — tier-1 tech company job boards
// Supplemental: RemoteOK API for broader remote coverage
// All filtering (search, location, stack tag) is client-side

(function () {
  'use strict';

  let allJobs = [];
  let currentTag = 'all';
  let searchQuery = '';
  let locationFilter = '';
  let debounceTimer = null;
  let cache = {};

  // ── Tier-1 & Tier-2 companies on Greenhouse ATS ────────────
  const GREENHOUSE_COMPANIES = [
    { name: 'Stripe',         slug: 'stripe',        logo: 'https://logo.clearbit.com/stripe.com' },
    { name: 'Cloudflare',     slug: 'cloudflare',    logo: 'https://logo.clearbit.com/cloudflare.com' },
    { name: 'Datadog',        slug: 'datadog',       logo: 'https://logo.clearbit.com/datadoghq.com' },
    { name: 'Grafana Labs',   slug: 'grafanalabs',   logo: 'https://logo.clearbit.com/grafana.com' },
    { name: 'Vercel',         slug: 'vercel',        logo: 'https://logo.clearbit.com/vercel.com' },
    { name: 'PagerDuty',      slug: 'pagerduty',     logo: 'https://logo.clearbit.com/pagerduty.com' },
    { name: 'Figma',          slug: 'figma',         logo: 'https://logo.clearbit.com/figma.com' },
    { name: 'Brex',           slug: 'brex',          logo: 'https://logo.clearbit.com/brex.com' },
    { name: 'Plaid',          slug: 'plaid',         logo: 'https://logo.clearbit.com/plaid.com' },
    { name: 'Robinhood',      slug: 'robinhood',     logo: 'https://logo.clearbit.com/robinhood.com' },
    { name: 'DoorDash',       slug: 'doordash',      logo: 'https://logo.clearbit.com/doordash.com' },
    { name: 'Reddit',         slug: 'reddit',        logo: 'https://logo.clearbit.com/reddit.com' },
    { name: 'Coinbase',       slug: 'coinbase',      logo: 'https://logo.clearbit.com/coinbase.com' },
    { name: 'Benchling',      slug: 'benchling',     logo: 'https://logo.clearbit.com/benchling.com' },
    { name: 'Vanta',          slug: 'vanta',         logo: 'https://logo.clearbit.com/vanta.com' },
  ];

  // Profile keywords for match scoring
  const PROFILE = [
    'go', 'golang', 'kubernetes', 'k8s', 'kafka', 'terraform', 'docker',
    'prometheus', 'grafana', 'datadog', 'grpc', 'redis', 'python', 'aws',
    'platform', 'devops', 'sre', 'reliability', 'helm', 'github actions',
    'microservices', 'observability', 'backend', 'distributed', 'cloud',
    'linux', 'ci/cd', 'pipeline', 'infrastructure',
  ];

  // Stack filter → keywords to match in title/tags
  const TAG_KEYWORDS = {
    all:        ['engineer', 'platform', 'devops', 'sre', 'backend', 'infrastructure', 'reliability', 'golang', 'infra'],
    golang:     ['go', 'golang'],
    python:     ['python'],
    kubernetes: ['kubernetes', 'k8s'],
    kafka:      ['kafka', 'data engineer', 'streaming'],
    terraform:  ['terraform', 'infrastructure', 'infra', 'iac'],
    sre:        ['sre', 'reliability', 'site reliability'],
    platform:   ['platform', 'devops', 'infrastructure engineer'],
    backend:    ['backend', 'back-end', 'server-side'],
  };

  // ── US location check ──────────────────────────────────────
  function isUS(loc) {
    if (!loc || !loc.trim()) return true;
    const l = loc.toLowerCase();
    // Explicit non-US — skip
    const SKIP = ['paris', 'london', 'berlin', 'lisbon', 'sydney', 'amsterdam',
      'toronto (not', 'india', 'bengaluru', 'singapo', 'latam', 'mexico city',
      'münchen', 'munich', 'madrid', 'rome', 'milan', 'warsaw', 'krakow'];
    if (SKIP.some(s => l.includes(s))) return false;
    const ALLOW = [
      'united states', 'usa', 'u.s.', 'remote', 'global', 'worldwide',
      'anywhere', 'hybrid', 'distributed', 'north america', 'americas',
      'new york', 'san francisco', 'austin', 'seattle', 'chicago',
      'boston', 'denver', 'los angeles', 'atlanta', 'dallas', 'miami',
      'remote - us', 'remote (us)', 'us only', 'canada',
    ];
    return ALLOW.some(s => l.includes(s));
  }

  // ── Score ──────────────────────────────────────────────────
  function score(title) {
    const t = title.toLowerCase();
    return PROFILE.filter(k => t.includes(k)).length;
  }

  // ── Fetch: Greenhouse (one company) ───────────────────────
  async function fetchGreenhouse(company) {
    const key = 'gh_' + company.slug;
    if (cache[key]) return cache[key];
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs?content=false`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const ENG_TERMS = ['engineer', 'engineering', 'platform', 'devops', 'sre', 'reliability',
      'backend', 'infrastructure', 'infra', 'golang', 'data infra'];
    const jobs = (data.jobs || [])
      .filter(j => {
        const t = j.title.toLowerCase();
        return ENG_TERMS.some(k => t.includes(k));
      })
      .filter(j => isUS(j.location?.name))
      .map(j => ({
        title: j.title,
        company: company.name,
        logo: company.logo,
        url: j.absolute_url,
        location: j.location?.name || 'Remote',
        salary: '',
        tags: [],
        updatedAt: j.updated_at,
        score: score(j.title),
        source: 'Greenhouse',
      }));
    cache[key] = jobs;
    return jobs;
  }

  // ── Fetch: RemoteOK supplement ─────────────────────────────
  async function fetchRemoteOK(tag) {
    const rokTag = tag === 'all' ? 'devops' : tag;
    const key = 'rok_' + rokTag;
    if (cache[key]) return cache[key];
    try {
      const res = await fetch(`https://remoteok.com/api?tag=${rokTag}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      const jobs = data
        .filter(j => j && j.position && j.company)
        .filter(j => isUS(j.location))
        .map(j => ({
          title: j.position,
          company: j.company,
          logo: j.company_logo || j.logo || null,
          url: j.apply_url || j.url || `https://remoteok.com/remote-jobs/${j.slug}`,
          location: j.location || 'Remote',
          salary: j.salary_min > 0
            ? `$${Math.round(j.salary_min / 1000)}k–$${Math.round(j.salary_max / 1000)}k`
            : '',
          tags: (j.tags || []).slice(0, 5),
          updatedAt: j.epoch ? new Date(j.epoch * 1000).toISOString() : null,
          score: score(j.position),
          source: 'RemoteOK',
        }));
      cache[key] = jobs;
      return jobs;
    } catch (_) { return []; }
  }

  // ── Load all jobs ──────────────────────────────────────────
  async function loadAllJobs() {
    const grid = document.getElementById('tech-jobs-grid');
    const countEl = document.getElementById('jobs-count');
    grid.innerHTML = '<div class="jobs-empty-v2" style="padding:1.5rem">Fetching jobs from tier-1 companies…</div>';
    if (countEl) countEl.textContent = '';

    try {
      // Fetch all Greenhouse boards in parallel + RemoteOK
      const results = await Promise.allSettled([
        ...GREENHOUSE_COMPANIES.map(c => fetchGreenhouse(c)),
        fetchRemoteOK(currentTag),
      ]);

      allJobs = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value);

      if (!allJobs.length) throw new Error('No jobs returned from any source');
    } catch (e) {
      allJobs = [];
      grid.innerHTML = `<div class="jobs-empty-v2">Could not load jobs — ${e.message}. Try refreshing.</div>`;
      return;
    }

    applyFilters();
  }

  // ── Client-side filtering ──────────────────────────────────
  function applyFilters() {
    const q = searchQuery.toLowerCase().trim();
    const loc = locationFilter.toLowerCase().trim();
    const tagKw = TAG_KEYWORDS[currentTag] || TAG_KEYWORDS.all;

    let results = allJobs.filter(j => {
      const title = j.title.toLowerCase();
      const company = j.company.toLowerCase();
      const jloc = j.location.toLowerCase();

      // Stack/tag filter
      const matchesTag = tagKw.some(k => title.includes(k) || (j.tags || []).some(t => t.toLowerCase().includes(k)));
      if (!matchesTag) return false;

      // Free-text search
      if (q && ![title, company, (j.tags || []).join(' ')].join(' ').includes(q)) return false;

      // Location dropdown
      if (loc && !jloc.includes(loc)) return false;

      return true;
    });

    // Sort: best profile match, then newest
    results.sort((a, b) => b.score - a.score
      || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    // Deduplicate by title+company
    const seen = new Set();
    results = results.filter(j => {
      const key = j.title.toLowerCase() + j.company.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    renderJobs(results.slice(0, 40));

    if (document.getElementById('jobs-count')) {
      document.getElementById('jobs-count').textContent =
        results.length ? `${results.length} job${results.length > 1 ? 's' : ''} found` : '';
    }
  }

  // ── Render ─────────────────────────────────────────────────
  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(h / 24);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    if (d < 30) return `${d}d ago`;
    return `${Math.floor(d / 30)}mo ago`;
  }

  function renderJobs(jobs) {
    const grid = document.getElementById('tech-jobs-grid');
    if (!jobs.length) {
      grid.innerHTML = '<div class="jobs-empty-v2">No jobs match your filters — try clearing the search or switching the stack tab.</div>';
      return;
    }
    grid.innerHTML = jobs.map(j => {
      const badge = j.score >= 5
        ? '<span class="match-strong">Strong match</span>'
        : j.score >= 3 ? '<span class="match-good">Good match</span>' : '';
      const tags = (j.tags || []).map(t => `<span class="jc-tag">${t}</span>`).join('');
      const logo = j.logo
        ? `<img class="jc-logo" src="${j.logo}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="jc-logo-fallback">${j.company[0]}</div>`;
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
            <span class="jc-loc">${j.location}</span>
            ${j.salary ? `<span class="jc-salary">${j.salary}</span>` : ''}
            <span class="jc-age">${timeAgo(j.updatedAt)}</span>
          </div>
          ${tags ? `<div class="jc-tags">${tags}</div>` : ''}
        </div>`;
    }).join('');
  }

  // ── Init ───────────────────────────────────────────────────
  function initJobs() {
    if (!document.getElementById('tech-jobs-grid')) return;

    // Stack chips
    document.querySelectorAll('.jobs-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.jobs-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTag = btn.dataset.tag;
        applyFilters(); // filter already-loaded jobs, no refetch
      });
    });

    // Role search
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
        loadAllJobs();
      });
    }

    loadAllJobs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJobs);
  } else {
    initJobs();
  }
})();
