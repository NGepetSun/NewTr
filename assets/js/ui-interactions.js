/* UI interactions and micro-interactions library
   - Safe init (DOMContentLoaded)
   - Navigation behavior
   - Smooth page transitions
   - Bracket update animation helper
   - Lazy loading images & intersection observer
   - Accessibility helpers
*/
(function (global) {
  'use strict';

  // Simple logger wrapper
  function log(...args){ if (global.console) console.log('[UI]', ...args); }

  // Debounce / throttle utils
  function throttle(fn, wait=100) {
    let last = 0;
    return function(...args) {
      const now = Date.now();
      if (now - last < wait) return;
      last = now;
      fn.apply(this, args);
    };
  }

  // Prefers-reduced-motion
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* NAVIGATION */
  function initNavigation() {
    const menuBtn = document.querySelector('[data-menu-toggle]');
    const nav = document.querySelector('.nav');
    if (!menuBtn || !nav) return;
    menuBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', String(open));
      if (open) {
        nav.querySelector('a')?.focus();
      }
    });
  }

  /* PAGE TRANSITIONS - fade out/in */
  function initPageTransitions() {
    if (reduceMotion) return;
    document.documentElement.classList.add('page-ready');
    // Attach links (internal) to animate
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      // Only internal navigation same-origin and no download / target blank
      if (a.target || a.hasAttribute('download') || a.hostname !== location.hostname) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      e.preventDefault();
      document.documentElement.classList.add('is-transitioning');
      // short delay to show exit animation
      setTimeout(() => { location.href = href; }, 240);
    });
    window.addEventListener('pageshow', () => {
      document.documentElement.classList.remove('is-transitioning');
    });
  }

  /* LAZY LOADING IMAGES */
  function initLazyImages() {
    if (!('IntersectionObserver' in window)) return;
    const imgs = document.querySelectorAll('img[data-src]');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        img.src = img.dataset.src;
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
        img.removeAttribute('data-src');
        io.unobserve(img);
      });
    }, { rootMargin: '200px 0px' });
    imgs.forEach(img => io.observe(img));
  }

  /* BRACKET ANIMATION - call when bracket data updates */
  function animateBracketUpdate(container) {
    // container: element that contains bracket matches
    if (!container) return;
    // Add highlight to updated matches
    container.querySelectorAll('.match').forEach((m, i) => {
      m.style.willChange = 'transform, opacity';
      m.animate([
        { transform: 'translateY(6px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 }
      ], { duration: 420, easing: 'cubic-bezier(.2,.9,.25,1)', delay: i*40 });
      // remove will-change after a timeout
      setTimeout(() => m.style.willChange = '', 700);
    });
  }

  /* UTILS */
  function showToast(message, time=4000) {
    let el = document.querySelector('.ui-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'ui-toast';
      Object.assign(el.style, {
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        background: 'linear-gradient(90deg, rgba(0,210,255,0.06), rgba(179,136,255,0.05))',
        color: '#eaf6ff',
        padding: '10px 14px',
        borderRadius: '10px',
        zIndex: 99999,
        boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
        fontWeight:700
      });
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, time);
  }

  /* INIT components */
  function initTournamentWidgets() {
    // Hook to bracket container to animate on external update events
    const bracket = document.querySelector('.bracket');
    if (bracket) {
      // hypothetical custom event your backend might dispatch on update:
      document.addEventListener('bracket:update', () => animateBracketUpdate(bracket));
      // also animate the current render
      animateBracketUpdate(bracket);
    }

    // Example: add keyboard support for register buttons (enter/space)
    document.addEventListener('keydown', function(e) {
      const t = e.target;
      if (t && t.matches && t.matches('[data-register]')) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          t.click();
        }
      }
    });
  }

  function safeInit() {
    try {
      initNavigation();
      initPageTransitions();
      initLazyImages();
      initTournamentWidgets();
      log('UI initialized');
    } catch (err) {
      console.error('UI init error', err);
    }
  }

  // Expose some helpers globally (non-invasive)
  global.UX = {
    animateBracketUpdate,
    showToast
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
  } else {
    safeInit();
  }

})(window);
