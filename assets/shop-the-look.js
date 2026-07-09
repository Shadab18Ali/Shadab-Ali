(function () {
  'use strict';

  function init(sectionEl) {
    var sectionId = sectionEl.id.replace('stl-', '');
    var modal = document.getElementById('stl-modal-' + sectionId);
    if (!modal) return;

    var settings = (window.stlSectionSettings && window.stlSectionSettings[sectionId]) || {};
    var overlay = modal.querySelector('.stl-modal__overlay');
    var closeBtns = modal.querySelectorAll('[data-stl-close]');
    var imageEl = modal.querySelector('.stl-modal__image');
    var titleEl = modal.querySelector('.stl-modal__title');
    var priceEl = modal.querySelector('.stl-modal__price');
    var descEl = modal.querySelector('.stl-modal__description');
    var optionsEl = modal.querySelector('.stl-modal__options');
    var stockMsgEl = modal.querySelector('.stl-modal__stock-msg');
    var form = modal.querySelector('.stl-modal__form');
    var addBtn = modal.querySelector('.stl-modal__add-btn');
    var addedMsgEl = modal.querySelector('.stl-modal__added-msg');

    var currentProduct = null;
    var selectedOptions = []; // array of strings, index 0 = option1, etc.

    function formatMoney(cents, currency) {
      var amount = (cents / 100).toFixed(2);
      return (currency || '') + amount;
    }

    function findVariant(product, options) {
      return product.variants.find(function (v) {
        var vOpts = [v.option1, v.option2, v.option3];
        return options.every(function (val, i) { return val == null || vOpts[i] === val; });
      });
    }

    function optionValueHasAvailableVariant(product, optionIndex, value) {
      return product.variants.some(function (v) {
        var vOpts = [v.option1, v.option2, v.option3];
        return vOpts[optionIndex] === value && v.available;
      });
    }

    function optionSortPriority(name) {
      if (/colou?r/i.test(name)) return 0;
      if (/size/i.test(name)) return 1;
      return 2;
    }

    function renderOptions(product) {
      optionsEl.innerHTML = '';

      var order = product.options.map(function (opt, i) { return i; });
      order.sort(function (a, b) {
        var nameA = (typeof product.options[a] === 'string') ? product.options[a] : (product.options[a] && product.options[a].name) || '';
        var nameB = (typeof product.options[b] === 'string') ? product.options[b] : (product.options[b] && product.options[b].name) || '';
        return optionSortPriority(nameA) - optionSortPriority(nameB);
      });

      order.forEach(function (index) {
        var optionRaw = product.options[index];
        var optionName = (typeof optionRaw === 'string') ? optionRaw : (optionRaw && optionRaw.name) || '';
        var values = [];
        product.variants.forEach(function (v) {
          var val = [v.option1, v.option2, v.option3][index];
          if (val && values.indexOf(val) === -1) values.push(val);
        });

        var group = document.createElement('div');
        group.className = 'stl-option-group';

        var label = document.createElement('span');
        label.className = 'stl-option-group__label';
        label.textContent = optionName;
        group.appendChild(label);

        var isColor = /colou?r/i.test(optionName);

        if (isColor) {
          var row = document.createElement('div');
          row.className = 'stl-swatch-row';
          values.forEach(function (val) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'stl-swatch';
            btn.textContent = val;
            btn.setAttribute('aria-pressed', selectedOptions[index] === val ? 'true' : 'false');
            if (!optionValueHasAvailableVariant(product, index, val)) btn.disabled = true;
            btn.addEventListener('click', function () {
              selectedOptions[index] = val;
              renderOptions(product);
              updateSelectionState(product);
            });
            row.appendChild(btn);
          });
          group.appendChild(row);
        } else {
          var dropdown = document.createElement('div');
          dropdown.className = 'stl-dropdown';

          var toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'stl-dropdown__toggle';
          var currentVal = selectedOptions[index];
          toggle.innerHTML =
            '<span class="' + (currentVal ? '' : 'stl-dropdown__toggle-placeholder') + '">' +
            (currentVal || 'Choose your ' + optionName.toLowerCase()) +
            '</span>' +
            '<span class="stl-dropdown__chevron">&#9662;</span>';

          var list = document.createElement('ul');
          list.className = 'stl-dropdown__list';

          values.forEach(function (val) {
            var li = document.createElement('li');
            li.className = 'stl-dropdown__option';
            li.textContent = val;
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', selectedOptions[index] === val ? 'true' : 'false');
            var available = optionValueHasAvailableVariant(product, index, val);
            if (!available) li.setAttribute('data-disabled', 'true');
            li.addEventListener('click', function () {
              if (!available) return;
              selectedOptions[index] = val;
              dropdown.classList.remove('is-open');
              renderOptions(product);
              updateSelectionState(product);
            });
            list.appendChild(li);
          });

          toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            var wasOpen = dropdown.classList.contains('is-open');
            document.querySelectorAll('.stl-dropdown.is-open').forEach(function (d) { d.classList.remove('is-open'); });
            if (!wasOpen) dropdown.classList.add('is-open');
          });

          dropdown.appendChild(toggle);
          dropdown.appendChild(list);
          group.appendChild(dropdown);
        }

        optionsEl.appendChild(group);
      });
    }

    function updateSelectionState(product) {
      var allSelected = selectedOptions.every(function (v) { return v != null; });

      if (!allSelected) {
        priceEl.textContent = formatMoney(product.price, window.Shopify && window.Shopify.currency ? window.Shopify.currency.active : '');
        stockMsgEl.hidden = true;
        addBtn.disabled = true;
        form.dataset.variantId = '';
        return;
      }

      var variant = findVariant(product, selectedOptions);
      if (variant) {
        priceEl.textContent = formatMoney(variant.price, window.Shopify && window.Shopify.currency ? window.Shopify.currency.active : '');
        stockMsgEl.hidden = variant.available;
        addBtn.disabled = !variant.available;
        form.dataset.variantId = variant.id;
        if (variant.featured_image && variant.featured_image.src) {
          imageEl.src = variant.featured_image.src;
        }
      } else {
        stockMsgEl.hidden = false;
        addBtn.disabled = true;
        form.dataset.variantId = '';
      }
    }

    function openModalForProduct(handle) {
      fetch('/products/' + handle + '.js')
        .then(function (res) { return res.json(); })
        .then(function (product) {
          currentProduct = product;
          selectedOptions = product.options.map(function () { return null; });

          titleEl.textContent = product.title;
          descEl.innerHTML = product.description || '';
          imageEl.src = product.featured_image || (product.images[0] || '');
          imageEl.alt = product.title;
          addedMsgEl.hidden = true;

          renderOptions(product);
          updateSelectionState(product);

          modal.hidden = false;
          document.body.style.overflow = 'hidden';
        })
        .catch(function (err) {
          console.error('Shop the look: could not load product', handle, err);
        });
    }

    function closeModal() {
      modal.hidden = true;
      document.body.style.overflow = '';
    }

    function checkBundleTrigger(variant) {
      if (!settings.bundleEnabled || !settings.bundleProductHandle) return false;
      var vals = [variant.option1, variant.option2, variant.option3]
        .filter(Boolean)
        .map(function (v) { return v.toLowerCase(); });
      var t1 = (settings.bundleOption1 || '').toLowerCase();
      var t2 = (settings.bundleOption2 || '').toLowerCase();
      if (!t1 || !t2) return false;
      return vals.indexOf(t1) !== -1 && vals.indexOf(t2) !== -1;
    }

    function getFirstAvailableVariantId(handle) {
      return fetch('/products/' + handle + '.js')
        .then(function (res) { return res.json(); })
        .then(function (product) {
          var v = product.variants.find(function (v) { return v.available; });
          return v ? v.id : null;
        });
    }

    sectionEl.querySelectorAll('.stl-hotspot').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openModalForProduct(btn.dataset.stlProductHandle);
      });
    });

    document.addEventListener('click', function () {
      document.querySelectorAll('.stl-dropdown.is-open').forEach(function (d) { d.classList.remove('is-open'); });
    });

    overlay.addEventListener('click', closeModal);
    closeBtns.forEach(function (b) { b.addEventListener('click', closeModal); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var variantId = form.dataset.variantId;
      if (!variantId || !currentProduct) return;

      var variant = currentProduct.variants.find(function (v) { return String(v.id) === String(variantId); });
      if (!variant) return;

      addBtn.disabled = true;
      var items = [{ id: variant.id, quantity: 1 }];

      var bundlePromise = checkBundleTrigger(variant)
        ? getFirstAvailableVariantId(settings.bundleProductHandle)
        : Promise.resolve(null);

      bundlePromise
        .then(function (bundleVariantId) {
          if (bundleVariantId) items.push({ id: bundleVariantId, quantity: 1 });
          return fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items })
          });
        })
        .then(function (res) {
          if (!res.ok) throw new Error('Cart add failed');
          return res.json();
        })
        .then(function () {
          addedMsgEl.hidden = false;
          document.dispatchEvent(new CustomEvent('cart:updated'));
          setTimeout(function () { closeModal(); }, 900);
        })
        .catch(function (err) {
          console.error('Shop the look: add to cart failed', err);
        })
        .finally(function () {
          addBtn.disabled = false;
        });
    });
  }

  document.querySelectorAll('.stl-section').forEach(init);
})();