(function () {
  'use strict';

  var collectorOrigin = 'https://cultre-website-analytics.hh-web.workers.dev';
  if (!/^https:\/\/[^/?#]+$/.test(collectorOrigin)) return;

  function parseUrl(value) {
    try {
      return new URL(value, location.href);
    } catch (_) {
      return null;
    }
  }

  function pagePath(value) {
    var url = parseUrl(value);
    return url ? (url.pathname.slice(0, 180) || '/') : '/';
  }

  function referrerDomain(value) {
    var url = parseUrl(value);
    return url ? url.hostname.replace(/^www\./, '').slice(0, 120) : '';
  }

  function destination(value) {
    var url = parseUrl(value);
    if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return;
    return url.hostname.slice(0, 120) + (url.pathname.slice(0, 180) || '/');
  }

  function coarseDevice() {
    var width = Math.min(screen.width || innerWidth, innerWidth);
    return width < 600 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  }

  function send(event) {
    event.page = pagePath(location.href);
    event.device = coarseDevice();
    fetch(collectorOrigin + '/v1/collect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
      credentials: 'omit'
    }).catch(function () {});
  }

  try {
    if (!sessionStorage.getItem('cultre_analytics_session_v1')) {
      sessionStorage.setItem('cultre_analytics_session_v1', '1');
      send({ type: 'session' });
    }
  } catch (_) {
    send({ type: 'session' });
  }

  send({ type: 'pageview', referrer: referrerDomain(document.referrer) });

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest &&
      event.target.closest('a,button,[role="button"]');
    if (!target) return;

    var label = (
      target.getAttribute('data-analytics-label') ||
      target.getAttribute('aria-label') ||
      target.id ||
      target.textContent ||
      target.tagName
    ).replace(/\s+/g, ' ').trim().slice(0, 80);

    if (label && label.indexOf('@') < 0) {
      send({
        type: 'click',
        label: label,
        destination: target.href ? destination(target.href) : undefined
      });
    }
  }, { capture: true, passive: true });
}());
