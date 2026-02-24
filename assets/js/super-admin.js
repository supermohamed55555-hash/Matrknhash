// --- Super Admin Dashboard Specific Logic ---

async function checkAdmin() {
    try {
        const res = await fetch('/auth/login/success');
        const data = await res.json();
        console.log('Admin Auth Check:', data);

        if (!data.success || (data.user.role !== 'admin' && data.user.role !== 'super-admin')) {
            console.error('Not an admin! Data:', data);
            alert('عذراً، هذا الحساب ليس لديه صلاحيات مدير عام.\nسيتم توجيهك للموقع الرئيسي.');
            window.location.href = '/';
        } else {
            const adminName = document.getElementById('adminName');
            if (adminName) adminName.innerText = data.user.name;

            // --- Socket.io Real-time Notifications for Admin ---
            if (typeof io !== 'undefined') {
                const socket = io();
                socket.emit('register', { userId: data.user._id, role: 'admin' });

                socket.on('new_order', (orderData) => {
                    console.log('Admin: New Order Received:', orderData);
                    if (Notification.permission === "granted") {
                        new Notification("متركنهاش - طلب جديد على المنصة!", { body: `طلب جديد بقيمة ${orderData.totalPrice} ج.م` });
                    }
                    loadStats();
                    const ordersTab = document.getElementById('orders');
                    if (ordersTab && !ordersTab.classList.contains('hidden')) {
                        loadAllOrders();
                    }
                });

                if (Notification.permission !== "denied") {
                    Notification.requestPermission();
                }
            }

            loadStats();
            loadVendors();
        }
    } catch (err) {
        console.error('CheckAdmin Error:', err);
        alert('خطأ في الاتصال بالسيرفر.');
    }
}

async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        const statRevenue = document.getElementById('statRevenue');
        const statOrders = document.getElementById('statOrders');
        const statVendors = document.getElementById('statVendors');
        const statCommission = document.getElementById('statCommission');

        if (statRevenue) statRevenue.innerText = data.totalRevenue.toLocaleString() + ' ج.م';
        if (statOrders) statOrders.innerText = data.totalOrders;
        if (statVendors) statVendors.innerText = data.totalVendors;
        if (statCommission) statCommission.innerText = data.commissionBalance.toLocaleString() + ' ج.م';
    } catch (err) { console.error(err); }
}

