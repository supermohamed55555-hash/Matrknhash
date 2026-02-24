// --- Common Utility Functions ---

async function checkLoginStatus() {
    try {
        const res = await fetch('/auth/login/success');
        const data = await res.json();
        window.currentUser = data.success ? data.user : null;

        const loginNavItem = document.getElementById('loginNavItem');
        if (loginNavItem && data.user) {
            const user = data.user;
            let vendorDashboardBtn = '';
            if (user.role === 'admin' || user.role === 'super-admin') {
                vendorDashboardBtn = `
                    <a href="/super-admin.html" class="flex items-center gap-2 px-4 py-2 rounded-full border border-orange-300 bg-orange-50 hover:bg-orange-100 transition text-orange-700 font-bold text-sm shadow-sm">
                        لوحة الإدارة
                    </a>
                `;
            } else if (user.role === 'vendor') {
                vendorDashboardBtn = `
                    <a href="/admin.html" class="flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/20 transition text-primary font-bold text-sm">
                        لوحة التاجر
                    </a>
                `;
            }

            let cartIcon = '';
            const headerSearch = document.getElementById('headerSearchGroup');

            if (user.role === 'admin' || user.role === 'super-admin' || user.role === 'vendor') {
                if (headerSearch) headerSearch.style.display = 'none';
            } else {
                if (headerSearch) headerSearch.style.display = 'block';
                cartIcon = `
                    <div class="cart-icon-container" onclick="window.location.href='profile.html#cart'" style="cursor:pointer; position:relative; padding: 0 5px; display: flex; align-items: center;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                        <span id="cartBadge" style="position:absolute; top:-8px; right:-8px; background:var(--accent); color:white; font-size:0.65rem; font-weight:bold; padding:2px 6px; border-radius:50%; border: 2px solid var(--primary); display:none;">0</span>
                    </div>
                `;
            }

            loginNavItem.innerHTML = `
                <div class="flex items-center gap-2">
                    ${vendorDashboardBtn}
                    ${cartIcon}
                    <div class="flex items-center gap-2 pr-3 py-1 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition cursor-pointer" onclick="window.location.href='/profile.html'" style="min-width: fit-content;">
                        <span class="text-white font-bold text-xs">${user.name.split(' ')[0]}</span>
                        <div class="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                        </div>
                    </div>
                </div>
            `;

            // Update Hero if on Index page
            updateHeroForRole(user);
        }
        updateCartBadge();
        return data.user;
    } catch (err) {
        console.error('Login check failed:', err);
    }
}

function updateHeroForRole(user) {
    const heroTitle = document.querySelector('.hero-content h1');
    const heroSub = document.querySelector('.hero-content p');
    const heroBtns = document.querySelector('.hero-btns');

    if (!heroTitle) return; // Not on landing page

    if (user.role === 'admin' || user.role === 'super-admin') {
        const searchSection = document.getElementById('search');
        const productsSection = document.querySelector('.products');
        const featuresSection = document.getElementById('features');
        if (searchSection) searchSection.style.display = 'none';
        if (productsSection) productsSection.style.display = 'none';
        if (featuresSection) featuresSection.style.display = 'none';

        heroTitle.innerText = 'لوحة تحكم الإدارة';
        heroSub.innerText = `مرحباً ${user.name}. كافة أدوات الإدارة متاحة الآن للتحكم في المنصة.`;
        if (heroBtns) {
            heroBtns.innerHTML = `
                <a href="/super-admin.html" class="cta-primary">فتح لوحة الإدارة</a>
                <a href="profile.html" class="cta-secondary">الملف الشخصي</a>
            `;
        }
    } else if (user.role === 'vendor') {
        const searchSection = document.getElementById('search');
        const productsSection = document.querySelector('.products');
        const featuresSection = document.getElementById('features');
        if (searchSection) searchSection.style.display = 'none';
        if (productsSection) productsSection.style.display = 'none';
        if (featuresSection) featuresSection.style.display = 'none';

        heroTitle.innerText = 'مركز إدارة المبيعات';
        heroSub.innerText = `مرحباً ${user.name}. يمكنك متابعة طلبات المبيعات وإدارة المخزون والمنتجات من هنا.`;
        if (heroBtns) {
            heroBtns.innerHTML = `
                <a href="/admin.html" class="cta-primary">فتح لوحة التاجر</a>
                <a href="profile.html" class="cta-secondary">الملف الشخصي</a>
            `;
        }
    } else {
        if (heroBtns) {
            heroBtns.innerHTML = `
                <a href="#search" class="cta-primary">تصفح المنتجات</a>
                <span class="text-white/80 font-bold mr-4">مرحباً بك ${user.name.split(' ')[0]}</span>
            `;
        }
    }
}

function handleAccountClick(e) {
    if (!window.currentUser) {
        e.preventDefault();
        if (typeof openLoginModal === 'function') {
            openLoginModal();
        } else {
            window.location.href = '/login'; // Fallback
        }
    }
}

function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const badge = document.getElementById('cartBadge');
    if (badge) {
        if (cart.length > 0) {
            badge.innerText = cart.length;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

function setupHeaderScroll() {
    const header = document.getElementById('mainHeader');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }
}

// Global closeModal listener
window.onclick = function (event) {
    const modal = document.getElementById('loginModal');
    if (event.target == modal && typeof closeLoginModal === 'function') {
        closeLoginModal();
    }
}
