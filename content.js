(function () {
  'use strict';
  var LS_KEY = 'portfolio_cms_data';

  function esc(s) { return (s == null ? '' : String(s)); }

  function loadData() {
    return fetch('data.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (base) {
      try {
        var override = localStorage.getItem(LS_KEY);
        if (override) return JSON.parse(override);
      } catch (e) {}
      return base;
    }).catch(function () {
      try {
        var override2 = localStorage.getItem(LS_KEY);
        if (override2) return JSON.parse(override2);
      } catch (e) {}
      return null;
    });
  }

  var ICONS = {
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6l9 6 9-6M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .3 2 .6 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.9.5 2.9.6a2 2 0 011.7 2z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4.5a2 2 0 014 0V17M12 17v-7"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 20l1-3M16 20l-1-3M6 15l-3-1.5M18 15l3-1.5M9 4L7 9M15 4l2 5M9 9h6l1 4-1 4H9l-1-4z"/></svg>'
  };

  function render(data) {
    if (!data) return;
    var p = data.profile || {};

    /* hero + nav brand */
    var heroName = document.getElementById('hero-name');
    if (heroName) heroName.textContent = p.name || '';
    var heroTitle = document.getElementById('hero-title');
    if (heroTitle) heroTitle.innerHTML = p.title || '';
    var heroContact = document.getElementById('hero-contact');
    if (heroContact) {
      heroContact.innerHTML =
        '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' +
        '<span>' + esc(p.phone) + '</span>' +
        '<span>' + esc(p.location) + '</span>' +
        (p.linkedin ? '<a href="' + esc(p.linkedin) + '" target="_blank" rel="noopener">' + esc(p.linkedin.replace(/^https?:\/\//, '')) + '</a>' : '') +
        (p.github ? '<a href="' + esc(p.github) + '" target="_blank" rel="noopener">' + esc(p.github.replace(/^https?:\/\//, '')) + '</a>' : '');
    }

    /* summary */
    var summaryEl = document.getElementById('summary-text');
    if (summaryEl) summaryEl.textContent = p.summary || '';

    /* skills */
    var skillsGrid = document.getElementById('skills-grid');
    if (skillsGrid) {
      skillsGrid.innerHTML = (data.skills || []).map(function (s) {
        return '<div class="skill-card"><h3>' + esc(s.label) + '</h3><p>' + esc(s.value) + '</p></div>';
      }).join('');
    }

    /* experience timeline */
    var timeline = document.getElementById('timeline');
    if (timeline) {
      timeline.innerHTML = (data.experience || []).map(function (j, i) {
        return '<div class="t-item' + (i === 0 ? ' current' : '') + '">' +
          '<div class="t-dot"></div>' +
          '<div class="t-head"><span class="t-role">' + esc(j.role) + '</span><span class="t-date">' + esc(j.date) + '</span></div>' +
          '<div class="t-org">' + esc(j.org) + '</div>' +
          '<ul class="t-list">' + (j.bullets || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' +
          '</div>';
      }).join('');
    }

    /* certificates */
    var certs = data.certificates || [];
    var completed = certs.filter(function (c) { return c.status !== 'in-progress'; });
    var inProgress = certs.filter(function (c) { return c.status === 'in-progress'; });
    var categories = ['All'].concat(Array.from(new Set(completed.map(function (c) { return c.category || 'Other'; }))));

    var activeCat = 'All';
    var tabsEl = document.getElementById('cert-tabs');
    var gridEl = document.getElementById('cert-grid');

    function thumbOrFallback(c) {
      if (c.thumb) return '<img src="' + esc(c.thumb) + '" alt="" loading="lazy">';
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5"/></svg>';
    }

    function renderCerts() {
      var list = activeCat === 'All' ? completed : completed.filter(function (c) { return (c.category || 'Other') === activeCat; });
      gridEl.innerHTML = list.map(function (c, idx) {
        return '<div class="cert-card" data-idx="' + certs.indexOf(c) + '">' +
          '<div class="thumb' + (c.thumb ? '' : ' none') + '">' + thumbOrFallback(c) +
            (c.file ? '<div class="view">VIEW CERTIFICATE</div>' : '') +
          '</div>' +
          '<div class="body"><div class="vendor">' + esc(c.vendor) + '</div><div class="title">' + esc(c.title) + '</div>' +
          '<div class="date">' + esc(c.date) + '</div></div></div>';
      }).join('');
      gridEl.querySelectorAll('.cert-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var c = certs[parseInt(card.getAttribute('data-idx'), 10)];
          openModal(c);
        });
      });
    }

    if (tabsEl) {
      tabsEl.innerHTML = categories.map(function (cat) {
        return '<button class="cert-tab' + (cat === 'All' ? ' active' : '') + '" data-cat="' + esc(cat) + '">' + esc(cat) + '</button>';
      }).join('');
      tabsEl.querySelectorAll('.cert-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          tabsEl.querySelectorAll('.cert-tab').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          activeCat = btn.getAttribute('data-cat');
          renderCerts();
        });
      });
    }
    if (gridEl) renderCerts();

    var progRow = document.getElementById('cert-progress');
    if (progRow) {
      progRow.innerHTML = inProgress.map(function (c) {
        return '<span class="chip">' + esc(c.title) + (c.vendor ? ' — ' + esc(c.vendor) : '') + '</span>';
      }).join('') || '<span class="chip" style="opacity:.5">None currently</span>';
    }

    /* modal */
    var modal = document.getElementById('cert-modal');
    function openModal(c) {
      if (!modal) return;
      document.getElementById('cert-modal-img').src = c.thumb || '';
      document.getElementById('cert-modal-img').style.display = c.thumb ? 'block' : 'none';
      document.getElementById('cert-modal-vendor').textContent = c.vendor || '';
      document.getElementById('cert-modal-title').textContent = c.title + (c.date ? ' (' + c.date + ')' : '');
      var openLink = document.getElementById('cert-modal-open');
      var dlLink = document.getElementById('cert-modal-download');
      if (c.file) {
        openLink.href = c.file; openLink.style.display = 'inline-flex';
        dlLink.href = c.file; dlLink.style.display = 'inline-flex';
      } else {
        openLink.style.display = 'none'; dlLink.style.display = 'none';
      }
      modal.classList.add('open');
    }
    var closeBtn = document.getElementById('cert-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { modal.classList.remove('open'); });
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.remove('open'); });

    /* projects */
    var projGrid = document.getElementById('proj-grid');
    if (projGrid) {
      projGrid.innerHTML = (data.projects || []).map(function (pr, i) {
        return '<div class="proj-card' + (pr.full ? ' full' : '') + '">' +
          '<div class="proj-bar"><span class="pdot"></span><span class="pdot"></span><span class="pdot"></span><span class="ppath">~/' + (pr.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) + '</span></div>' +
          '<div class="proj-body"><div class="proj-year">' + esc(pr.year) + '</div>' +
          '<h3 class="proj-title">' + esc(pr.title) + '</h3>' +
          '<div class="proj-stack">' + esc(pr.stack) + '</div>' +
          '<ul class="proj-points">' + (pr.bullets || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' +
          '</div></div>';
      }).join('');
    }

    /* education / languages / leadership */
    var eduCol = document.getElementById('edu-col');
    if (eduCol) {
      eduCol.innerHTML = (data.education || []).map(function (e) {
        return '<div class="edu-item"><div class="deg">' + esc(e.degree) + '</div><div class="org">' + esc(e.org) + '</div><div class="yr">' + esc(e.year) + '</div></div>';
      }).join('');
    }
    var langCol = document.getElementById('lang-col');
    if (langCol) {
      langCol.innerHTML = (data.languages || []).map(function (l) {
        return '<div class="lang-row"><span>' + esc(l.name) + '</span><span class="lang-level">' + esc(l.level) + '</span></div>';
      }).join('');
    }
    var leaderCol = document.getElementById('leader-col');
    if (leaderCol && data.leadership) {
      var lead = data.leadership;
      leaderCol.innerHTML = '<div class="edu-item"><div class="deg">' + esc(lead.title) + '</div><div class="org">' + esc(lead.org) + '</div><div class="yr">' + esc(lead.year) + '</div></div><p>' + esc(lead.note) + '</p>';
    }

    /* contact panel links */
    var contactLinks = document.getElementById('contact-links');
    if (contactLinks) {
      contactLinks.innerHTML =
        '<a class="clink" href="mailto:' + esc(p.email) + '">' + ICONS.mail + esc(p.email) + '</a>' +
        '<a class="clink" href="tel:' + esc((p.phone || '').replace(/\s+/g, '')) + '">' + ICONS.phone + esc(p.phone) + '</a>' +
        (p.linkedin ? '<a class="clink" href="' + esc(p.linkedin) + '" target="_blank" rel="noopener">' + ICONS.linkedin + esc(p.linkedin.replace(/^https?:\/\//, '')) + '</a>' : '') +
        (p.github ? '<a class="clink" href="' + esc(p.github) + '" target="_blank" rel="noopener">' + ICONS.github + esc(p.github.replace(/^https?:\/\//, '')) + '</a>' : '');
    }

    /* re-trigger reveal/scramble for newly injected content */
    if (window.__initReveal) window.__initReveal();
  }

  window.__renderPortfolio = render;
  loadData().then(render);
})();
