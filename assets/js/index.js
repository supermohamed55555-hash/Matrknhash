// --- Landing Page Specific Logic ---

let partsDatabase = [];
let searchTimeout;

async function loadProducts() {
    try {
        const res = await fetch('/api/products');
        const data = await res.json();
        partsDatabase = Array.isArray(data) ? data : [];
        renderFeaturedProducts();
    } catch (err) {
        console.error('Failed to load products:', err);
        partsDatabase = [];
        renderFeaturedProducts();
    }
}

function renderFeaturedProducts() {
    const container = document.getElementById('featuredProducts');
    if (!container) return;
    if (partsDatabase.length === 0) {
        container.innerHTML = '<p class="text-center w-full py-8 text-slate-500">لا توجد منتجات متوفرة حالياً.</p>';
        return;
    }
    const featured = partsDatabase.slice(0, 8);
    container.innerHTML = featured.map(part => `
        <div class="product-card card">
            <div class="product-img-wrapper">
                <img src="${part.image}" alt="${part.name}">
            </div>
            <div class="product-info">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-bold text-amber-600 uppercase tracking-wider">${part.brand}</span>
                    <span class="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-bold">${part.category}</span>
                </div>
                <h3 class="type-h3 text-slate-900">${part.name}</h3>
                <div class="product-price">${part.price.toLocaleString()} ج.م</div>
                <div class="product-card-actions">
                    <button class="btn btn-outline btn-sm !text-primary !border-primary" onclick="showPartDetails('${part.name}')">التفاصيل</button>
                    <button class="btn btn-primary btn-sm" onclick="addToCart(this, '${part.name}', ${part.price}, '${part._id}')">
                        إضافة للسلة
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function setupSearchListeners() {
    const partInput = document.getElementById('partName');
    if (partInput) {
        partInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            handleSuggestions(query);
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchParts();
            }, 300);
        });
    }

    const headerSearch = document.getElementById('headerSearchInput');
    if (headerSearch) {
        headerSearch.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            const mainInput = document.getElementById('partName');
            if (mainInput) mainInput.value = query;
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchParts();
            }, 300);
        });
    }

    document.addEventListener('click', (e) => {
        const box = document.getElementById('suggestionsBox');
        if (box && !e.target.closest('.suggestions-container')) {
            box.style.display = 'none';
        }
    });

    const brandSel = document.getElementById('carBrand');
    const catSel = document.getElementById('carCategory');
    if (brandSel) brandSel.addEventListener('change', searchParts);
    if (catSel) catSel.addEventListener('change', searchParts);
}

async function handleSuggestions(query) {
    const box = document.getElementById('suggestionsBox');
    if (!box) return;
    if (query.length < 2) {
        box.style.display = 'none';
        return;
    }

    try {
        const res = await fetch(`/api/products/suggestions?q=${encodeURIComponent(query)}`);
        const suggestions = await res.json();

        if (suggestions.length > 0) {
            box.innerHTML = suggestions.map(s => `
                <div class="suggestion-item" onclick="selectSuggestion('${s}')" style="display:flex; align-items:center; gap:10px; padding:12px 15px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <span>${s}</span>
                </div>
            `).join('');
            box.style.display = 'block';
        } else {
            box.style.display = 'none';
        }
    } catch (err) {
        console.error('Suggestions error:', err);
    }
}

function selectSuggestion(val) {
    const input = document.getElementById('partName');
    if (input) input.value = val;
    const box = document.getElementById('suggestionsBox');
    if (box) box.style.display = 'none';
    searchParts();
}

async function searchParts() {
    const qEl = document.getElementById('partName');
    const brandEl = document.getElementById('carBrand');
    const catEl = document.getElementById('carCategory');
    if (!qEl || !brandEl || !catEl) return;

    const q = qEl.value.trim();
    const carBrand = brandEl.value || '';
    const category = catEl.value || '';

    let results = partsDatabase.filter(part => {
        const nameMatch = !q || part.name.toLowerCase().includes(q.toLowerCase()) ||
            part.brand.toLowerCase().includes(q.toLowerCase());
        const brandMatch = !carBrand || part.brand.toLowerCase() === carBrand.toLowerCase();
        const categoryMatch = !category || part.category === category;
        return nameMatch && brandMatch && categoryMatch;
    });

    if (results.length === 0 && q.length > 2) {
        try {
            const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
            results = await res.json();
        } catch (err) {
            console.error('Smart Search Error:', err);
        }
    }

    displayResults(results);
}

function displayResults(results) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;
    if (results.length === 0) {
        resultsContainer.innerHTML = '<p class="text-center w-full py-12 text-slate-500 col-span-full">عذراً، لم يتم العثور على نتائج تطابق معايير البحث.</p>';
    } else {
        resultsContainer.innerHTML = results.map(part => `
            <div class="product-card card">
                <div class="product-img-wrapper">
                    <img src="${part.image}" alt="${part.name}">
                </div>
                <div class="product-info">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs font-bold text-amber-600 uppercase tracking-wider">${part.brand}</span>
                        <span class="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-bold">${part.category}</span>
                    </div>
                    <h3 class="type-h3 text-slate-900">${part.name}</h3>
                    <div class="product-price">${part.price.toLocaleString()} ج.م</div>
                    <div class="product-card-actions">
                        <button class="btn btn-outline btn-sm !text-primary !border-primary" onclick="showPartDetails('${part.name}')">التفاصيل</button>
                        <button class="btn btn-primary btn-sm" onclick="addToCart(this, '${part.name}', ${part.price}, '${part._id}')">
                            إضافة للسلة
                        </button>
                    </div>
                </div>
            </div>`).join('');
    }
}

let isProcessingAdd = false;

async function addToCart(btn, partName, price, partId) {
    if (isProcessingAdd) return;
    isProcessingAdd = true;

    const part = partsDatabase.find(p => p._id === partId || p.name === partName);
    if (!part) { isProcessingAdd = false; return; }

    const overlay = document.getElementById('truckOverlay');
    const truckAnimBox = document.getElementById('truckAnimation');
    const statusText = document.getElementById('truckStatusText');

    if (overlay && truckAnimBox && statusText) {
        overlay.style.display = 'flex';
        statusText.innerText = `جاري معالجة طلب [${partName}]...`;
        truckAnimBox.innerHTML = '';
        const anim = lottie.loadAnimation({
            container: truckAnimBox,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: 'https://assets1.lottiefiles.com/packages/lf20_jpxsS6.json'
        });

        setTimeout(async () => {
            let cart = JSON.parse(localStorage.getItem('cart') || '[]');
            cart.push({
                productId: part._id,
                _id: part._id,
                name: part.name,
                price: part.price,
                image: part.image,
                seller: part.vendorName || 'متركنهاش',
                quantity: 1
            });
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartBadge();

            statusText.innerText = 'تمت الإضافة بنجاح';
            statusText.style.color = '#10b981';

            setTimeout(() => {
                overlay.style.display = 'none';
                anim.destroy();
                isProcessingAdd = false;
                statusText.style.color = 'white';
            }, 1500);
        }, 2500);
    } else {
        // Fallback if elements not found
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        cart.push({ productId: part._id, _id: part._id, name: part.name, price: part.price, image: part.image, seller: part.vendorName || 'متركنهاش', quantity: 1 });
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartBadge();
        isProcessingAdd = false;
    }
}

function showPartDetails(partName) {
    const part = partsDatabase.find(p => p.name === partName);
    if (!part) return;
    const params = new URLSearchParams({
        id: part._id,
        part: part.name,
        img: part.image,
        price: part.price,
        vendor: part.vendorName,
        condition: part.condition,
        warranty: part.warranty
    });
    window.location.href = `product-detail.html?${params.toString()}`;
}

// Auth UI Modes
let currentAuthMode = 'login';

function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'block';
        togglePremiumAuth('login');
    }
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
}

function togglePremiumAuth(mode) {
    currentAuthMode = mode;
    const isReg = mode === 'register';

    const title = document.getElementById('authTitle');
    const sub = document.getElementById('authSubtitle');
    const btn = document.getElementById('submitBtn');
    const toggle = document.getElementById('toggleText');

    if (title) title.innerText = isReg ? 'إنشاء حساب جديد' : 'تسجيل الدخول للنظام';
    if (sub) sub.innerText = isReg ? 'يرجى إدخال البيانات المطلوبة لإنشاء حسابكم' : 'يرجى إدخال البريد الإلكتروني وكلمة المرور للمتابعة';
    if (btn) btn.innerText = isReg ? 'تأكيد إنشاء الحساب' : 'دخول النظام';
    if (toggle) toggle.innerHTML = isReg ?
        `لديك حساب مفعل بالفعل؟ <button onclick="togglePremiumAuth('login')" class="text-amber-500 font-bold hover:underline">تسجيل الدخول</button>` :
        `ليس لديك حساب مسجل؟ <button onclick="togglePremiumAuth('register')" class="text-amber-500 font-bold hover:underline">أنشئ حسابك الآن</button>`;

    const roleSel = document.getElementById('roleSelector');
    const nameF = document.getElementById('nameField');
    const phoneF = document.getElementById('phoneField');
    const passS = document.getElementById('passwordStrength');
    const vendF = document.getElementById('vendorFields');

    if (roleSel) roleSel.classList.toggle('hidden', !isReg);
    if (nameF) nameF.classList.toggle('hidden', !isReg);
    if (phoneF) phoneF.classList.toggle('hidden', !isReg);
    if (passS) passS.classList.toggle('hidden', !isReg);

    if (!isReg) {
        if (vendF) vendF.classList.add('hidden');
    } else {
        const roleEl = document.getElementById('regRole');
        const role = roleEl ? roleEl.value : 'user';
        if (vendF) vendF.classList.toggle('hidden', role !== 'vendor');
    }
}

function setPremiumRole(role) {
    const roleEl = document.getElementById('regRole');
    if (roleEl) roleEl.value = role;
    const uBtn = document.getElementById('roleUser');
    const vBtn = document.getElementById('roleVendor');
    if (uBtn) uBtn.style.background = role === 'user' ? '#f59e0b' : 'rgba(255,255,255,0.05)';
    if (vBtn) vBtn.style.background = role === 'vendor' ? '#f59e0b' : 'rgba(255,255,255,0.05)';
    const vendF = document.getElementById('vendorFields');
    if (vendF) vendF.classList.toggle('hidden', role !== 'vendor');
}

// Initializations
document.addEventListener('DOMContentLoaded', () => {
    setupHeaderScroll();
    checkLoginStatus();
    loadProducts();
    setupSearchListeners();

    // Password strength listener
    const authPass = document.getElementById('authPassword');
    if (authPass) {
        authPass.addEventListener('input', function (e) {
            if (currentAuthMode !== 'register') return;
            const val = e.target.value;
            let strength = 0;
            if (val.length > 5) strength += 20;
            if (/[A-Z]/.test(val)) strength += 20;
            if (/[a-z]/.test(val)) strength += 20;
            if (/[0-9]/.test(val)) strength += 20;
            if (/[^A-Za-z0-9]/.test(val)) strength += 20;

            const strengthBar = document.getElementById('strengthBar');
            if (strengthBar) {
                strengthBar.style.width = strength + '%';
                if (strength < 40) strengthBar.style.backgroundColor = '#f87171';
                else if (strength < 80) strengthBar.style.backgroundColor = '#fbbf24';
                else strengthBar.style.backgroundColor = '#10b981';
            }
        });
    }

    // Auth Form Submit
    const authF = document.getElementById('authForm');
    if (authF) {
        authF.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            const submitBtn = document.getElementById('submitBtn');
            const originalText = submitBtn.innerText;

            submitBtn.innerText = 'جاري العمل...';
            submitBtn.disabled = true;

            try {
                if (currentAuthMode === 'login') {
                    const res = await fetch('/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert('تم تسجيل الدخول بنجاح');
                        location.reload();
                    } else {
                        alert('خطأ: ' + (data.error || 'خطأ في تسجيل الدخول'));
                    }
                } else {
                    const name = document.getElementById('regName').value;
                    const phone = document.getElementById('regPhone').value;
                    const role = document.getElementById('regRole').value;
                    const shopName = document.getElementById('regShopName').value;
                    const location = document.getElementById('regLocation').value;

                    const res = await fetch('/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, password, phone, role, shopName, location })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.');
                        togglePremiumAuth('login');
                    } else {
                        alert('خطأ: ' + (data.error || 'فشل التسجيل'));
                    }
                }
            } catch (err) {
                alert('حدث خطأ في الاتصال بالسيرفر');
            } finally {
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }
        };
    }
});
