// ── News + Shopping Feed ─────────────────────────────────────
// Dev.to    — cover images + descriptions (default)
// HN        — Algolia API
// Shopping  — r/frugalmalefashion (Reddit JSON, no key needed)

(function () {
  'use strict';

  let currentFeed = 'devto';
  let cache = {};

  // ── Brand quick-links for Shopping tab ────────────────────
  const BRANDS = [
    { name: 'Hollister',    sale: 'https://www.hollisterco.com/shop/us/guys-sale',            logo: 'https://logo.clearbit.com/hollisterco.com' },
    { name: 'Abercrombie',  sale: 'https://www.abercrombie.com/shop/us/mens-sale',             logo: 'https://logo.clearbit.com/abercrombie.com' },
    { name: 'H&M',          sale: 'https://www2.hm.com/en_us/men/sale.html',                  logo: 'https://logo.clearbit.com/hm.com' },
    { name: 'Zara',         sale: 'https://www.zara.com/us/en/man-sale-l855.html',             logo: 'https://logo.clearbit.com/zara.com' },
    { name: 'Cotton On',    sale: 'https://us.cottonon.com/sale/guys/',                        logo: 'https://logo.clearbit.com/cottonon.com' },
    { name: 'ASOS',         sale: 'https://www.asos.com/us/men/sale/',                         logo: 'https://logo.clearbit.com/asos.com' },
    { name: 'Gap',          sale: 'https://www.gap.com/browse/category.do?cid=1096649',        logo: 'https://logo.clearbit.com/gap.com' },
    { name: 'Banana Rep.',  sale: 'https://bananarepublic.gap.com/browse/category.do?cid=5148', logo: 'https://logo.clearbit.com/bananarepublic.com' },
    { name: 'Uniqlo',       sale: 'https://www.uniqlo.com/us/en/sale/men/',                    logo: 'https://logo.clearbit.com/uniqlo.com' },
    { name: 'Levi\'s',      sale: 'https://www.levi.com/US/en_US/sale/men',                    logo: 'https://logo.clearbit.com/levis.com' },
    { name: 'Nordstrom',    sale: 'https://www.nordstrom.com/browse/men/sale',                 logo: 'https://logo.clearbit.com/nordstrom.com' },
    { name: 'Everlane',     sale: 'https://www.everlane.com/collections/mens-sale',            logo: 'https://logo.clearbit.com/everlane.com' },
  ];

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

  // Shopping: r/frugalmalefashion — live clothing deals
  async function fetchShopping() {
    if (cache.shopping) return cache.shopping;
    const res = await fetch(
      'https://www.reddit.com/r/frugalmalefashion/new.json?limit=30',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) throw new Error('Reddit ' + res.status);
    const data = await res.json();
    const posts = data.data?.children || [];

    const DEAL_FLAIRS = ['deal/sale', 'deal', 'sale', 'ymmv', 'promo code', 'online deal'];

    const items = posts
      .map(p => p.data)
      .filter(p => {
        const flair = (p.link_flair_text || '').toLowerCase();
        // include if flair is deal/sale or has no flair (we'll still show)
        return !flair.includes('expired') && !flair.includes('oos')
          && !flair.includes('weekly') && !flair.includes('recommendation');
      })
      .map(p => ({
        title: p.title,
        url: p.url || `https://reddit.com${p.permalink}`,
        redditUrl: `https://reddit.com${p.permalink}`,
        flair: p.link_flair_text || 'Deal',
        points: p.score,
        comments: p.num_comments,
        time: p.created_utc,
        image: p.thumbnail && !['self','default','nsfw','spoiler'].includes(p.thumbnail)
          ? p.thumbnail : null,
      }))
      .slice(0, 20);

    cache.shopping = items;
    return items;
  }

  const FETCHERS = { devto: fetchDevTo, hn: fetchHN, shopping: fetchShopping };

  // ── Helpers ────────────────────────────────────────────────

  function timeAgo(val) {
    const ts = typeof val === 'number' ? val * 1000 : new Date(val).getTime();
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // ── Render: News (hero + grid) ─────────────────────────────

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
        ${item.image ? `<img class="news-card-thumb" src="${item.image}" alt="" loading="lazy">` : ''}
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

  // ── Render: Shopping ───────────────────────────────────────

  function renderShopping(deals) {
    const hero = document.getElementById('news-hero');
    const grid = document.getElementById('news-grid');

    // Brand row
    hero.innerHTML = `
      <div class="shop-brands-wrap">
        <div class="shop-brands-label">
          <span class="live-dot-v2" style="background:var(--accent2)"></span>
          Sale pages — US stores
        </div>
        <div class="shop-brands-grid">
          ${BRANDS.map(b => `
            <a class="shop-brand-card" href="${b.sale}" target="_blank" rel="noopener noreferrer">
              <img class="shop-brand-logo" src="${b.logo}" alt="${b.name}" loading="lazy" onerror="this.style.display='none'">
              <span class="shop-brand-name">${b.name}</span>
              <span class="shop-brand-cta">Shop Sale →</span>
            </a>`).join('')}
        </div>
        <div class="shop-source-note">Live deals from <a href="https://reddit.com/r/frugalmalefashion" target="_blank" rel="noopener">r/FrugalMaleFashion</a> · ${deals.length} active deals</div>
      </div>`;

    // Deal cards
    if (!deals.length) {
      grid.innerHTML = '<div class="news-loading-v2">No deals found right now.</div>';
      return;
    }

    grid.innerHTML = deals.map(d => {
      const flairColor = d.flair.toLowerCase().includes('ymmv') ? 'var(--yellow)'
        : d.flair.toLowerCase().includes('expired') ? 'var(--muted)'
        : 'var(--accent2)';
      return `
        <div class="news-card-v2">
          ${d.image ? `<img class="news-card-thumb" src="${d.image}" alt="" loading="lazy" onerror="this.parentNode.removeChild(this)">` : ''}
          <div class="news-card-body">
            <a class="news-card-title" href="${d.url}" target="_blank" rel="noopener noreferrer">${d.title}</a>
            <div class="news-card-meta">
              <span class="news-card-src" style="background:transparent;border:1px solid ${flairColor};color:${flairColor}">${d.flair}</span>
              <span>${d.points} pts</span>
              <span>${d.comments} comments</span>
              <span>${timeAgo(d.time)}</span>
            </div>
            <a href="${d.redditUrl}" target="_blank" rel="noopener" style="font-size:0.7rem;color:var(--muted);text-decoration:none;margin-top:auto">
              View on Reddit →
            </a>
          </div>
        </div>`;
    }).join('');
  }

  // ── Load ───────────────────────────────────────────────────

  async function loadFeed(feedKey) {
    const hero = document.getElementById('news-hero');
    const grid = document.getElementById('news-grid');
    if (feedKey !== 'shopping') {
      hero.innerHTML = '<div style="color:var(--muted);padding:2rem;text-align:center">Loading…</div>';
    }
    grid.innerHTML = '<div class="news-loading-v2">Loading…</div>';

    try {
      const items = await FETCHERS[feedKey]();
      if (feedKey === 'shopping') {
        renderShopping(items);
      } else {
        if (!items.length) throw new Error('No items returned');
        renderHero(items[0]);
        renderGrid(items.slice(1));
      }
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
        delete cache[currentFeed];
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
