(function(){
  'use strict';
  var els = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  function show(el){ el.classList.add('in'); }
  // 1) anything already inside the viewport at load is shown at once
  var vh = window.innerHeight || document.documentElement.clientHeight;
  els.forEach(function(el){ if (el.getBoundingClientRect().top < vh) show(el); });
  // 2) the rest reveals as it scrolls into view
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.05 });
    els.forEach(function(el){ if (!el.classList.contains('in')) io.observe(el); });
  } else { els.forEach(show); }
  // 3) safety net: nothing may stay hidden
  setTimeout(function(){ els.forEach(show); }, 1200);
})();
