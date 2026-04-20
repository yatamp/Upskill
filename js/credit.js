// ── Credit Score Dashboard ───────────────────────────────────
// All logic is educational/informational — based on FICO Score 8 model
// official factor weights and bureau-published guidance.

(function () {
  'use strict';

  const GOAL = 740;
  const MIN = 300;
  const MAX = 850;
  const STORAGE_KEY = 'upskill_credit_score';

  // ── Score metadata ─────────────────────────────────────────
  function getScoreMeta(score) {
    if (score < 580) return { label: 'Poor',      color: '#ef4444', range: 'poor',  tier: 1 };
    if (score < 670) return { label: 'Fair',      color: '#f97316', range: 'fair',  tier: 2 };
    if (score < 740) return { label: 'Good',      color: '#eab308', range: 'good',  tier: 3 };
    if (score < 800) return { label: 'Very Good', color: '#22c55e', range: 'vgood', tier: 4 };
    return              { label: 'Exceptional', color: '#6366f1', range: 'exc',   tier: 5 };
  }

  // ── Gauge (half-donut canvas) ──────────────────────────────
  function drawGauge(canvas, score, goal) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H - 10;
    const r = H - 25;
    const start = Math.PI;      // 180° (left)
    const end = 2 * Math.PI;    // 360° (right)

    function scoreToAngle(s) {
      return start + ((s - MIN) / (MAX - MIN)) * Math.PI;
    }

    // Track background
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.strokeStyle = '#2a2d3a';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Colour segments
    const segs = [
      { from: 300, to: 580, color: '#ef4444' },
      { from: 580, to: 670, color: '#f97316' },
      { from: 670, to: 740, color: '#eab308' },
      { from: 740, to: 800, color: '#22c55e' },
      { from: 800, to: 850, color: '#6366f1' },
    ];
    segs.forEach(s => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, scoreToAngle(s.from), scoreToAngle(Math.min(s.to, MAX)));
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 14;
      ctx.lineCap = 'butt';
      ctx.globalAlpha = 0.25;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    if (score) {
      // Filled progress arc
      const meta = getScoreMeta(score);
      const grd = ctx.createLinearGradient(0, 0, W, 0);
      grd.addColorStop(0, '#6366f1');
      grd.addColorStop(1, meta.color);
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, scoreToAngle(score));
      ctx.strokeStyle = grd;
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Needle
      const needleAngle = scoreToAngle(score);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + (r - 22) * Math.cos(needleAngle),
        cy + (r - 22) * Math.sin(needleAngle)
      );
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Centre dot
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }

    // Goal marker
    const goalAngle = scoreToAngle(goal);
    ctx.beginPath();
    ctx.moveTo(
      cx + (r - 8) * Math.cos(goalAngle),
      cy + (r - 8) * Math.sin(goalAngle)
    );
    ctx.lineTo(
      cx + (r + 8) * Math.cos(goalAngle),
      cy + (r + 8) * Math.sin(goalAngle)
    );
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Goal label
    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('740', cx + (r + 18) * Math.cos(goalAngle), cy + (r + 18) * Math.sin(goalAngle));
  }

  // ── Update UI ──────────────────────────────────────────────
  function update(score) {
    if (!score || score < MIN || score > MAX) return;

    const meta = getScoreMeta(score);
    localStorage.setItem(STORAGE_KEY, score);

    // Gauge
    const canvas = document.getElementById('credit-gauge');
    if (canvas) drawGauge(canvas, score, GOAL);

    // Score display
    document.getElementById('gauge-score-display').textContent = score;
    document.getElementById('gauge-score-display').style.color = meta.color;
    document.getElementById('gauge-label-display').textContent = meta.label;

    // Band highlight
    document.querySelectorAll('.credit-band').forEach(b => {
      b.classList.toggle('active', b.dataset.range === meta.range);
    });

    // Progress to 740
    const pct = score >= GOAL
      ? 100
      : Math.round(((score - MIN) / (GOAL - MIN)) * 100);
    const fill = document.getElementById('credit-goal-fill');
    const pctLabel = document.getElementById('credit-pct-label');
    if (fill) fill.style.width = Math.min(pct, 100) + '%';
    if (pctLabel) {
      pctLabel.textContent = score >= GOAL
        ? `✓ Goal reached!`
        : `${score} → 740 (${100 - pct}% to go)`;
      pctLabel.style.color = score >= GOAL ? 'var(--green)' : 'var(--muted)';
    }

    // Action plan
    renderActions(score, meta);

    // Timeline
    renderTimeline(score, meta);
  }

  // ── Action plan engine ─────────────────────────────────────
  function renderActions(score, meta) {
    const container = document.getElementById('credit-actions-list');
    if (!container) return;

    // All possible actions, each tagged with the score range where it's most relevant
    const ALL_ACTIONS = [
      // ── Critical for all tiers ──
      {
        priority: 'high', tiers: [1,2,3,4,5],
        title: 'Set up autopay on every credit account',
        detail: 'Payment history is 35% of your score. Log into each card/loan and set autopay to at least the minimum payment. A single 30-day late mark can drop your score 50–110 points and stays for 7 years.',
        impact: 'Potential impact: +50–100 pts (prevents future drops)',
      },
      {
        priority: 'high', tiers: [1,2,3],
        title: 'Pay down credit card balances — target under 30% utilization',
        detail: 'Utilization = balance ÷ credit limit. If you have $5,000 in limits and $2,000 in balances, that\'s 40% — too high. Pay down to under $1,500 (30%) or ideally under $500 (10%). This updates every billing cycle.',
        impact: 'Potential impact: +20–80 pts depending on current utilization',
      },
      {
        priority: 'high', tiers: [1,2],
        title: 'Dispute inaccurate negative items on your credit report',
        detail: 'Pull your free report at AnnualCreditReport.com. Look for accounts you don\'t recognise, late payments that were actually on time, or debts past the 7-year statute. File disputes directly with each bureau online — resolution takes 30 days.',
        impact: 'Potential impact: +40–100+ pts if negative items are removed',
      },
      {
        priority: 'high', tiers: [1,2],
        title: 'Bring any past-due accounts current immediately',
        detail: 'If you have accounts in collections or past-due status, getting them current stops the bleeding. For collections under $500, paying them off may have minimal effect since the collection entry stays — but it prevents further damage.',
        impact: 'Potential impact: Stops score from falling further; +30–60 pts',
      },
      {
        priority: 'medium', tiers: [2,3],
        title: 'Request a credit limit increase (without a hard pull)',
        detail: 'Call or log into your existing cards and ask for a credit limit increase — specify "soft pull only." Higher limits lower your utilization ratio without you paying more. Chase, Citi, and Amex often allow this online without a hard inquiry.',
        impact: 'Potential impact: +10–30 pts by reducing utilization %',
      },
      {
        priority: 'medium', tiers: [2,3,4],
        title: 'Keep your oldest credit card open and active',
        detail: 'Length of credit history is 15% of your score. Never close your oldest card even if you don\'t use it. Put a small recurring charge on it (e.g. a streaming subscription) so it stays active and doesn\'t get closed by the issuer.',
        impact: 'Potential impact: Preserves 10–30 pts long-term',
      },
      {
        priority: 'medium', tiers: [1,2,3],
        title: 'Add yourself as an authorised user on someone\'s old account',
        detail: 'If a family member has an account that is 5+ years old with low utilization and perfect payment history, being added as an authorised user inherits that history. You don\'t need to use the card — just being listed helps.',
        impact: 'Potential impact: +20–50 pts if the account has strong history',
      },
      {
        priority: 'medium', tiers: [3,4],
        title: 'Pay card balances before the statement close date',
        detail: 'Bureaus receive your balance on the statement date, not the due date. Pay your balance down before the statement closes each month. This lowers the reported utilization even if you pay in full every month.',
        impact: 'Potential impact: +10–25 pts from lower reported utilization',
      },
      {
        priority: 'low', tiers: [2,3,4],
        title: 'Avoid applying for new credit for 6–12 months',
        detail: 'Each hard inquiry drops your score 5–10 points and stays on your report for 2 years (affects score for ~1 year). Avoid opening new cards, taking store credit, or financing purchases until you hit 740.',
        impact: 'Prevents -5 to -10 pts per application',
      },
      {
        priority: 'low', tiers: [3,4],
        title: 'Use Experian Boost for free quick wins',
        detail: 'Experian Boost lets you add on-time utility, phone, and streaming payments to your Experian credit file. Free to use, adds positively, never hurts. Works best if you have thin credit history.',
        impact: 'Potential impact: +5–15 pts on Experian score',
      },
      {
        priority: 'low', tiers: [2,3,4],
        title: 'Build credit mix strategically (if missing installment credit)',
        detail: 'If you only have credit cards (revolving credit), a small personal loan or credit-builder loan adds an installment account to your profile. Credit Unions like DCU offer credit-builder loans. Only do this if you don\'t have any installment accounts already.',
        impact: 'Potential impact: +10–20 pts over 6–12 months',
      },
      {
        priority: 'low', tiers: [4,5],
        title: 'Maintain consistent low utilization each month',
        detail: 'At your score level the main task is consistency — utilization below 10%, zero late payments, and not opening new accounts. Monitor via Credit Karma weekly and Experian monthly to catch any surprises.',
        impact: 'Maintains and grows score over time',
      },
    ];

    const actions = ALL_ACTIONS.filter(a => a.tiers.includes(meta.tier));

    if (!actions.length) {
      container.innerHTML = '<div style="color:var(--green);font-size:0.85rem">You\'ve reached your goal! Maintain low utilization and perfect payment history.</div>';
      return;
    }

    container.innerHTML = `<div class="credit-actions-list">${
      actions.map(a => `
        <div class="credit-action">
          <span class="ca-priority ca-${a.priority}">${a.priority}</span>
          <div>
            <div class="ca-title">${a.title}</div>
            <div class="ca-detail">${a.detail}</div>
            <div class="ca-impact">${a.impact}</div>
          </div>
        </div>`).join('')
    }</div>`;
  }

  // ── Timeline ───────────────────────────────────────────────
  function renderTimeline(score, meta) {
    const card = document.getElementById('credit-timeline-card');
    const container = document.getElementById('credit-timeline');
    if (!card || !container) return;

    if (score >= GOAL) {
      card.style.display = 'none';
      return;
    }
    card.style.display = '';

    const gap = GOAL - score;

    // Estimate based on typical bureau-reported improvement rates
    let steps;
    if (score < 580) {
      steps = [
        { time: 'Month 1–2', color: '#ef4444', title: 'Stop the bleeding', detail: 'Set autopay on all accounts. Dispute any errors on your credit report. Bring past-due accounts current. Your score may dip before it rises — that\'s normal.' },
        { time: 'Month 3–6', color: '#f97316', title: 'Reduce utilization below 30%', detail: 'Focus all extra payments on cards with the highest utilization. Request credit limit increases. Expect 20–40 point improvements as utilization drops.' },
        { time: 'Month 6–12', color: '#eab308', title: 'Consistent payments build history', detail: 'With 6 months of clean payment history and low utilization, most people in this range see jumps to the Fair (580–669) range.' },
        { time: 'Month 12–24', color: '#22c55e', title: 'Reach 740 with compounding history', detail: 'Continued on-time payments, aging accounts, and sub-10% utilization typically get you from Fair to Very Good (740+). Realistic timeframe: 18–24 months with disciplined execution.' },
      ];
    } else if (score < 670) {
      steps = [
        { time: 'Month 1–3', color: '#f97316', title: 'Attack utilization aggressively', detail: 'Get utilization below 30% across all cards. Request credit line increases. Pay balances before statement close date. Typical improvement: 20–40 pts.' },
        { time: 'Month 3–6', color: '#eab308', title: 'Clean up your report', detail: 'Dispute any inaccurate late payments or accounts. Add as authorised user on a family member\'s old account. Expect to enter the Good (670–739) range.' },
        { time: 'Month 6–12', color: '#22c55e', title: 'Hit 740 with aging + consistency', detail: 'Sub-10% utilization, zero new inquiries, and 12 months of perfect payment history. Most people in the Fair range who do this hit 740 within 12 months.' },
      ];
    } else if (score < 740) {
      steps = [
        { time: 'Month 1–2', color: '#eab308', title: 'Get utilization under 10%', detail: 'You\'re in the Good range — the final push to 740 is almost entirely utilization. If any card is above 10%, pay it down. FICO models heavily reward sub-10% utilization.' },
        { time: 'Month 2–4', color: '#22c55e', title: 'Pay before statement close', detail: 'Pay card balances 3–5 days before the statement closing date so bureaus see near-zero balances. This alone can move scores 15–30 points.' },
        { time: 'Month 4–6', color: '#6366f1', title: 'Cross 740 — maintain it', detail: `You're only ${gap} points away. With consistent low utilization and no new inquiries, most people in the 670–739 range hit 740 within 3–6 months.` },
      ];
    } else {
      steps = [];
    }

    container.innerHTML = steps.map(s => `
      <div class="ct-step">
        <div class="ct-dot" style="border-color:${s.color};color:${s.color}">→</div>
        <div class="ct-body">
          <div class="ct-time" style="color:${s.color}">${s.time}</div>
          <div class="ct-title">${s.title}</div>
          <div class="ct-detail">${s.detail}</div>
        </div>
      </div>`).join('');
  }

  // ── Draw empty gauge on load ───────────────────────────────
  function drawEmptyGauge() {
    const canvas = document.getElementById('credit-gauge');
    if (canvas) drawGauge(canvas, null, GOAL);
  }

  // ── Init ───────────────────────────────────────────────────
  function initCredit() {
    if (!document.getElementById('credit-gauge')) return;

    drawEmptyGauge();

    const input = document.getElementById('credit-score-input');
    const slider = document.getElementById('credit-score-slider');
    const btn = document.getElementById('credit-score-btn');

    // Sync slider ↔ input
    if (slider) {
      slider.addEventListener('input', () => {
        if (input) input.value = slider.value;
        update(parseInt(slider.value));
      });
    }
    if (input) {
      input.addEventListener('input', () => {
        const v = parseInt(input.value);
        if (v >= MIN && v <= MAX && slider) slider.value = v;
      });
    }
    if (btn) {
      btn.addEventListener('click', () => {
        const v = parseInt(input?.value);
        if (v >= MIN && v <= MAX) {
          if (slider) slider.value = v;
          update(v);
        }
      });
    }
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') btn?.click();
      });
    }

    // Restore saved score
    const saved = parseInt(localStorage.getItem(STORAGE_KEY));
    if (saved >= MIN && saved <= MAX) {
      if (input) input.value = saved;
      if (slider) slider.value = saved;
      update(saved);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCredit);
  } else {
    initCredit();
  }
})();
