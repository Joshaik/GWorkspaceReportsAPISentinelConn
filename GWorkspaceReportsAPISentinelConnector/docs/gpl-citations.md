# GPL-3.0-or-later — Code Citations

This file contains code snippets that are published under the GPL-3.0-or-later license.

---

## License: GPL-3.0-or-later — Google Analytics Tracking

Source: https://github.com/blynn/gitmagic

> Note: This snippet is licensed GPL-3.0 — ensure compatibility and attribution if reusing.

```javascript
// SPDX-License-Identifier: GPL-3.0-or-later
// Google Tag Manager (GTM) initialization script
function loadGTM(i, s, o, g, r, a, m) {
  i.GoogleAnalyticsObject = r;
  i[r] = i[r] || function() {
    (i[r].q = i[r].q || []).push(arguments);
  };
  i[r].l = 1 * new Date();

  a = s.createElement(o);
  m = s.getElementsByTagName(o)[0];
  a.async = 1;
  a.src = g;
  m.parentNode.insertBefore(a, m);
}

// Initialize GTM on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    loadGTM(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');
    ga('create', 'UA-146796841-2', 'auto');
    ga('create', 'UA-159453639-1', 'auto', { name: 'Comviva' });
  });
}
```
