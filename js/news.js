// ── Tech News Feed ──────────────────────────────────────────
// Dev.to (default — has cover images + descriptions)
// Hacker News via Algolia API
// Lobsters JSON

(function () {
  'use strict';

  let currentFeed = 'devto';
  let cache = {};

  // ── Fetchers ───────────────────────────────────────────────

  async function fetchDevTo() {
    if (cache.devto) return cache.devto;
    const res = await fetch('https://dev.to/api/articles?per_page=13&top=1');
    if (!res.ok) throw new Error('Dev.to ' + res.status);
    const data = await res.json();
    const items = data.map(a => ({
      title: a.title,
      url: a.url,
      description: a.description || '',
      image: a.cover_image || a.social_image || null,
      source: (a.tag_list && a.tag_list[0]) ? '#' + a.tag_list[0] : 'Dev.to',
      author: a.user?.name || 'Dev.to',
      points: a.positive_reactions_count,
      comments: a.comments_count,
      readTime: a.reading_time_minutes,
      time: a.published_at,
    }));
    cache.devto = items;
    return items;
  }

  async function fetchHN() {
    if (cache.hn) return cache.hn;
    const res = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=13');
    if (!res.ok) throw new Error('HN ' + res.status);
    const data = await res.json();
    const items = data.hits.map(h => ({
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      description: '',
      image: null,
      source: 'Hacker News',
      author: h.author,
      points: h.points,
      comments: h.num_comments,
      readTime: null,
      time: h.created_at,
    }));
    cache.hn = items;
    return items;
  }

  async function fetchLobsters() {
    if (cache.lobsters) return cache.lobsters;
    const res = await fetch('https://lobste.rs/hottest.json');
    if (!res.ok) throw new Error('Lobsters ' + res.status);
    const data = await res.json();
    const items = data.slice(0, 13).map(s => ({
      title: s.title,
      url: s.url || `https://lobste.rs/s/${s.short_id}`,
      description: '',
      image: null,
      source: (s.tags && s.tags[0]) ? s.tags[0] : 'Lobsters',
      author: s.submitter_user?.username || '',
      points: s.score,
      comments: s.comment_count,
      readTime: null,
      time: s.created_at,
    }));
    cache.lobsters = items;
    return items;
  }

  const FETCHERS = { devto: fetchDevTo, hn: fetchHN, lobsters: fetchLobsters };

  // ── Helpers ────────────────────────────────────────────────

  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // ── Render ─────────────────────────────────────────────────

  function renderHero(item) {
    const hero = document.getElementById('news-hero');
    const hasImage = !!item.image;

    hero.innerHTML = `
      <a class="news-hero-card" href="${item.url}" target="_blank" rel="noopener noreferrer">
        ${hasImage
          ? `<img class="news-hero-img" src="${item.image}" alt="" loading="lazy">`
          : `<div class="news-hero-placeholder"></div>`}
        <div class="${hasImage ? 'news-hero-overlay' : 'news-hero-no-overlay'}">
          <div class="news-hero-badge">${item.source}</div>
          <div class="news-hero-title">${item.title}</div>
          ${item.description ? `<div class="news-hero-desc">${item.description}</div>` : ''}
          <div class="news-hero-meta">
            ${item.author ? `<span>by ${item.author}</span>` : ''}
            <span>${item.points ?? 0} pts</span>
            <span>${item.comments ?? 0} comments</span>
            ${item.readTime ? `<span>${item.readTime} min read</span>` : ''}
            <span>${timeAgo(item.time)}</span>
          </div>
        </div>
      </a>`;
  }

  function renderGrid(items) {
    const grid = document.getElementById('news-grid');
    if (!items.length) {
      grid.innerHTML = '<div class="news-loading-v2">No stories found.</div>';
      return;
    }
    grid.innerHTML = items.map(item => `
      <div class="news-card-v2">
        ${item.image
          ? `<img class="news-card-thumb" src="${item.image}" alt="" loading="lazy">`
          : ''}
        <div class="news-card-body">
          <a class="news-card-title" href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a>
          ${item.description ? `<div class="news-card-desc">${item.description}</div>` : ''}
          <div class="news-card-meta">
            <span class="news-card-src">${item.source}</span>
            <span>${item.points ?? 0} pts</span>
            <span>${item.comments ?? 0} comments</span>
            <span>${timeAgo(item.time)}</span>
          </div>
        </div>
      </div>`).join('');
  }

  // ── Load ───────────────────────────────────────────────────

  async function loadFeed(feedKey) {
    const hero = document.getElementById('news-hero');
    const grid = document.getElementById('news-grid');
    hero.innerHTML = '<div style="color:var(--muted);padding:2rem;text-align:center">Loading…</div>';
    grid.innerHTML = '<div class="news-loading-v2">Loading stories…</div>';

    try {
      const items = await FETCHERS[feedKey]();
      if (!items.length) throw new Error('No items returned');
      renderHero(items[0]);
      renderGrid(items.slice(1));
    } catch (err) {
      hero.innerHTML = '';
      grid.innerHTML = `<div class="news-loading-v2" style="color:var(--red)">
        Failed to load — ${err.message}. Try refreshing.
      </div>`;
    }
  }

  // ── Init ───────────────────────────────────────────────────

  function initNews() {
    if (!document.getElementById('news-grid')) return;

    document.querySelectorAll('.src-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.src-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFeed = tab.dataset.feed;
        delete cache[currentFeed]; // allow refresh
        loadFeed(currentFeed);
      });
    });

    const refreshBtn = document.getElementById('news-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        delete cache[currentFeed];
        loadFeed(currentFeed);
      });
    }

    loadFeed(currentFeed);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNews);
  } else {
    initNews();
  }
})();
