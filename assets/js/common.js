// --- Common Utility Functions ---
// Designed for 'MetrknHash' Marketplace - Carbon & Steel System

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
                    <a href="/super-admin.html" class="btn btn-secondary px-4 py-2 text-xs">
                        لوحة الإدارة
                    </a>
                `;
            } else if (user.role === 'vendor') {
                vendorDashboardBtn = `
                    <a href="/admin.html" class="btn btn-secondary px-4 py-2 text-xs">
                        مركز التاجر
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
                    <div class="cart-icon-container" onclick="window.location.href='profile.html#cart'" style="cursor:pointer; position:relative; padding: 0 10px; display: flex; align-items: center;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                        <span id="cartBadge" class="absolute -top-1 -right-1 bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded-full hidden">0</span>
                    </div>
                `;
            }

            loginNavItem.innerHTML = `
                <div class="flex items-center gap-4">
                    ${vendorDashboardBtn}
                    ${cartIcon}
                    <div class="flex items-center gap-3 pr-4 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 transition cursor-pointer" onclick="window.location.href='/profile.html'">
                        <span class="text-slate-900 font-bold text-xs">${user.name.split(' ')[0]}</span>
                        <div class="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </div>
                    </div>
                </div>
            `;

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

    if (!heroTitle) return;

    if (user.role === 'admin' || user.role === 'super-admin' || user.role === 'vendor') {
        const sectionsToHide = ['#search', '.products', '#features', '.bg-white.py-24'];
        sectionsToHide.forEach(s => {
            const el = document.querySelector(s) || document.getElementById(s.replace('#',''));
            if (el) el.style.display = 'none';
        });

        heroTitle.innerText = user.role === 'vendor' ? 'مركز إدارة المبيعات' : 'لوحة تحكم المنصة';
        heroSub.innerText = `أهلاً بك سيد ${user.name}. جميع أدوات الإدارة المتقدمة متاحة لك الآن.`;
        if (heroBtns) {
            heroBtns.innerHTML = `
                <a href="${user.role === 'vendor' ? '/admin.html' : '/super-admin.html'}" class="btn btn-primary px-12">فتح لوحة التحكم</a>
                <a href="profile.html" class="btn btn-outline border-white text-white hover:bg-white hover:text-slate-900">الملف الشخصي</a>
            `;
        }
    } else {
        if (heroBtns) {
            heroBtns.innerHTML = `
                <a href="#search" class="btn btn-primary">تصفح المنتجات</a>
                <span class="text-white font-bold mr-6">مرحباً بك، ${user.name.split(' ')[0]}</span>
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
            window.location.href = '/login';
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
    const header = document.querySelector('.header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                header.classList.add('shadow-md');
                header.style.padding = '8px 0';
            } else {
                header.classList.remove('shadow-md');
                header.style.padding = '16px 0';
            }
        });
    }
}

window.onclick = function (event) {
    const modal = document.getElementById('loginModal');
    if (event.target == modal && typeof closeLoginModal === 'function') {
        closeLoginModal();
    }
}
