// --- Vendor Dashboard Specific Logic ---

function animateValue(id, start, end, duration, isCurrency = false) {
    const obj = document.getElementById(id);
    if (!obj) return;
    if (duration === 0) {
        obj.innerText = isCurrency ? end + ' ج.م' : end;
        return;
    }
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        obj.innerHTML = isCurrency ? current + ' <small style="font-size:0.8rem">ج.م</small>' : current;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
    obj.classList.add('animate-count');
    setTimeout(() => obj.classList.remove('animate-count'), 500);
}

async function checkAuth() {
    try {
        const res = await fetch('/auth/login/success');
        const data = await res.json();
        if (!data.success || (data.user.role !== 'vendor' && data.user.role !== 'admin' && data.user.role !== 'super-admin')) {
            window.location.href = '/';
        }
    } catch (e) { window.location.href = '/'; }
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

    const tab = document.getElementById('tab-' + tabId);
    if (tab) tab.classList.add('active');

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(tabId)) {
            item.classList.add('active');
        }
    });

    if (tabId === 'products') fetchVendorProducts();
    if (tabId === 'orders') fetchVendorOrders();
}

async function fetchVendorProducts() {
    try {
        const res = await fetch('/api/vendor/products');
        const products = await res.json();

        const totalProductsEl = document.getElementById('totalProducts');
        const oldTotal = totalProductsEl ? parseInt(totalProductsEl.innerText) || 0 : 0;
        animateValue('totalProducts', oldTotal, products.length, 1000);

        const banner = document.getElementById('welcomeBanner');
        if (banner) {
            if (products.length === 0) banner.classList.remove('hidden');
            else banner.classList.add('hidden');
        }

        const grid = document.getElementById('vendorProductsGrid');
        if (!grid) return;
        if (products.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; opacity:0.5; padding: 40px;">ليس لديك أي منتجات معروضة حالياً.</p>';
        } else {
            grid.innerHTML = products.map(p => `
                <div class="product-item">
                    <img src="${p.image}" alt="${p.name}">
                    <div style="font-weight: bold;">${p.name}</div>
                    <div style="color: var(--primary); font-weight: 800; margin: 5px 0;">${p.price} ج.م</div>
                    <div style="font-size: 0.8rem; opacity: 0.6;">المخزون: ${p.stockQuantity}</div>
                    <div class="action-btns">
                        <button class="btn-small btn-edit" onclick="editProduct('${p._id}')">تعديل</button>
                        <button class="btn-small btn-delete" onclick="deleteProduct('${p._id}')">مسح</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) { console.error(e); }
}

async function fetchVendorOrders() {
    try {
        const res = await fetch('/api/vendor/orders');
        const orders = await res.json();
        const container = document.getElementById('vendorOrdersContainer');

        const pendingOrdersEl = document.getElementById('pendingOrders');
        const oldPending = pendingOrdersEl ? parseInt(pendingOrdersEl.innerText) || 0 : 0;
        const newPending = orders.filter(o => o.status === 'Pending').length;
        animateValue('pendingOrders', oldPending, newPending, 1000);

        const totalSalesEl = document.getElementById('totalSales');
        const oldSalesText = totalSalesEl ? totalSalesEl.innerText.replace(/[^0-9]/g, '') : '0';
        const oldSales = parseInt(oldSalesText) || 0;
        const newSales = orders.reduce((sum, o) => sum + o.totalPrice, 0);
        animateValue('totalSales', oldSales, newSales, 1000, true);

        if (!container) return;
        if (orders.length === 0) {
            container.innerHTML = '<p style="text-align: center; opacity: 0.5; padding: 40px;">لا توجد طلبات واردة حالياً.</p>';
        } else {
            container.innerHTML = orders.map(o => `
                <div class="order-card" style="display: block;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <div style="font-weight:bold; font-size: 1.1rem;">طلب رقم: #${o._id.substring(18)}</div>
                            <div style="font-size:0.85rem; opacity:0.7; margin-top: 5px;">
                                تم الإنشاء في: ${new Date(o.createdAt).toLocaleString('ar-EG')} | الإجمالي: ${o.totalPrice} ج.م
                            </div>
                            <div style="font-size:0.85rem; color: var(--primary); margin-top: 5px;">
                                العنوان: ${o.shippingAddress?.details || 'غير محدد'}
                            </div>
                        </div>
                        <div class="status-badge ${getStatusClass(o.status)}">
                            ${getStatusText(o.status)}
                        </div>
                    </div>
                    
                    <div style="background: rgba(255,255,255,0.02); border-radius: 10px; padding: 10px; margin-bottom: 15px;">
                        <div style="font-size: 0.8rem; opacity: 0.6; margin-bottom: 5px;">المنتجات المطلوبة:</div>
                        ${o.items.map(item => `
                            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; padding: 5px 0;">
                                <span>• ${item.name} (x${item.quantity})</span>
                                <span style="color: var(--primary);">${item.priceAtPurchase} ج.م</span>
                            </div>
                        `).join('')}
                    </div>

                    <div style="display: flex; gap: 10px; align-items: center; border-top: 1px solid var(--glass-border); margin-top: 10px; padding-top: 15px;">
                        <div style="flex: 1;">
                            <label style="font-size: 0.75rem; color: #94a3b8; display: block; margin-bottom: 5px;">تغيير حالة الطلب:</label>
                            <select onchange="updateOrderStatus('${o._id}', this.value)" style="padding: 5px 10px; font-size: 0.85rem; height: auto;">
                                <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>بانتظار الشحن (Pending)</option>
                                <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>تم التأكيد (Confirmed)</option>
                                <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>قيد الشحن (Shipped)</option>
                                <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>تم التسليم (Delivered)</option>
                                <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>ملغي (Cancelled)</option>
                            </select>
                        </div>
                        <button class="btn-small btn-edit" style="width:auto; padding:8px 20px; height: 38px; margin-top: 20px;" onclick="window.location.href='/order-details.html?id=${o._id}'">التفاصيل الكاملة</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) { console.error(e); }
}

function getStatusClass(status) {
    switch (status) {
        case 'Pending': return 'status-pending';
        case 'Confirmed':
        case 'Shipped':
        case 'Delivered': return 'status-shipped';
        default: return '';
    }
}

function getStatusText(status) {
    const texts = {
        'Pending': 'بانتظار الشحن',
        'Confirmed': 'تم التأكيد',
        'Shipped': 'قيد الشحن',
        'Delivered': 'تم التسليم',
        'Cancelled': 'ملغي'
    };
    return texts[status] || status;
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch(`/api/vendor/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (res.ok) {
            alert('تم تحديث حالة الطلب بنجاح!');
            fetchVendorOrders();
        } else {
            const err = await res.json();
            alert('خطأ: ' + err.error);
        }
    } catch (e) {
        alert('حدث خطأ في الاتصال بالخادم');
    }
}

function openPreview() {
    const name = document.getElementById('name').value;
    const brand = document.getElementById('brand').value;
    const price = document.getElementById('price').value;
    const image = document.getElementById('image').value;
    const condition = document.getElementById('condition').value;
    const compatibilityInput = document.getElementById('compatibilityInput').value;

    document.getElementById('previewName').innerText = name || 'اسم المنتج سيظهر هنا';
    document.getElementById('previewBrand').innerText = brand || 'الماركة التجارية';
    document.getElementById('previewPrice').innerText = (price || '0') + ' ج.م';
    document.getElementById('previewImage').src = image || 'https://via.placeholder.com/400x400?text=منتجك+هنا';
    document.getElementById('previewBadge').innerText = condition;
    document.getElementById('previewComp').innerText = compatibilityInput || 'بيانات التوافق مع السيارات ستظهر هنا';

    document.getElementById('previewModal').style.display = 'flex';
}

function closePreview() {
    document.getElementById('previewModal').style.display = 'none';
}

async function editProduct(id) {
    const res = await fetch('/api/vendor/products');
    const products = await res.json();
    const p = products.find(x => x._id === id);
    if (!p) return;

    showTab('add');
    document.getElementById('editingId').value = p._id;
    document.getElementById('formTitle').innerText = 'تعديل المنتج: ' + p.name;
    document.getElementById('submitBtn').innerText = 'حفظ التعديلات';
    document.getElementById('cancelBtn').style.display = 'block';

    document.getElementById('name').value = p.name;
    document.getElementById('brand').value = p.brand;
    document.getElementById('price').value = p.price;
    document.getElementById('image').value = p.image;
    document.getElementById('stockQuantity').value = p.stockQuantity || 0;
    document.getElementById('category').value = p.category;
    document.getElementById('condition').value = p.condition;
    document.getElementById('tags').value = (p.tags || []).join(', ');

    if (p.compatibility) {
        document.getElementById('compatibilityInput').value = p.compatibility
            .map(c => `${c.brand} ${c.model} ${c.yearStart}-${c.yearEnd}`)
            .join(' | ');
    }
}

async function deleteProduct(id) {
    if (!confirm('هل أنت متأكد من مسح المنتج؟')) return;
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) fetchVendorProducts();
    else alert('فشل المسح: قد لا تملك الصلاحية.');
}

function resetForm() {
    const form = document.getElementById('addProductForm');
    if (form) form.reset();
    document.getElementById('editingId').value = '';
    document.getElementById('formTitle').innerText = 'إضافة منتج جديد للبيع';
    document.getElementById('submitBtn').innerText = 'نشر المنتج على المنصة';
    document.getElementById('cancelBtn').style.display = 'none';
}

const addProductForm = document.getElementById('addProductForm');
if (addProductForm) {
    addProductForm.onsubmit = async (e) => {
        e.preventDefault();
        const editingIdVal = document.getElementById('editingId').value;
        const compText = document.getElementById('compatibilityInput').value;

        const compatibility = compText.split('|').map(item => {
            const parts = item.trim().split(' ');
            if (parts.length < 3) return null;
            const years = parts[parts.length - 1].split('-');
            return {
                brand: parts[0],
                model: parts.slice(1, -1).join(' '),
                yearStart: parseInt(years[0]),
                yearEnd: parseInt(years[1])
            };
        }).filter(i => i !== null);

        const data = {
            name: document.getElementById('name').value,
            brand: document.getElementById('brand').value,
            price: document.getElementById('price').value,
            image: document.getElementById('image').value,
            stockQuantity: document.getElementById('stockQuantity').value,
            category: document.getElementById('category').value,
            condition: document.getElementById('condition').value,
            tags: document.getElementById('tags').value.split(',').map(s => s.trim()),
            compatibility: compatibility
        };

        const url = editingIdVal ? `/api/products/${editingIdVal}` : '/api/products';
        const method = editingIdVal ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert('تم الحفظ بنجاح!');
            resetForm();
            showTab('products');
        } else {
            const err = await res.json();
            alert('خطأ: ' + err.error);
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    fetchVendorProducts();
    fetchVendorOrders();
});
