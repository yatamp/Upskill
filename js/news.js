// ── Tech News Feed ──────────────────────────────────────────
// Uses public CORS-friendly APIs — no key required

const FEEDS = {
  hn: {
    label: 'Hacker News',
    fetch: fetchHN,
  },
  devto: {
    label: 'Dev.to',
    fetch: fetchDevTo,
  },
  lobsters: {
    label: 'Lobsters',
    fetch: fetchLobsters,
  },
};

let currentFeed = 'hn';

async function fetchHN() {
  // HN Algolia API — top stories, sorted by points
  const res = await fetch(
    'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=12'
  );
  const data = await res.json();
  return data.hits.map(h => ({
    title: h.title,
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    source: 'Hacker News',
    points: h.points,
    comments: h.num_comments,
    time: h.created_at,
  }));
}

async function fetchDevTo() {
  const res = await fetch(
    'https://dev.to/api/articles?per_page=12&top=1'
  );
  const data = await res.json();
  return data.map(a => ({
    title: a.title,
    url: a.url,
    source: a.tag_list?.[0] || 'Dev.to',
    points: a.positive_reactions_count,
    comments: a.comments_count,
    time: a.published_at,
  }));
}

async function fetchLobsters() {
  // Lobsters JSON API
  const res = await fetch('https://lobste.rs/hottest.json');
  const data = await res.json();
  return data.slice(0, 12).map(s => ({
    title: s.title,
    url: s.url || `https://lobste.rs/s/${s.short_id}`,
    source: s.tags?.[0] || 'Lobsters',
    points: s.score,
    comments: s.comment_count,
    time: s.created_at,
  }));
}

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function renderCards(items) {
  const grid = document.getElementById('news-grid');
  if (!items || items.length === 0) {
    grid.innerHTML = '<div class="news-loading">No stories found.</div>';
    return;
  }
  grid.innerHTML = items.map(item => `
    <div class="news-card">
      <a href="${item.url}" target="_blank" rel="noopener">${item.title}</a>
      <div class="news-meta">
        <span class="news-source">${item.source}</span>
        <span>${item.points ?? 0} pts</span>
        <span>${item.comments ?? 0} comments</span>
        <span>${timeAgo(item.time)}</span>
      </div>
    </div>
  `).join('');
}

async function loadFeed(feedKey) {
  const grid = document.getElementById('news-grid');
  grid.innerHTML = '<div class="news-loading">Loading...</div>';
  try {
    const items = await FEEDS[feedKey].fetch();
    renderCards(items);
  } catch (err) {
    grid.innerHTML = `<div class="news-loading" style="color:var(--red)">
      Failed to load — check console or try refreshing.<br/>
      <small style="opacity:0.6">${err.message}</small>
    </div>`;
  }
}

function initNews() {
  const grid = document.getElementById('news-grid');
  if (!grid) return;

  // Tab switching
  document.querySelectorAll('.news-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.news-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFeed = tab.dataset.feed;
      loadFeed(currentFeed);
    });
  });

  // Refresh button
  const refreshBtn = document.getElementById('news-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadFeed(currentFeed));
  }

  // Initial load
  loadFeed(currentFeed);
}

document.addEventListener('DOMContentLoaded', initNews);
