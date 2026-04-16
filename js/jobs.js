// ── Live Jobs Feed ───────────────────────────────────────────
// Primary: RemoteOK API (free, CORS-friendly, has real jobs)
// Fallback: Remotive API (category-based, also free)
// Modeling: Casting Call Club RSS via rss2json.com

(function () {
  'use strict';

  let currentType = 'tech';
  let currentTag = 'devops';
  let cache = {};

  // Profile keywords for match scoring
  const PROFILE = [
    'go', 'golang', 'kubernetes', 'k8s', 'kafka', 'terraform', 'docker',
    'prometheus', 'grafana', 'datadog', 'grpc', 'redis', 'python', 'aws',
    'platform', 'devops', 'sre', 'reliability', 'helm', 'github actions',
    'microservices', 'observability', 'backend', 'distributed', 'cloud',
    'linux', 'ci/cd', 'pipeline', 'infrastructure'
  ];

  // RemoteOK tags → filter chips
  const TAG_MAP = {
    devops:   'devops',
    golang:   'golang',
    kubernetes: 'kubernetes',
    platform: 'devops',  // RemoteOK doesn't have "platform" tag, use devops
    kafka:    'kafka',
    sre:      'sre',
  };

  // Remotive category fallback
  const REMOTIVE_CAT = {
    devops:     'devops-sysadmin',
    golang:     'software-dev',
    kubernetes: 'devops-sysadmin',
    platform:   'devops-sysadmin',
    kafka:      'devops-sysadmin',
    sre:        'devops-sysadmin',
  };

  // ── US accessibility check ─────────────────────────────────
  // Accept: empty (worldwide), explicit US cities/states, "remote", "global", "anywhere", North America
  // Reject: specific non-US cities/countries with no US mention
  function isUsAccessible(loc) {
    if (!loc || loc.trim() === '') return true; // empty = worldwide
    const l = loc.toLowerCase();

    // Must contain one of these to be considered US-accessible
    const ALLOW = [
      'remote', 'global', 'worldwide', 'anywhere', 'distributed', 'international',
      'united states', 'usa', 'u.s.', 'america', 'north america',
      'canada', 'ontario', 'quebec',
      // US cities / states RemoteOK uses
      'new york', ' ny', 'san francisco', 'austin', 'chicago', 'seattle',
      'boston', 'denver', 'los angeles', 'atlanta', 'dallas', 'miami',
      'reston', 'rockville', 'chantilly', 'salt lake', 'redwood',
    ];
    return ALLOW.some(s => l.includes(s));
  }

  // ── Match score ────────────────────────────────────────────
  function scoreJob(title, desc, tags) {
    const hay = [title, desc, (tags || []).join(' ')].join(' ').toLowerCase();
    return PROFILE.filter(k => hay.includes(k)).length;
  }

  // ── Fetch: RemoteOK ────────────────────────────────────────
  async function fetchRemoteOK(tag) {
    const key = 'rok_' + tag;
    if (cache[key]) return cache[key];

    const res = await fetch(`https://remoteok.com/api?tag=${tag}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw new Error('RemoteOK ' + res.status);
    const data = await res.json();

    const jobs = data
      .filter(j => j && j.position && j.company) // skip metadata object
      .filter(j => isUsAccessible(j.location))
      .map(j => ({
        title: j.position,
        company: j.company,
        logo: j.company_logo || j.logo || null,
        url: j.apply_url || j.url || `https://remoteok.com/remote-jobs/${j.slug}`,
        location: j.location || 'Remote (Worldwide)',
        salary: j.salary_min && j.salary_min > 0
          ? `$${Math.round(j.salary_min / 1000)}k–$${Math.round(j.salary_max / 1000)}k`
          : '',
        tags: (j.tags || []).slice(0, 5),
        date: j.date || j.epoch ? new Date((j.epoch || 0) * 1000).toISOString() : null,
        score: scoreJob(j.position, j.description || '', j.tags),
        source: 'RemoteOK',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    if (!jobs.length) throw new Error('no results');
    cache[key] = jobs;
    return jobs;
  }

  // ── Fetch: Remotive fallback ───────────────────────────────
  async function fetchRemotive(tag) {
    const cat = REMOTIVE_CAT[tag] || 'devops-sysadmin';
    const key = 'rem_' + cat;
    if (cache[key]) return cache[key];

    const res = await fetch(`https://remotive.com/api/remote-jobs?category=${cat}&limit=30`);
    if (!res.ok) throw new Error('Remotive ' + res.status);
    const data = await res.json();

    const jobs = (data.jobs || [])
      .filter(j => isUsAccessible(j.candidate_required_location))
      .map(j => ({
        title: j.title,
        company: j.company_name,
        logo: j.company_logo_url || j.company_logo || null,
        url: j.url,
        location: j.candidate_required_location || 'Remote',
        salary: j.salary ? j.salary.replace(/<[^>]+>/g, '').slice(0, 60) : '',
        tags: (j.tags || []).slice(0, 5),
        date: j.publication_date || null,
        score: scoreJob(j.title, j.description || '', j.tags),
        source: 'Remotive',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    cache[key] = jobs;
    return jobs;
  }

  // ── Fetch: Modeling (Casting Call Club RSS) ────────────────
  async function fetchModeling() {
    if (cache.modeling) return cache.modeling;

    try {
      const rssUrl = encodeURIComponent('https://www.castingcallclub.com/rss/jobs/casting-calls');
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&count=15`);
      const d = await res.json();
      if (d.status === 'ok' && d.items?.length) {
        cache.modeling = d.items;
        return d.items;
      }
    } catch (_) {}

    // Fallback: Indeed RSS
    try {
      const rssUrl = encodeURIComponent(
        'https://www.indeed.com/rss?q=model+casting+brand+shoot&l=United+States&sort=date'
      );
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&count=15`);
      const d = await res.json();
      cache.modeling = d.items || [];
      return cache.modeling;
    } catch (_) {}

    cache.modeling = [];
    return [];
  }

  // ── Helpers ────────────────────────────────────────────────
  function timeAgo(val) {
    if (!val) return '';
    const ts = typeof val === 'number' ? val * 1000 : new Date(val).getTime();
    const diff = Date.now() - ts;
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(h / 24);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    if (d < 30) return `${d}d ago`;
    return `${Math.floor(d / 30)}mo ago`;
  }

  function stripHtml(s) {
    const d = document.createElement('div');
    d.innerHTML = s;
    return (d.textContent || d.innerText || '').trim();
  }

  // ── Render: Tech jobs ──────────────────────────────────────
  function renderTechJobs(jobs) {
    const grid = document.getElementById('tech-jobs-grid');
    if (!jobs.length) {
      grid.innerHTML = '<div class="jobs-empty-v2">No US remote jobs found right now — try a different filter or refresh.</div>';
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
      return `
        <div class="job-card-v2">
          <div class="jc-top">
            ${logo}
            <div style="flex:1;min-width:0">
              <a class="jc-title" href="${j.url}" target="_blank" rel="noopener noreferrer">${j.title}</a>
              <div class="jc-company">${j.company}${badge}</div>
            </div>
          </div>
          <div class="jc-meta">
            <span class="jc-loc">${j.location}</span>
            ${j.salary ? `<span class="jc-salary">${j.salary}</span>` : ''}
            <span class="jc-age">${timeAgo(j.date)}</span>
          </div>
          ${tags ? `<div class="jc-tags">${tags}</div>` : ''}
        </div>`;
    }).join('');
  }

  // ── Render: Modeling ───────────────────────────────────────
  function renderModeling(items) {
    const grid = document.getElementById('modeling-jobs-grid');
    if (!items.length) {
      grid.innerHTML = '<div class="jobs-empty-v2">No casting calls loaded right now — use the platform links above for live listings.</div>';
      return;
    }
    grid.innerHTML = items.map(item => {
      const desc = stripHtml(item.description || item.content || '').slice(0, 140);
      return `
        <div class="job-card-v2">
          <a class="jc-title" href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
          <div class="jc-company">${item.author || 'Casting Call'}</div>
          <div class="jc-meta">
            <span class="jc-age">${timeAgo(item.pubDate)}</span>
          </div>
          ${desc ? `<p style="font-size:0.75rem;color:var(--muted);line-height:1.5;margin:0">${desc}…</p>` : ''}
        </div>`;
    }).join('');
  }

  // ── Load ───────────────────────────────────────────────────
  async function loadTechJobs() {
    const grid = document.getElementById('tech-jobs-grid');
    grid.innerHTML = '<div class="jobs-empty-v2" style="padding:1.5rem">Fetching US remote jobs…</div>';

    try {
      const jobs = await fetchRemoteOK(TAG_MAP[currentTag] || currentTag);
      renderTechJobs(jobs);
    } catch (e1) {
      // Fallback to Remotive
      try {
        const jobs = await fetchRemotive(currentTag);
        renderTechJobs(jobs);
      } catch (e2) {
        grid.innerHTML = `<div class="jobs-empty-v2">Could not load jobs (${e1.message}). Check your network and try refreshing.</div>`;
      }
    }
  }

  async function loadModeling() {
    const grid = document.getElementById('modeling-jobs-grid');
    grid.innerHTML = '<div class="jobs-empty-v2" style="padding:1.5rem">Fetching casting calls…</div>';
    try {
      const items = await fetchModeling();
      renderModeling(items);
    } catch (_) {
      grid.innerHTML = '<div class="jobs-empty-v2">Could not load casting calls.</div>';
    }
  }

  function switchType(type) {
    currentType = type;
    document.querySelectorAll('.jobs-type-tab-v2').forEach(t =>
      t.classList.toggle('active', t.dataset.type === type)
    );
    document.getElementById('jobs-panel-tech').style.display = type === 'tech' ? '' : 'none';
    document.getElementById('jobs-panel-modeling').style.display = type === 'modeling' ? '' : 'none';
    if (type === 'tech') loadTechJobs();
    else loadModeling();
  }

  // ── Init ───────────────────────────────────────────────────
  function initJobs() {
    if (!document.getElementById('tech-jobs-grid')) return;

    document.querySelectorAll('.jobs-type-tab-v2').forEach(tab =>
      tab.addEventListener('click', () => switchType(tab.dataset.type))
    );

    document.querySelectorAll('.jobs-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.jobs-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTag = btn.dataset.tag;
        delete cache['rok_' + (TAG_MAP[currentTag] || currentTag)];
        delete cache['rem_' + (REMOTIVE_CAT[currentTag] || currentTag)];
        loadTechJobs();
      });
    });

    const refreshBtn = document.getElementById('jobs-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        cache = {};
        if (currentType === 'tech') loadTechJobs();
        else loadModeling();
      });
    }

    loadTechJobs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJobs);
  } else {
    initJobs();
  }
})();
