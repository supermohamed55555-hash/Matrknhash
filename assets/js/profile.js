// --- Profile Page Specific Logic ---

async function loadProfile() {
    try {
        const userRes = await fetch('/auth/login/success');
        const userData = await userRes.json();

        if (userData.success) {
            const user = userData.user;
            const userNameLabel = document.getElementById('userNameLabel');
            const userEmailLabel = document.getElementById('userEmailLabel');
            const avatarLetter = document.getElementById('avatarLetter');

            if (userNameLabel) userNameLabel.innerText = 'أهلاً ' + user.name;
            if (userEmailLabel) userEmailLabel.innerText = user.email || '';
            if (avatarLetter) avatarLetter.innerText = user.name.charAt(0).toUpperCase();

            // --- Socket.io Real-time Notifications ---
            if (typeof io !== 'undefined') {
                const socket = io();
                socket.emit('register', { userId: user._id, role: user.role });

                socket.on('new_order', (data) => {
                    console.log('Real-time Notification:', data);
                    if (Notification.permission === "granted") {
                        new Notification("متركنهاش - طلب جديد!", { body: data.message });
                    }
                    alert(data.message + "\nرقم الطلب: #" + data.orderId.slice(-6));

                    if (user.role === 'vendor') {
                        loadOrders();
                    }
                });

                if (Notification.permission !== "denied") {
                    Notification.requestPermission();
                }
            }

            setupSidebarByRole(user.role);

            loadOrders();
            loadAddresses();
            loadGarage();
            loadWallet();
            loadReturns();
        } else {
            window.location.href = '/';
        }
    } catch (err) {
        console.error('Profile Error:', err);
    }
}

function setupSidebarByRole(role) {
    const tabs = {
        'orders': document.getElementById('tab-orders'),
        'cart': document.getElementById('tab-cart'),
        'returns': document.getElementById('tab-returns'),
        'addresses': document.getElementById('tab-addresses'),
        'garage': document.getElementById('tab-garage'),
        'wallet': document.getElementById('tab-wallet'),
        'settings': document.getElementById('tab-settings'),
        'superAdmin': document.getElementById('tab-super-admin')
    };

    Object.values(tabs).forEach(tab => {
        if (tab) tab.classList.add('hidden');
    });

    if (role === 'admin' || role === 'super-admin') {
        if (tabs.superAdmin) tabs.superAdmin.classList.remove('hidden');
        if (tabs.settings) {
            tabs.settings.classList.remove('hidden');
            tabs.settings.innerText = 'إعدادات المنصة ⚙️';
        }

        const currentHash = window.location.hash.replace('#', '');
        if (['cart', 'orders', 'returns', 'garage', 'addresses'].includes(currentHash) || !currentHash) {
            showTab('settings');
        } else {
            showTab(currentHash);
        }
    } else if (role === 'vendor') {
        if (tabs.orders) {
            tabs.orders.classList.remove('hidden');
            tabs.orders.innerText = 'طلبات المبيعات 📈';
        }
        if (tabs.wallet) {
            tabs.wallet.classList.remove('hidden');
            tabs.wallet.innerText = 'أرباحي 💰';
        }
        if (tabs.settings) tabs.settings.classList.remove('hidden');
        showTab('orders');
    } else {
        Object.values(tabs).forEach(tab => {
            if (tab && tab.id !== 'tab-super-admin') tab.classList.remove('hidden');
        });
        showTab('orders');
    }
}

