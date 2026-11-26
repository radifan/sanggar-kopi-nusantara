/**
 * Sanggar Kopi Nusantara - Core Application Script
 * Prinsip Keamanan:
 * - Zero innerHTML untuk data dinamis (murni createElement + textContent)
 * - Validasi skema ketat untuk pembacaan LocalStorage (mencegah prototype pollution & corrupt data)
 * - Sanitasi input pengguna sebelum disusun ke URL WhatsApp
 * - Tanpa eval(), tanpa inline handler, tanpa hardcoded secrets
 */

'use strict';

(function () {
  // Nomor WhatsApp Publik Toko (Format internasional tanpa tanda +)
  const STORE_WHATSAPP_NUMBER = '6281234567890';
  const STORAGE_KEY = 'sanggar_kopi_cart_v1';
  const MAX_QTY_PER_ITEM = 50;

  // Katalog 6 Produk Kopi Nusantara
  const PRODUCTS = Object.freeze([
    {
      id: 'kopi-gayo-honey',
      name: 'Aceh Gayo Honey Process',
      category: 'Arabika',
      origin: 'Takengon, Aceh Tengah',
      roastLevel: 'Medium Roast',
      tastingNotes: 'Gula aren, aprikot, melati lembut',
      weight: '200g',
      price: 88000,
      image: 'https://images.unsplash.com/photo-1587734195503-904fca47e0e9?auto=format&fit=crop&w=700&q=80'
    },
    {
      id: 'kopi-toraja-sapan',
      name: 'Toraja Sapan Washed',
      category: 'Arabika',
      origin: 'Tana Toraja, Sulawesi Selatan',
      roastLevel: 'Medium Roast',
      tastingNotes: 'Cokelat hitam, rempah kayu manis, jeruk keprok',
      weight: '200g',
      price: 92000,
      image: 'https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?auto=format&fit=crop&w=700&q=80'
    },
    {
      id: 'kopi-flores-bajawa',
      name: 'Flores Bajawa Natural',
      category: 'Arabika',
      origin: 'Ngada, Nusa Tenggara Timur',
      roastLevel: 'Light-Medium',
      tastingNotes: 'Nangka matang, karamel, kakao manis',
      weight: '200g',
      price: 90000,
      image: 'https://images.unsplash.com/photo-1511537190424-bbbab87ac5eb?auto=format&fit=crop&w=700&q=80'
    },
    {
      id: 'kopi-temanggung-fine',
      name: 'Fine Robusta Temanggung',
      category: 'Robusta',
      origin: 'Lereng Sindoro, Jawa Tengah',
      roastLevel: 'Medium-Dark',
      tastingNotes: 'Cokelat panggang, kacang almond, bodi tebal',
      weight: '200g',
      price: 68000,
      image: 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&w=700&q=80'
    },
    {
      id: 'kopi-lampung-ulubelu',
      name: 'Robusta Petik Merah Ulubelu',
      category: 'Robusta',
      origin: 'Tanggamus, Lampung',
      roastLevel: 'Dark Roast',
      tastingNotes: 'Karamel gosong, moka pekat, rendah asam',
      weight: '200g',
      price: 65000,
      image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=700&q=80'
    },
    {
      id: 'kopi-sanggar-senja',
      name: 'Sanggar Senja House Blend',
      category: 'House Blend',
      origin: '70% Arabika Priangan • 30% Robusta Temanggung',
      roastLevel: 'Medium-Dark',
      tastingNotes: 'Hazelnut, gula merah, seimbang untuk kopi susu',
      weight: '200g',
      price: 78000,
      image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=80'
    }
  ]);

  const PRODUCT_MAP = new Map(PRODUCTS.map((item) => [item.id, item]));

  // State Aplikasi
  let state = {
    selectedCategory: 'Semua',
    searchQuery: '',
    cart: loadValidatedCart()
  };

  // Referensi Elemen DOM
  const dom = {
    productGrid: document.getElementById('product-grid'),
    emptyState: document.getElementById('empty-state'),
    searchInput: document.getElementById('search-input'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    resetFilterBtn: document.getElementById('reset-filter-btn'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    mobileMenu: document.getElementById('mobile-menu'),
    mobileNavLinks: document.querySelectorAll('.mobile-nav-link'),
    openCartBtn: document.getElementById('open-cart-btn'),
    closeCartBtn: document.getElementById('close-cart-btn'),
    cartOverlay: document.getElementById('cart-overlay'),
    cartDrawer: document.getElementById('cart-drawer'),
    cartBadge: document.getElementById('cart-badge'),
    cartItemsContainer: document.getElementById('cart-items-container'),
    cartFooter: document.getElementById('cart-footer'),
    cartTotalPrice: document.getElementById('cart-total-price'),
    customerName: document.getElementById('customer-name'),
    customerAddress: document.getElementById('customer-address'),
    grindSize: document.getElementById('grind-size'),
    clearCartBtn: document.getElementById('clear-cart-btn'),
    checkoutWaBtn: document.getElementById('checkout-wa-btn'),
    confirmModal: document.getElementById('confirm-modal'),
    cancelConfirmBtn: document.getElementById('cancel-confirm-btn'),
    acceptConfirmBtn: document.getElementById('accept-confirm-btn'),
    toastContainer: document.getElementById('toast-container')
  };

  /**
   * Utilitas Format Rupiah
   */
  function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Sanitasi string input teks agar bersih dari karakter kontrol berbahaya
   */
  function sanitizeTextInput(rawValue, maxLength) {
    if (typeof rawValue !== 'string') return '';
    // Hapus karakter kontrol ASCII (kecuali spasi) dan rapikan spasi berlebih
    const cleaned = rawValue.replace(/[\u0000-\u001F\u007F]/g, '').trim();
    return cleaned.slice(0, maxLength);
  }

  /**
   * Memuat dan memvalidasi data keranjang dari localStorage secara ketat
   */
  function loadValidatedCart() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return {};
      }
      const cleanCart = {};
      for (const key of Object.keys(parsed)) {
        // Hanya terima ID produk yang valid di katalog & jumlah integer positif
        if (Object.prototype.hasOwnProperty.call(parsed, key) && PRODUCT_MAP.has(key)) {
          const qty = Number(parsed[key]);
          if (Number.isInteger(qty) && qty > 0 && qty <= MAX_QTY_PER_ITEM) {
            cleanCart[key] = qty;
          }
        }
      }
      return cleanCart;
    } catch (_err) {
      return {};
    }
  }

  /**
   * Menyimpan keranjang ke localStorage dengan penanganan kuota/error
   */
  function saveCart() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
    } catch (_err) {
      showToast('Gagal menyimpan keranjang ke penyimpanan browser.', 'error');
    }
  }

  /**
   * Menampilkan notifikasi Toast di dalam halaman (pengganti alert)
   */
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast-enter pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-lg text-sm font-semibold border';

    if (type === 'error') {
      toast.classList.add('bg-[#2B2A27]', 'text-white', 'border-[#CB6D51]');
    } else {
      toast.classList.add('bg-[#6B705C]', 'text-[#F6F1E9]', 'border-[#F6F1E9]/20');
    }

    const dot = document.createElement('span');
    dot.className = type === 'error'
      ? 'w-2.5 h-2.5 rounded-full bg-[#CB6D51] shrink-0'
      : 'w-2.5 h-2.5 rounded-full bg-[#F6F1E9] shrink-0';

    const textSpan = document.createElement('span');
    textSpan.textContent = message;

    toast.appendChild(dot);
    toast.appendChild(textSpan);
    dom.toastContainer.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      window.setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Membuat elemen kartu produk menggunakan DOM API murni (100% anti-XSS)
   */
  function createProductCard(product) {
    const article = document.createElement('article');
    article.className = 'bg-white rounded-3xl overflow-hidden border border-[#6B705C]/20 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col';

    // Wrapper Gambar
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'relative h-56 overflow-hidden bg-[#6B705C]/10';

    const img = document.createElement('img');
    img.src = product.image;
    img.alt = product.name;
    img.loading = 'lazy';
    img.className = 'w-full h-full object-cover hover:scale-105 transition-transform duration-500';

    const badgeCategory = document.createElement('span');
    badgeCategory.className = 'absolute top-3.5 left-3.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F6F1E9]/95 text-[#6B705C] shadow-xs';
    badgeCategory.textContent = product.category;

    const badgeRoast = document.createElement('span');
    badgeRoast.className = 'absolute bottom-3.5 right-3.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#2B2A27]/80 text-[#F6F1E9]';
    badgeRoast.textContent = product.roastLevel;

    imgWrapper.appendChild(img);
    imgWrapper.appendChild(badgeCategory);
    imgWrapper.appendChild(badgeRoast);

    // Konten Kartu
    const body = document.createElement('div');
    body.className = 'p-6 flex-1 flex flex-col justify-between space-y-5';

    const infoBlock = document.createElement('div');

    const originEl = document.createElement('p');
    originEl.className = 'text-xs font-semibold text-[#6B705C] uppercase tracking-wider';
    originEl.textContent = product.origin;

    const titleEl = document.createElement('h3');
    titleEl.className = 'font-serif text-xl font-bold text-[#2B2A27] mt-1';
    titleEl.textContent = product.name;

    const notesBox = document.createElement('div');
    notesBox.className = 'mt-3 p-3 rounded-xl bg-[#F6F1E9] border border-[#6B705C]/15';

    const notesLabel = document.createElement('span');
    notesLabel.className = 'block text-[11px] font-bold uppercase tracking-wider text-[#6B705C]';
    notesLabel.textContent = 'Catatan Rasa';

    const notesText = document.createElement('p');
    notesText.className = 'text-sm text-[#2B2A27]/85 mt-0.5';
    notesText.textContent = product.tastingNotes;

    notesBox.appendChild(notesLabel);
    notesBox.appendChild(notesText);

    infoBlock.appendChild(originEl);
    infoBlock.appendChild(titleEl);
    infoBlock.appendChild(notesBox);

    // Footer Harga & Tombol Tambah
    const actionRow = document.createElement('div');
    actionRow.className = 'pt-4 border-t border-[#6B705C]/15 flex items-center justify-between gap-3';

    const priceGroup = document.createElement('div');
    const weightSpan = document.createElement('span');
    weightSpan.className = 'block text-xs text-[#2B2A27]/60';
    weightSpan.textContent = 'Kemasan ' + product.weight;

    const priceSpan = document.createElement('span');
    priceSpan.className = 'font-serif text-lg font-bold text-[#2B2A27]';
    priceSpan.textContent = formatRupiah(product.price);

    priceGroup.appendChild(weightSpan);
    priceGroup.appendChild(priceSpan);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#CB6D51] text-white text-sm font-bold hover:bg-[#B85C40] active:scale-[0.97] transition-all shadow-xs min-h-[44px]';
    addBtn.setAttribute('aria-label', 'Tambah ' + product.name + ' ke keranjang');
    addBtn.textContent = '+ Keranjang';
    addBtn.addEventListener('click', () => {
      addToCart(product.id);
    });

    actionRow.appendChild(priceGroup);
    actionRow.appendChild(addBtn);

    body.appendChild(infoBlock);
    body.appendChild(actionRow);

    article.appendChild(imgWrapper);
    article.appendChild(body);

    return article;
  }

  /**
   * Merender katalog produk berdasarkan filter kategori dan kata kunci pencarian
   */
  function renderProducts() {
    const queryLower = state.searchQuery.toLowerCase();

    const filtered = PRODUCTS.filter((product) => {
      const matchCategory = state.selectedCategory === 'Semua' || product.category === state.selectedCategory;
      const matchQuery =
        !queryLower ||
        product.name.toLowerCase().includes(queryLower) ||
        product.tastingNotes.toLowerCase().includes(queryLower) ||
        product.origin.toLowerCase().includes(queryLower);
      return matchCategory && matchQuery;
    });

    // Kosongkan grid secara aman
    dom.productGrid.replaceChildren();

    if (filtered.length === 0) {
      dom.productGrid.classList.add('hidden');
      dom.emptyState.classList.remove('hidden');
      return;
    }

    dom.emptyState.classList.add('hidden');
    dom.productGrid.classList.remove('hidden');

    const fragment = document.createDocumentFragment();
    filtered.forEach((product) => {
      fragment.appendChild(createProductCard(product));
    });
    dom.productGrid.appendChild(fragment);
  }

  /**
   * Menambah produk ke keranjang
   */
  function addToCart(productId) {
    const product = PRODUCT_MAP.get(productId);
    if (!product) return;

    const currentQty = state.cart[productId] || 0;
    if (currentQty >= MAX_QTY_PER_ITEM) {
      showToast('Maksimal ' + MAX_QTY_PER_ITEM + ' kemasan per varian kopi.', 'error');
      return;
    }

    state.cart[productId] = currentQty + 1;
    saveCart();
    renderCart();
    showToast(product.name + ' ditambahkan ke keranjang.');
  }

  /**
   * Mengubah kuantitas item di keranjang
   */
  function updateCartQty(productId, delta) {
    if (!PRODUCT_MAP.has(productId)) return;
    const currentQty = state.cart[productId] || 0;
    const nextQty = currentQty + delta;

    if (nextQty <= 0) {
      delete state.cart[productId];
    } else if (nextQty > MAX_QTY_PER_ITEM) {
      showToast('Maksimal ' + MAX_QTY_PER_ITEM + ' kemasan per varian.', 'error');
      return;
    } else {
      state.cart[productId] = nextQty;
    }

    saveCart();
    renderCart();
  }

  /**
   * Merender isi keranjang belanja menggunakan DOM API murni
   */
  function renderCart() {
    const entries = Object.entries(state.cart);
    let totalItems = 0;
    let totalPrice = 0;

    dom.cartItemsContainer.replaceChildren();

    if (entries.length === 0) {
      dom.cartBadge.textContent = '0';
      dom.cartTotalPrice.textContent = formatRupiah(0);
      dom.cartFooter.classList.add('hidden');

      const emptyBox = document.createElement('div');
      emptyBox.className = 'h-full flex flex-col items-center justify-center text-center py-12 px-4';

      const emptyTitle = document.createElement('p');
      emptyTitle.className = 'font-serif text-lg font-bold text-[#2B2A27]';
      emptyTitle.textContent = 'Keranjang Anda masih kosong';

      const emptySub = document.createElement('p');
      emptySub.className = 'text-sm text-[#2B2A27]/70 mt-1.5';
      emptySub.textContent = 'Pilih biji kopi favorit Anda dari katalog untuk mulai memesan.';

      emptyBox.appendChild(emptyTitle);
      emptyBox.appendChild(emptySub);
      dom.cartItemsContainer.appendChild(emptyBox);
      return;
    }

    dom.cartFooter.classList.remove('hidden');
    const fragment = document.createDocumentFragment();

    entries.forEach(([productId, qty]) => {
      const product = PRODUCT_MAP.get(productId);
      if (!product) return;

      totalItems += qty;
      totalPrice += product.price * qty;

      const row = document.createElement('div');
      row.className = 'p-4 rounded-2xl bg-white border border-[#6B705C]/20 flex items-center justify-between gap-3';

      const info = document.createElement('div');
      info.className = 'min-w-0 flex-1';

      const nameEl = document.createElement('h4');
      nameEl.className = 'font-serif font-bold text-sm text-[#2B2A27] truncate';
      nameEl.textContent = product.name;

      const metaEl = document.createElement('p');
      metaEl.className = 'text-xs text-[#6B705C] mt-0.5';
      metaEl.textContent = product.category + ' • ' + formatRupiah(product.price);

      info.appendChild(nameEl);
      info.appendChild(metaEl);

      // Kontrol Kuantitas
      const qtyControls = document.createElement('div');
      qtyControls.className = 'flex items-center gap-2 shrink-0';

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'w-9 h-9 rounded-xl bg-[#F6F1E9] text-[#2B2A27] font-bold hover:bg-[#6B705C]/20 transition-colors flex items-center justify-center';
      minusBtn.setAttribute('aria-label', 'Kurangi jumlah ' + product.name);
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', () => updateCartQty(productId, -1));

      const qtyText = document.createElement('span');
      qtyText.className = 'w-6 text-center text-sm font-bold text-[#2B2A27]';
      qtyText.textContent = String(qty);

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'w-9 h-9 rounded-xl bg-[#F6F1E9] text-[#2B2A27] font-bold hover:bg-[#6B705C]/20 transition-colors flex items-center justify-center';
      plusBtn.setAttribute('aria-label', 'Tambah jumlah ' + product.name);
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', () => updateCartQty(productId, 1));

      qtyControls.appendChild(minusBtn);
      qtyControls.appendChild(qtyText);
      qtyControls.appendChild(plusBtn);

      row.appendChild(info);
      row.appendChild(qtyControls);
      fragment.appendChild(row);
    });

    dom.cartItemsContainer.appendChild(fragment);
    dom.cartBadge.textContent = String(totalItems);
    dom.cartTotalPrice.textContent = formatRupiah(totalPrice);
  }

  /**
   * Buka & Tutup Drawer Keranjang
   */
  function openCartDrawer() {
    dom.cartOverlay.classList.remove('hidden');
    dom.cartDrawer.classList.remove('translate-x-full');
    document.body.classList.add('overflow-hidden');
  }

  function closeCartDrawer() {
    dom.cartOverlay.classList.add('hidden');
    dom.cartDrawer.classList.add('translate-x-full');
    document.body.classList.remove('overflow-hidden');
  }

  /**
   * Buka & Tutup Modal Konfirmasi In-Page
   */
  function openConfirmModal() {
    dom.confirmModal.classList.remove('hidden');
    dom.confirmModal.classList.add('flex');
  }

  function closeConfirmModal() {
    dom.confirmModal.classList.add('hidden');
    dom.confirmModal.classList.remove('flex');
  }

  /**
   * Validasi & Pengiriman Pesanan ke WhatsApp
   */
  function handleWhatsAppCheckout() {
    const entries = Object.entries(state.cart);
    if (entries.length === 0) {
      showToast('Keranjang belanja Anda masih kosong.', 'error');
      return;
    }

    const customerName = sanitizeTextInput(dom.customerName.value, 50);
    const customerAddress = sanitizeTextInput(dom.customerAddress.value, 100);
    const grindSize = sanitizeTextInput(dom.grindSize.value, 40);

    if (customerName.length < 2) {
      showToast('Mohon isi nama pemesan minimal 2 karakter.', 'error');
      dom.customerName.focus();
      return;
    }

    if (customerAddress.length < 4) {
      showToast('Mohon isi kota atau alamat pengiriman Anda.', 'error');
      dom.customerAddress.focus();
      return;
    }

    let totalPrice = 0;
    const itemLines = entries.map(([productId, qty], index) => {
      const product = PRODUCT_MAP.get(productId);
      const subtotal = product.price * qty;
      totalPrice += subtotal;
      return `${index + 1}. ${product.name} (${qty}x @ ${formatRupiah(product.price)}) = ${formatRupiah(subtotal)}`;
    });

    const messageLines = [
      'Halo *Sanggar Kopi Nusantara*, saya ingin memesan biji kopi sangrai:',
      '',
      '*Detail Pesanan:*',
      ...itemLines,
      '',
      `*Total Pembayaran:* ${formatRupiah(totalPrice)}`,
      `*Bentuk Gilingan:* ${grindSize}`,
      '',
      '*Data Pemesan:*',
      `Nama: ${customerName}`,
      `Alamat/Kota: ${customerAddress}`,
      '',
      'Mohon informasi ketersediaan stok dan ongkos kirimnya. Terima kasih!'
    ];

    const encodedMessage = encodeURIComponent(messageLines.join('\n'));
    const waUrl = `https://wa.me/${STORE_WHATSAPP_NUMBER}?text=${encodedMessage}`;

    // Buka di tab baru dengan rel noopener noreferrer untuk mencegah tabnabbing
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    showToast('Mengarahkan pesanan Anda ke WhatsApp...');
  }

  /**
   * Inisialisasi Event Listeners
   */
  function initEventListeners() {
    // Filter Kategori
    dom.filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const category = btn.getAttribute('data-category') || 'Semua';
        state.selectedCategory = category;

        dom.filterBtns.forEach((b) => {
          b.classList.remove('bg-[#6B705C]', 'text-[#F6F1E9]');
          b.classList.add('bg-[#F6F1E9]', 'text-[#2B2A27]');
        });
        btn.classList.remove('bg-[#F6F1E9]', 'text-[#2B2A27]');
        btn.classList.add('bg-[#6B705C]', 'text-[#F6F1E9]');

        renderProducts();
      });
    });

    // Pencarian Real-time
    dom.searchInput.addEventListener('input', (event) => {
      state.searchQuery = sanitizeTextInput(event.target.value, 60);
      renderProducts();
    });

    // Reset Filter
    dom.resetFilterBtn.addEventListener('click', () => {
      state.selectedCategory = 'Semua';
      state.searchQuery = '';
      dom.searchInput.value = '';

      dom.filterBtns.forEach((b) => {
        const isAll = b.getAttribute('data-category') === 'Semua';
        b.classList.toggle('bg-[#6B705C]', isAll);
        b.classList.toggle('text-[#F6F1E9]', isAll);
        b.classList.toggle('bg-[#F6F1E9]', !isAll);
        b.classList.toggle('text-[#2B2A27]', !isAll);
      });

      renderProducts();
    });

    // Mobile Menu Toggle
    dom.mobileMenuBtn.addEventListener('click', () => {
      const isExpanded = dom.mobileMenuBtn.getAttribute('aria-expanded') === 'true';
      dom.mobileMenuBtn.setAttribute('aria-expanded', String(!isExpanded));
      dom.mobileMenu.classList.toggle('hidden');
    });

    dom.mobileNavLinks.forEach((link) => {
      link.addEventListener('click', () => {
        dom.mobileMenuBtn.setAttribute('aria-expanded', 'false');
        dom.mobileMenu.classList.add('hidden');
      });
    });

    // Drawer Keranjang
    dom.openCartBtn.addEventListener('click', openCartDrawer);
    dom.closeCartBtn.addEventListener('click', closeCartDrawer);
    dom.cartOverlay.addEventListener('click', closeCartDrawer);

    // Modal Konfirmasi Kosongkan Keranjang
    dom.clearCartBtn.addEventListener('click', openConfirmModal);
    dom.cancelConfirmBtn.addEventListener('click', closeConfirmModal);
    dom.acceptConfirmBtn.addEventListener('click', () => {
      state.cart = {};
      saveCart();
      renderCart();
      closeConfirmModal();
      showToast('Keranjang belanja telah dikosongkan.');
    });

    // Checkout WhatsApp
    dom.checkoutWaBtn.addEventListener('click', handleWhatsAppCheckout);

    // Tutup drawer / modal dengan tombol Escape
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!dom.confirmModal.classList.contains('hidden')) {
          closeConfirmModal();
        } else if (!dom.cartDrawer.classList.contains('translate-x-full')) {
          closeCartDrawer();
        }
      }
    });
  }

  // Bootstrap Aplikasi
  initEventListeners();
  renderProducts();
  renderCart();
})();