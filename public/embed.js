/**
 * Offerio Embed Widget
 * 
 * Usage:
 * 
 * 1. Include this script in your HTML:
 *    <script src="https://offerio.ch/embed.js"></script>
 * 
 * 2. Add a container element:
 *    <div id="offerio-form"></div>
 * 
 * 3. Initialize the widget:
 *    <script>
 *      Offerio.embed('offerio-form', {
 *        formSlug: 'your-form-slug',  // Required: Form slug from admin
 *        category: 'umzug',            // Optional: Pre-select category
 *        theme: 'light',               // Optional: 'light' or 'dark'
 *        lang: 'de',                   // Optional: 'de', 'en', 'fr', 'it'
 *        color: 'ff6600',              // Optional: Primary color (hex without #)
 *        hideHeader: false,            // Optional: Hide form header
 *        height: 'auto',               // Optional: 'auto' or specific height like '600px'
 *        onLoad: function() {},        // Optional: Callback when form loads
 *        onSubmit: function() {}       // Optional: Callback when form is submitted
 *      });
 *    </script>
 */

(function (window, document) {
  'use strict';

  // Base URL - change this for different environments
  var BASE_URL = 'https://offerio.ch';

  // Detect base URL from script src
  var scripts = document.getElementsByTagName('script');
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].src;
    if (src && src.indexOf('embed.js') !== -1) {
      BASE_URL = src.replace('/embed.js', '');
      break;
    }
  }

  var Offerio = {
    version: '1.1.0',

    /**
     * Embed a form into a container element
     * @param {string} elementId - The ID of the container element
     * @param {Object} options - Configuration options
     */
    embed: function (elementId, options) {
      options = options || {};

      var container = document.getElementById(elementId);
      if (!container) {
        console.error('Offerio: Container element "' + elementId + '" not found');
        return;
      }

      // Build URL with query parameters
      var formSlug = options.formSlug || options.slug || 'default';
      var url = BASE_URL + '/embed/' + formSlug;
      var params = [];

      if (options.category) params.push('category=' + encodeURIComponent(options.category));
      if (options.theme) params.push('theme=' + encodeURIComponent(options.theme));
      if (options.lang) params.push('lang=' + encodeURIComponent(options.lang));
      if (options.color) params.push('color=' + encodeURIComponent(options.color.replace('#', '')));
      if (options.hideHeader) params.push('hideHeader=true');

      if (params.length > 0) {
        url += '?' + params.join('&');
      }

      // Create iframe
      var iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.width = '100%';
      iframe.style.border = 'none';
      iframe.style.overflow = 'hidden';
      iframe.style.display = 'block';
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('allowtransparency', 'true');
      iframe.setAttribute('allow', 'geolocation');
      iframe.setAttribute('title', 'Offerio Form');

      // Set initial height
      var initialHeight = options.height || '800px';
      if (initialHeight === 'auto') {
        iframe.style.height = '800px'; // Default until we get actual height
      } else {
        iframe.style.height = initialHeight;
      }

      // Generate unique ID for this iframe
      var iframeId = 'offerio-iframe-' + Math.random().toString(36).substr(2, 9);
      iframe.id = iframeId;

      // Handle auto-height with postMessage
      if (options.height === 'auto' || !options.height) {
        window.addEventListener('message', function (event) {
          // Verify origin
          if (event.origin !== BASE_URL &&
            event.origin !== 'https://offerio.ch' &&
            event.origin.indexOf('localhost') === -1 &&
            event.origin.indexOf('lovable.app') === -1) {
            return;
          }

          var data = event.data;
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch (e) {
              return;
            }
          }

          // Handle height updates
          if (data && data.type === 'offerio-resize' && data.height) {
            var targetIframe = document.getElementById(iframeId);
            if (targetIframe) {
              targetIframe.style.height = data.height + 'px';
            }
          }

          // Handle form submission
          if (data && data.type === 'offerio-submit' && options.onSubmit) {
            options.onSubmit(data);
          }

          // Handle form load
          if (data && data.type === 'offerio-loaded' && options.onLoad) {
            options.onLoad();
          }
        });
      }

      // Clear container and add iframe
      container.innerHTML = '';
      container.appendChild(iframe);

      // Return iframe reference for further manipulation
      return iframe;
    },

    /**
     * Create an inline widget (shorthand)
     */
    widget: function (elementId, formSlug, options) {
      options = options || {};
      options.formSlug = formSlug;
      return this.embed(elementId, options);
    }
  };

  // Expose to global scope
  window.Offerio = Offerio;

  // Backward compatibility
  window.Anfrage24 = Offerio;

  // Auto-initialize widgets with data attributes
  document.addEventListener('DOMContentLoaded', function () {
    // Support new data-offerio-embed attribute
    var autoEmbeds = document.querySelectorAll('[data-offerio-embed], [data-anfrage24-embed]');
    for (var i = 0; i < autoEmbeds.length; i++) {
      var el = autoEmbeds[i];
      var formSlug = el.getAttribute('data-offerio-embed') || el.getAttribute('data-anfrage24-embed');
      var options = {
        formSlug: formSlug,
        category: el.getAttribute('data-category'),
        theme: el.getAttribute('data-theme'),
        lang: el.getAttribute('data-lang'),
        color: el.getAttribute('data-color'),
        hideHeader: el.getAttribute('data-hide-header') === 'true',
        height: el.getAttribute('data-height') || 'auto'
      };

      // Generate ID if not present
      if (!el.id) {
        el.id = 'offerio-auto-' + i;
      }

      Offerio.embed(el.id, options);
    }
  });

})(window, document);
