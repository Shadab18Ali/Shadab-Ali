/**
 * Custom Product Grid + Popup logic
 * Vanilla JS only — no jQuery.
 *
 * Handles:
 *  - Opening popup with dynamic product/variant data (Shopify AJAX API)
 *  - Rendering "Color"-type options as a full-width segmented control
 *  - Rendering "Size"-type options as a native dropdown
 *  - Selecting a variant and updating price
 *  - Add to Cart (with special rule: Black + Medium variant
 *    also adds "Soft Winter Jacket" to the cart)
 */

(function () {
  // ---- CONFIG ----
  // Update this handle to match the actual "Soft Winter Jacket" product handle in your store.
  var AUTO_ADD_PRODUCT_HANDLE = 'soft-winter-jacket';

  var overlay = document.getElementById('tisso-popup-overlay');
  var closeBtn = document.getElementById('tisso-popup-close');
  var popupImage = document.getElementById('tisso-popup-image');
  var popupTitle = document.getElementById('tisso-popup-title');
  var popupPrice = document.getElementById('tisso-popup-price');
  var popupDescription = document.getElementById('tisso-popup-description');
  var popupOptions = document.getElementById('tisso-popup-options');
  var addToCartBtn = document.getElementById('tisso-popup-add-to-cart');
  var popupMessage = document.getElementById('tisso-popup-message');

  var currentProduct = null;
  var selectedOptions = {}; // e.g. { Color: "Black", Size: "Medium" }

  // ---- Open popup on "+" click ----
  document.querySelectorAll('.tisso-grid__plus-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var handle = btn.getAttribute('data-product-handle');
      loadProduct(handle);
    });
  });

  closeBtn.addEventListener('click', closePopup);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closePopup();
  });

  function closePopup() {
    overlay.hidden = true;
    popupMessage.hidden = true;
    currentProduct = null;
    selectedOptions = {};
  }

  // ---- Fetch product data via Shopify's AJAX API ----
  function loadProduct(handle) {
    fetch('/products/' + handle + '.js')
      .then(function (res) { return res.json(); })
      .then(function (product) {
        currentProduct = product;
        selectedOptions = {};
        renderPopup(product);
        overlay.hidden = false;
      })
      .catch(function (err) {
        console.error('Failed to load product:', err);
      });
  }

  // ---- Render popup content dynamically ----
  function renderPopup(product) {
    popupImage.src = product.featured_image ? product.featured_image : '';
    popupTitle.textContent = product.title;
    popupDescription.textContent = stripHtml(product.description);
    popupOptions.innerHTML = '';

    var firstVariant = product.variants[0];

    // Pre-select color-type options to the first variant's value.
    // Leave size-type options unselected until the shopper picks one
    // (matches the "Choose your size" placeholder in the design).
    product.options.forEach(function (optionName, index) {
      if (isSizeOption(optionName)) {
        selectedOptions[optionName] = null;
      } else {
        selectedOptions[optionName] = firstVariant.options[index];
      }
    });

    updatePriceDisplay();

    product.options.forEach(function (optionName, index) {
      var uniqueValues = [];
      product.variants.forEach(function (variant) {
        var value = variant.options[index];
        if (uniqueValues.indexOf(value) === -1) uniqueValues.push(value);
      });

      if (isSizeOption(optionName)) {
        popupOptions.appendChild(buildSizeDropdown(optionName, uniqueValues, product));
      } else {
        popupOptions.appendChild(buildSegmentedControl(optionName, uniqueValues, product));
      }
    });
  }

  function isSizeOption(optionName) {
    return optionName.toLowerCase().indexOf('size') !== -1;
  }

  // ---- Color-style full-width segmented control ----
  function buildSegmentedControl(optionName, values, product) {
    var group = document.createElement('div');
    group.className = 'tisso-option-group';

    var label = document.createElement('span');
    label.className = 'tisso-option-group__label';
    label.textContent = optionName;
    group.appendChild(label);

    var row = document.createElement('div');
    row.className = 'tisso-segmented';

    values.forEach(function (value) {
      var isSelected = selectedOptions[optionName] === value;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tisso-segmented__option' + (isSelected ? ' is-selected' : '');
      btn.textContent = value;

      btn.addEventListener('click', function () {
        selectedOptions[optionName] = value;
        row.querySelectorAll('.tisso-segmented__option').forEach(function (b) {
          b.classList.remove('is-selected');
        });
        btn.classList.add('is-selected');
        updatePriceDisplay();
      });

      row.appendChild(btn);
    });

    group.appendChild(row);
    return group;
  }

  // ---- Size dropdown ----
  function buildSizeDropdown(optionName, values, product) {
    var group = document.createElement('div');
    group.className = 'tisso-option-group';

    var label = document.createElement('span');
    label.className = 'tisso-option-group__label';
    label.textContent = optionName;
    group.appendChild(label);

    var wrap = document.createElement('div');
    wrap.className = 'tisso-select-wrap';

    var select = document.createElement('select');
    select.className = 'tisso-select';

    var placeholder = document.createElement('option');
    placeholder.textContent = 'Choose your size';
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    values.forEach(function (value) {
      var opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    });

    select.addEventListener('change', function () {
      selectedOptions[optionName] = select.value;
      updatePriceDisplay();
    });

    wrap.appendChild(select);
    group.appendChild(wrap);
    return group;
  }

  function updatePriceDisplay() {
    var variant = findMatchingVariant(currentProduct);
    if (!variant) {
      popupPrice.textContent = currentProduct ? formatMoney(currentProduct.variants[0].price) : '';
      return;
    }
    popupPrice.textContent = formatMoney(variant.price);
  }

  function findMatchingVariant(product) {
    if (!product) return null;
    return product.variants.find(function (variant) {
      return product.options.every(function (optionName, index) {
        return variant.options[index] === selectedOptions[optionName];
      });
    });
  }

  function formatMoney(cents) {
    return (cents / 100).toFixed(2) + '€';
  }

  function stripHtml(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // ---- Add to Cart ----
  addToCartBtn.addEventListener('click', function () {
    if (!currentProduct) return;

    var matchedVariant = findMatchingVariant(currentProduct);
    if (!matchedVariant) {
      showMessage('Please select all options.');
      return;
    }

    var items = [
      { id: matchedVariant.id, quantity: 1 }
    ];

    var optionValues = Object.values(selectedOptions)
      .filter(Boolean)
      .map(function (v) { return v.toLowerCase(); });

    var triggersAutoAdd = optionValues.indexOf('black') !== -1 && optionValues.indexOf('medium') !== -1;

    if (triggersAutoAdd) {
      fetch('/products/' + AUTO_ADD_PRODUCT_HANDLE + '.js')
        .then(function (res) { return res.json(); })
        .then(function (jacketProduct) {
          items.push({ id: jacketProduct.variants[0].id, quantity: 1 });
          addItemsToCart(items, true);
        })
        .catch(function () {
          addItemsToCart(items, false);
        });
    } else {
      addItemsToCart(items, false);
    }
  });

  function addItemsToCart(items, includedJacket) {
    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Add to cart failed');
        return res.json();
      })
      .then(function () {
        showMessage(includedJacket
          ? 'Added to cart — Soft Winter Jacket included!'
          : 'Added to cart!');
      })
      .catch(function (err) {
        console.error(err);
        showMessage('Something went wrong. Please try again.');
      });
  }

  function showMessage(text) {
    popupMessage.textContent = text;
    popupMessage.hidden = false;
  }
})();