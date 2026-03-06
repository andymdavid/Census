(function () {
  function toBool(value) {
    return String(value).toLowerCase() === 'true';
  }

  function createIframe(container, src, mode, height) {
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.border = '0';
    iframe.style.width = '100%';

    if (mode === 'fullscreen') {
      iframe.style.position = 'fixed';
      iframe.style.inset = '0';
      iframe.style.height = '100%';
      iframe.style.zIndex = '9999';
    } else {
      iframe.style.height = height || '700px';
    }

    if (toBool(container.getAttribute('data-loading-lazy'))) {
      iframe.loading = 'lazy';
    }

    container.innerHTML = '';
    container.appendChild(iframe);
    return iframe;
  }

  function init() {
    var nodes = document.querySelectorAll('[data-census]');
    if (!nodes.length) return;

    nodes.forEach(function (node) {
      var formId = node.getAttribute('data-form-id');
      if (!formId) return;
      var mode = node.getAttribute('data-mode') || 'inline';
      var height = node.getAttribute('data-height');
      var baseUrl = node.getAttribute('data-base-url') || '';
      var src = baseUrl ? baseUrl.replace(/\/$/, '') + '/f/' + formId : '/f/' + formId;

      var iframe = createIframe(node, src, mode, height);

      window.addEventListener('message', function (event) {
        if (!iframe || event.source !== iframe.contentWindow) return;
        if (!event.data || event.data.type !== 'census:resize') return;
        if (mode === 'fullscreen') return;
        if (typeof event.data.height === 'number') {
          iframe.style.height = event.data.height + 'px';
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
