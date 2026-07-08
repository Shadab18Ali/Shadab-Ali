
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
    product.options.forEach(function (optionName, index) {
      selectedOptions[optionName] = firstVariant.options[index];
    });

    updatePrice(firstVariant);

    product.options.forEach(function (optionName, index) {
      var group = document.createElement('div');
      group.className = 'tisso-option-group';

      var label = document.createElement('span');
      label.className = 'tisso-option-group__label';
      label.textContent = optionName;
      group.appendChild(label);

      var valuesWrap = document.createElement('div');
      valuesWrap.className = 'tisso-option-group__values';

      var uniqueValues = [];
      product.variants.forEach(function (variant) {
        var value = variant.options[index];
        if (uniqueValues.indexOf(value) === -1) uniqueValues.push(value);
      });

      uniqueValues.forEach(function (value) {
        var isSelected = selectedOptions[optionName] === value;
        var optionBtn = document.createElement('button');
        optionBtn.type = 'button';
        optionBtn.className = 'tisso-option-value' + (isSelected ? ' is-selected' : '');
        optionBtn.textContent = value;
        optionBtn.setAttribute('data-option-name', optionName);
        optionBtn.setAttribute('data-option-value', value);

        optionBtn.addEventListener('click', function () {
          selectedOptions[optionName] = value;
          valuesWrap.querySelectorAll('.tisso-option-value').forEach(function (b) {
            b.classList.remove('is-selected');
          });
          optionBtn.classList.add('is-selected');

          var matchedVariant = findMatchingVariant(product);
          updatePrice(matchedVariant);
        });

        valuesWrap.appendChild(optionBtn);
      });

      group.appendChild(valuesWrap);
      popupOptions.appendChild(group);
    });
  }

  function updatePrice(variant) {
    if (!variant) {
      popupPrice.textContent = 'Unavailable';
      return;
    }
    popupPrice.textContent = formatMoney(variant.price);
  }

  function findMatchingVariant(product) {
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

    var optionValues = Object.values(selectedOptions).map(function (v) {
      return v.toLowerCase();
    });
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