async function loadVendors() {
    try {
        const res = await fetch('/api/admin/vendors');
        const vendors = await res.json();
        const body = document.getElementById('vendorsTableBody');
        if (!body) return;
        body.innerHTML = vendors.map(v => `
            <tr class="border-b border-slate-50 hover:bg-slate-50 transition">
                <td class="py-4 px-4 font-600">${v.name}</td>
                <td class="py-4 px-4 text-slate-500">${v.shopName || 'N/A'}</td>
                <td class="py-4 px-4">
                    <span class="status-badge status-${v.status}">${v.status === 'active' ? 'مفعل' : v.status === 'pending' ? 'انتظار' : 'موقوف'}</span>
                </td>
                <td class="py-4 px-4 flex gap-2">
                    ${v.status === 'pending' ? `<button onclick="updateVendor('${v._id}', 'active')" class="text-sm bg-green-500 text-white px-3 py-1 rounded">تفعيل</button>` : ''}
                    ${v.status === 'active' ? `<button onclick="updateVendor('${v._id}', 'suspended')" class="text-sm bg-red-100 text-red-600 px-3 py-1 rounded">إيقاف</button>` : ''}
                    ${v.status === 'suspended' ? `<button onclick="updateVendor('${v._id}', 'active')" class="text-sm bg-blue-500 text-white px-3 py-1 rounded">إعادة تفعيل</button>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (err) { console.error(err); }
}

async function updateVendor(id, status) {
    if (!confirm('هل أنت متأكد من تغيير حالة هذا التاجر؟')) return;
    try {
        const res = await fetch(`/api/admin/vendors/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            loadVendors();
            loadStats();
        }
    } catch (err) { console.error(err); }
}

async function loadAllOrders() {
    try {
        const res = await fetch('/api/admin/orders');
        const orders = await res.json();
        const body = document.getElementById('ordersFullTableBody');
        if (!body) return;
        body.innerHTML = orders.map(o => {
            let shippingBtn = '';
            if (o.status === 'Pending') {
                shippingBtn = `
                    <div class="flex gap-1">
                        <button onclick="confirmOrder('${o._id}', 'Bosta')" class="bg-blue-600 text-white text-[10px] px-2 py-1 rounded hover:bg-blue-700">بوسطة</button>
                        <button onclick="confirmOrder('${o._id}', 'Aramex')" class="bg-red-600 text-white text-[10px] px-2 py-1 rounded hover:bg-red-700">أرامكس</button>
                    </div>
                `;
            } else if (o.status === 'Shipped') {
                shippingBtn = `
                    <div class="flex flex-col gap-1 items-start">
                        <span class="text-[10px] text-slate-400">رقم التتبع: ${o.trackingNumber}</span>
                        <a href="${o.shippingLabelUrl}" target="_blank" class="text-[10px] text-blue-500 underline">تحميل البوليصة 📄</a>
                    </div>
                `;
            }

            const statusOptions = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s =>
                `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`
            ).join('');

            const itemsList = o.items.map(i => `<div class="text-[10px] opacity-70">• ${i.name} (x${i.quantity})</div>`).join('');

            return `
            <tr class="border-b border-slate-50">
                <td class="py-4 px-4 font-mono text-xs">#${o._id.toString().slice(-6)}</td>
                <td class="py-4 px-4">
                    <div class="font-600">${o.user?.name || 'مجهول'}</div>
                    <div class="text-[10px] text-slate-400">${o.user?.email || ''}</div>
                </td>
                <td class="py-4 px-4 text-sm text-slate-400">
                    ${new Date(o.createdAt).toLocaleDateString('ar-EG')}
                    <div class="mt-1">${itemsList}</div>
                </td>
                <td class="py-4 px-4 font-700">${o.totalPrice} ج.م</td>
                <td class="py-4 px-4">
                    <select onchange="overrideOrderStatus('${o._id}', this.value)" class="text-[10px] border border-slate-200 rounded p-1">
                        ${statusOptions}
                    </select>
                </td>
                <td class="py-4 px-4">${shippingBtn}</td>
            </tr>
            `;
        }).join('');
    } catch (err) { console.error(err); }
}

async function overrideOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (res.ok) {
            alert('تم تحديث حالة الطلب من قبل الإدارة!');
            loadAllOrders();
            loadStats();
        } else {
            const err = await res.json();
            alert('خطأ: ' + err.error);
        }
    } catch (e) {
        alert('حدث خطأ في الاتصال بالخادم');
    }
}

async function confirmOrder(id, carrier) {
    if (!confirm(`هل أنت متأكد من تأكيد الطلب عبر شركة ${carrier}؟ سيتم إنشاء بوليصة شحن فوراً.`)) return;

    try {
        const res = await fetch(`/api/admin/orders/${id}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ carrier })
        });
        const data = await res.json();

        if (data.success) {
            alert('✅ تم تأكيد الطلب بنجاح! رقم التتبع: ' + data.trackingNumber);
            loadAllOrders();
            loadStats();
        } else {
            alert('❌ خطأ: ' + (data.error || 'فشل إنشاء الشحنة'));
        }
    } catch (err) {
        alert('حدث خطأ في الاتصال بالخادم');
    }
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const tab = document.getElementById(tabId);
    if (tab) tab.classList.remove('hidden');

    const titles = { overview: 'نظرة عامة على المنصة', vendors: 'إدارة التجار', orders: 'مراقبة الطلبات' };
    const tabTitle = document.getElementById('tabTitle');
    if (tabTitle) tabTitle.innerText = titles[tabId] || 'لوحة المدير العام';

    if (tabId === 'orders') loadAllOrders();
}

document.addEventListener('DOMContentLoaded', () => {
    checkAdmin();
});