async function loadOrders() {
    try {
        const res = await fetch('/api/user-orders');
        const orders = await res.json();
        const container = document.querySelector('#orders .orders-list');
        if (!container) return;

        if (orders.length > 0) {
            container.innerHTML = orders.map(order => `
                <div class="order-card">
                    <div class="order-header">
                        <span>رقم الطلب: #${order._id.slice(-5)}</span>
                        <span class="order-status">${order.status || 'Pending'}</span>
                    </div>
                    <div class="order-items-container">
                        ${order.items.map(item => `
                            <div class="order-item" style="margin-bottom:10px;">
                                <img src="${item.image || 'https://via.placeholder.com/80'}" class="order-img">
                                <div style="flex:1">
                                    <h4 style="margin:0 0 5px 0">${item.name}</h4>
                                    <p style="margin:0; font-size:0.9rem; color:#777;">${item.priceAtPurchase} ج.م | الكمية: ${item.quantity || 1}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-top:10px; border-top:1px solid #f0f0f0; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <span style="font-size:0.85rem; color:#777;">التاريخ: ${new Date(order.createdAt).toLocaleDateString('ar-EG')}</span>
                            <div style="font-weight:bold;">الإجمالي: ${order.totalPrice} ج.م</div>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button style="background:var(--primary); color:white; border:none; padding:5px 12px; border-radius:5px; cursor:pointer; font-size:0.8rem;"
                                onclick="alert('تتبع الشحنة المباشر متاح قريباً')">تتبع</button>
                        </div>
                    </div>
                    ${order.returnStatus ? `<div style="margin-top:10px; padding:8px; background:#f5f5f5; border-radius:5px; font-size:0.8rem; color:#666;">
                        حالة المرتجع: <strong>${order.returnStatus}</strong>
                    </div>` : ''}
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="text-align:center; padding:40px; opacity:0.6;">ليس لديك طلبات سابقة حالياً.</p>';
        }
    } catch (err) { console.error(err); }
}

async function loadAddresses() {
    try {
        const res = await fetch('/api/user/addresses');
        const addresses = await res.json();
        const container = document.querySelector('.addresses-list');
        if (!container) return;

        if (addresses.length > 0) {
            container.innerHTML = addresses.map(addr => `
                <div style="padding:15px; border:1px solid #eee; border-radius:10px; margin-bottom:10px; position:relative;">
                    <strong>${addr.label}</strong>
                    <p style="margin:5px 0; color:#555; font-size:0.9rem;">${addr.details}</p>
                    ${addr.isDefault ? '<span style="background:#eef2ff; color:var(--primary); padding:2px 8px; border-radius:5px; font-size:0.8rem;">افتراضي</span>' : ''}
                    <button onclick="deleteAddress('${addr._id}')" style="background:none; border:none; color:red; cursor:pointer; font-size:0.8rem; margin-top:5px;">حذف</button>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="text-align:center; color:#999;">لم تقم بإضافة أي عناوين بعد.</p>';
        }
    } catch (err) { console.error(err); }
}

async function loadWallet() {
    try {
        const res = await fetch('/api/user/wallet');
        const data = await res.json();
        const walletBalance = document.getElementById('walletBalance');
        if (walletBalance) {
            walletBalance.innerHTML = `${data.balance.toFixed(2)} <span style="font-size:1rem;">ج.م</span>`;
        }
    } catch (err) { console.error(err); }
}

async function loadReturns() {
    try {
        const res = await fetch('/api/user-returns');
        const returns = await res.json();
        const container = document.querySelector('.returns-list');
        if (!container) return;

        if (returns.length > 0) {
            container.innerHTML = returns.map(ret => `
                <div class="order-card">
                    <div class="order-header">
                        <span>طلب مرتجع #${ret._id.slice(-5)}</span>
                        <span style="background:#e6f7ff; color:#1890ff; padding:2px 8px; border-radius:10px; font-size:0.8rem;">${ret.returnStatus}</span>
                    </div>
                    <div style="font-size:0.9rem; color:#666;">السبب: ${ret.returnReason}</div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="text-align:center; padding:40px; opacity:0.6;">لا يوجد طلبات استرجاع حالياً.</p>';
        }
    } catch (err) { console.error(err); }
}

function openAddressModal() {
    const modal = document.getElementById('addressModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

function closeAddressModal() {
    const modal = document.getElementById('addressModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

async function saveAddress() {
    const label = document.getElementById('addrLabel').value;
    const details = document.getElementById('addrDetails').value;
    const isDefault = document.getElementById('addrDefault').checked;

    if (!label || !details) return alert('برجاء ملء البيانات');

    try {
        const res = await fetch('/api/user/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label, details, isDefault })
        });
        if (res.ok) {
            closeAddressModal();
            loadAddresses();
            document.getElementById('addrLabel').value = '';
            document.getElementById('addrDetails').value = '';
        }
    } catch (err) { alert('فشل حفظ العنوان'); }
}

async function deleteAddress(id) {
    if (!confirm('هل أنت متأكد من حذف هذا العنوان؟')) return;
    try {
        await fetch(`/api/user/addresses/${id}`, { method: 'DELETE' });
        loadAddresses();
    } catch (err) { alert('فشل الحذف'); }
}

async function loadGarage() {
    try {
        const res = await fetch('/api/user/garage');
        const garage = await res.json();
        const container = document.querySelector('.garage-list');
        if (!container) return;

        if (garage.length > 0) {
            container.innerHTML = garage.map(car => `
                <div style="padding:15px; border:1px solid #eef2ff; border-radius:15px; margin-bottom:10px; position:relative; background:#fafbff;">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="font-size:2rem;">🚗</div>
                        <div style="flex:1">
                            <strong style="font-size:1.1rem;">${car.make} ${car.model}</strong>
                            <p style="margin:5px 0; color:#666; font-size:0.9rem;">الموديل: ${car.year} | المحرك: ${car.engine}</p>
                            ${car.isPrimary ? '<span style="background:var(--primary); color:white; padding:2px 10px; border-radius:20px; font-size:0.75rem;">السيارة الأساسية</span>' :
                    `<button onclick="setPrimaryCar('${car._id}')" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:0.8rem; text-decoration:underline;">اجعلها الأساسية</button>`}
                        </div>
                        <button onclick="deleteCar('${car._id}')" style="background:none; border:none; color:#ff4d4f; cursor:pointer; padding:5px;">🗑️</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div style="text-align:center; padding:30px; border:1px dashed #ddd; border-radius:15px; color:#999;">كراجك فاضي.. ضيف عربيتك عشان نفلتر لك القطع</div>';
        }
    } catch (err) { console.error(err); }
}

function openGarageModal() {
    const modal = document.getElementById('garageModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

function closeGarageModal() {
    const modal = document.getElementById('garageModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

async function saveCar() {
    const make = document.getElementById('carMake').value;
    const model = document.getElementById('carModel').value;
    const year = document.getElementById('carYear').value;
    const engine = document.getElementById('carEngine').value;

    if (!make || !model) return alert('برجاء إدخال الماركة والموديل');

    try {
        const res = await fetch('/api/user/garage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ make, model, year, engine })
        });
        if (res.ok) {
            closeGarageModal();
            loadGarage();
            document.getElementById('carMake').value = '';
            document.getElementById('carModel').value = '';
            document.getElementById('carYear').value = '';
            document.getElementById('carEngine').value = '';
        }
    } catch (err) { alert('فشل إضافة السيارة'); }
}

async function deleteCar(id) {
    if (!confirm('هل أنت متأكد من حذف هذه السيارة من كراجك؟')) return;
    try {
        await fetch(`/api/user/garage/${id}`, { method: 'DELETE' });
        loadGarage();
    } catch (err) { alert('فشل الحذف'); }
}

async function setPrimaryCar(id) {
    try {
        const res = await fetch(`/api/user/garage/${id}/primary`, { method: 'PATCH' });
        if (res.ok) loadGarage();
    } catch (err) { alert('فشل تعيين السيارة الأساسية'); }
}

async function requestReturn(id) {
    const reason = prompt('برجاء ذكر سبب الاسترجاع:');
    if (!reason) return;

    try {
        const res = await fetch(`/api/orders/${id}/return`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        if (res.ok) {
            alert('تم تقديم طلب الاسترجاع بنجاح');
            loadOrders();
            loadReturns();
        }
    } catch (err) { alert('فشل تقديم الطلب'); }
}

function showTab(tabId) {
    document.querySelectorAll('.content-area').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    const tab = document.getElementById(tabId);
    if (tab) tab.classList.remove('hidden');
    const menu = document.getElementById('tab-' + tabId);
    if (menu) menu.classList.add('active');

    if (tabId === 'cart') loadCartView();
}

function loadCartView() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const list = document.getElementById('cartItemsList');
    const checkout = document.getElementById('checkoutSection');
    if (!list) return;

    if (cart.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:40px; opacity:0.5;">سلة المشتريات فارغة حالياً.. اطلب قطع غيار الآن!</div>';
        if (checkout) checkout.classList.add('hidden');
        return;
    }

    if (checkout) checkout.classList.remove('hidden');
    let total = 0;

    list.innerHTML = cart.map((item, index) => {
        total += item.price * (item.quantity || 1);
        return `
            <div style="display:flex; gap:15px; align-items:center; padding:15px; border:1px solid #eee; border-radius:12px; margin-bottom:10px;">
                <img src="${item.image}" style="width:60px; height:60px; object-fit:contain; border-radius:8px; background:#f9f9f9;">
                <div style="flex:1">
                    <h4 style="margin:0">${item.name}</h4>
                    <div style="font-size:0.85rem; color:#777;">التاجر: ${item.seller}</div>
                    <div style="color:var(--primary); font-weight:bold;">${item.price} ج.م</div>
                </div>
                <button onclick="removeFromCart(${index})" style="background:none; border:none; color:red; cursor:pointer;">🗑️</button>
            </div>
        `;
    }).join('');

    const cartTotalPrice = document.getElementById('cartTotalPrice');
    if (cartTotalPrice) cartTotalPrice.innerText = total + ' ج.م';

    // Load addresses into select
    const addrSelect = document.getElementById('checkoutAddressSelect');
    if (addrSelect) {
        fetch('/api/user/addresses').then(r => r.json()).then(addrs => {
            if (addrs.length === 0) {
                addrSelect.innerHTML = '<option value="">لا يوجد عناوين مسجلة - برجاء إضافة عنوان أولاً</option>';
                const checkoutBtn = document.getElementById('checkoutBtn');
                if (checkoutBtn) checkoutBtn.disabled = true;
            } else {
                addrSelect.innerHTML = addrs.map(a => `<option value="${a._id}">${a.label}: ${a.details}</option>`).join('');
                const checkoutBtn = document.getElementById('checkoutBtn');
                if (checkoutBtn) checkoutBtn.disabled = false;
            }
        });
    }

    // Load wallet balance
    fetch('/api/user/wallet').then(r => r.json()).then(data => {
        const checkoutWalletBalance = document.getElementById('checkoutWalletBalance');
        if (checkoutWalletBalance) {
            checkoutWalletBalance.innerText = data.balance.toFixed(2) + ' ج.م';
        }
    });
}

function removeFromCart(index) {
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    loadCartView();
}

async function processCheckout() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const addressId = document.getElementById('checkoutAddressSelect').value;
    const paymentOption = document.querySelector('input[name="paymentOption"]:checked');
    const paymentMethod = paymentOption ? paymentOption.value : 'cod';
    const btn = document.getElementById('checkoutBtn');

    if (!addressId) return alert('الرجاء اختيار عنوان الشحن');

    btn.disabled = true;
    btn.innerText = 'جاري إتمام الطلب... ⏳';

    try {
        const addrRes = await fetch('/api/user/addresses');
        const addrs = await addrRes.json();
        const selectedAddr = addrs.find(a => a._id === addressId);

        const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: cart,
                totalPrice: total,
                shippingAddress: {
                    details: selectedAddr.details,
                    label: selectedAddr.label
                },
                paymentMethod: paymentMethod
            })
        });

        const data = await res.json();
        if (data.success) {
            localStorage.setItem('cart', '[]');
            const overlay = document.getElementById('successOverlay');
            const container = document.getElementById('successAnimation');
            if (overlay) overlay.style.display = 'flex';

            if (container && typeof lottie !== 'undefined') {
                lottie.loadAnimation({
                    container: container,
                    renderer: 'svg',
                    loop: false,
                    autoplay: true,
                    path: 'https://assets9.lottiefiles.com/packages/lf20_pqnfmone.json'
                });
            }
        } else {
            alert('❌ ' + (data.error || 'فشل إتمام الطلب'));
            btn.disabled = false;
            btn.innerText = 'تأكيد وطلب الآن';
        }
    } catch (err) {
        alert('حدث خطأ في الاتصال بالخادم');
        btn.disabled = false;
        btn.innerText = 'تأكيد وطلب الآن';
    }
}

function dismissSuccess() {
    const successOverlay = document.getElementById('successOverlay');
    if (successOverlay) successOverlay.style.display = 'none';
    showTab('orders');
    loadOrders();
    loadWallet();
    const btn = document.getElementById('checkoutBtn');
    if (btn) {
        btn.disabled = false;
        btn.innerText = 'تأكيد وطلب الآن';
    }
}

function logout() {
    window.location.href = '/logout';
}

window.addEventListener('load', () => {
    loadProfile().then(() => {
        if (window.location.hash === '#cart') showTab('cart');
    });
});
