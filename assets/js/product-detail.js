// --- Product Detail Page Specific Logic ---

const urlParams = new URLSearchParams(window.location.search);
const partName = urlParams.get('part') || "منتج عام";
const imgUrl = urlParams.get('img') || "https://via.placeholder.com/500?text=AutoPart";
const partPrice = urlParams.get('price') || "450";
const partVendor = urlParams.get('vendor') || "متركنهاش";
const partCondition = urlParams.get('condition') || "جديد";
const partWarranty = urlParams.get('warranty') || "لا يوجد";

function initProductDetails() {
    const pName = document.getElementById('pName');
    const pImg = document.getElementById('pImg');
    const pPrice = document.getElementById('pPrice');

    if (pName) pName.innerText = partName;
    if (pImg) pImg.src = imgUrl;
    if (pPrice) pPrice.innerText = `${partPrice} ج.م`;

    fetchOtherSellers();
    checkGarageCompatibility();
}

async function fetchOtherSellers() {
    try {
        const res = await fetch('/api/products');
        const products = await res.json();

        const sellers = products.slice(0, 3).map(p => ({
            sellerName: p.vendorName || "تاجر معتمد",
            isTrusted: true,
            rating: (4 + Math.random()).toFixed(1),
            price: p.price,
            location: "القاهرة",
            shipping: "مجاني",
            warranty: p.warranty || "لا يوجد"
        }));

        const sellersContainer = document.getElementById('sellersContainer');
        const compareTitle = document.getElementById('compareTitle');
        const pVenderCount = document.getElementById('pVenderCount');

        if (sellersContainer) {
            if (sellers.length > 0) {
                if (compareTitle) compareTitle.innerText = `قارن عروض التجار (${sellers.length})`;
                if (pVenderCount) pVenderCount.innerText = `${sellers.length} تجار متاحين`;

                sellersContainer.innerHTML = sellers.map(s => `
                    <div class="merchant-card">
                        <div class="merchant-header">
                            <div>
                                <div class="merchant-name">
                                    ${s.sellerName} 
                                    ${s.isTrusted ? '<span class="trusted-badge-v2">موثوق <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline; margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg></span>' : ''}
                                </div>
                                <div class="merchant-rating-v2" style="display:flex; align-items:center; gap:4px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#d97706" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                    ${s.rating} <span style="color:#64748b; font-size:0.8rem;">(متوفر)</span>
                                </div>
                            </div>
                            <div class="merchant-price">${s.price.toLocaleString()} ج.م</div>
                        </div>
                        
                        <div class="merchant-meta-grid">
                            <div class="meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline; margin-left:5px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> الموقع: <b>${s.location}</b></div>
                            <div class="meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline; margin-left:5px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> الحالة: <b>جديد</b></div>
                            <div class="meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline; margin-left:5px;"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg> الشحن: <b>${s.shipping}</b></div>
                            <div class="meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline; margin-left:5px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> الضمان: <b>${s.warranty}</b></div>
                        </div>

                        <div class="merchant-footer">
                            <div class="merchant-btns">
                                <button class="buy-now-btn btn-animated" onclick="addToCartBySeller(this, '${s.sellerName}', null, null, ${s.price})">
                                    <span class="btn-text">شراء الآن</span>
                                    <div class="lottie-container"></div>
                                </button>
                                <a href="https://wa.me/201016487547?text=استفسار عن ${encodeURIComponent(partName)} من تاجر ${encodeURIComponent(s.sellerName)}" 
                                   target="_blank" class="whatsapp-btn-v2">
                                    واتساب مباشر
                                </a>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                sellersContainer.innerHTML = '<div class="text-center py-10">عذراً، لا يوجد تجار متاحين لهذه القطعة حالياً.</div>';
            }
        }
    } catch (err) {
        console.error('Failed to load other sellers:', err);
        const sellersContainer = document.getElementById('sellersContainer');
        if (sellersContainer) sellersContainer.innerHTML = '<div class="text-center py-10 opacity-50">تعذر جلب عروض التجار حالياً.</div>';
    }
}

async function checkFitAI() {
    const userTextEl = document.getElementById('userVehicleText');
    const resultBox = document.getElementById('fitResult');
    const productId = urlParams.get('id');

    if (!userTextEl || !userTextEl.value) { alert("من فضلك اكتب بيانات عربيتك الأول!"); return; }
    const userText = userTextEl.value;

    resultBox.style.display = 'block';
    resultBox.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; padding:10px;">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
            <span style="color:#6366f1; font-weight:600;">جاري تحليل البيانات...</span>
        </div>
    `;
    resultBox.className = "fit-result";
    resultBox.style.opacity = '1';

    try {
        const res = await fetch('/api/check-fitment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: productId, userText: userText })
        });

        const data = await res.json();
        const text = data.reason || data.error || 'عذراً، حدث خطأ ما';

        if (data.status === 'success') {
            resultBox.className = "fit-result fit-success";
        } else if (data.status === 'warning') {
            resultBox.className = "fit-result";
            resultBox.style.background = "rgba(255, 251, 235, 0.9)";
            resultBox.style.color = "#92400e";
            resultBox.style.border = "1.5px solid #fde68a";
        } else {
            resultBox.className = "fit-result fit-error";
        }

        resultBox.innerHTML = '';
        let i = 0;
        resultBox.style.minHeight = '60px';

        function typeWriter() {
            if (i < text.length) {
                resultBox.innerHTML += text.charAt(i);
                i++;
                setTimeout(typeWriter, 30);
            }
        }
        typeWriter();

    } catch (err) {
        console.error('Fitment API Error:', err);
        resultBox.innerHTML = 'حدث خطأ في معالجة طلب التوافق التقني. يرجى المحاولة لاحقاً.';
    }
}

function openChat() {
    const chatWidget = document.getElementById('chatWidget');
    if (chatWidget) chatWidget.style.display = 'flex';
}

function sendToWhatsApp() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !chatInput.value) return;
    const msg = chatInput.value;
    const phone = "201102233317";
    const text = `استفسار بخصوص منتج: (${partName}).\n نص الرسالة: ${msg} `;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
}

async function checkGarageCompatibility() {
    const badge = document.getElementById('garageBadge');
    const statusText = document.getElementById('garageStatus');
    const carNameText = document.getElementById('garageCarName');
    const icon = document.getElementById('garageIcon');

    try {
        const res = await fetch('/api/user/garage');
        const garage = await res.json();
        const primaryCar = garage.find(c => c.isPrimary);

        if (!primaryCar || !badge) {
            if (badge) badge.style.display = 'none';
            return;
        }

        badge.style.display = 'flex';
        if (carNameText) carNameText.innerText = `${primaryCar.make} ${primaryCar.model} (${primaryCar.year})`;

        const fitRes = await fetch('/api/check-fitment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: urlParams.get('id'),
                userText: `عربيتي ${primaryCar.make} ${primaryCar.model} موديل ${primaryCar.year} موتور ${primaryCar.engine}. هل القطعة دي بتركب عليها؟`
            })
        });

        const data = await fitRes.json();

        if (data.status === 'success') {
            badge.classList.add('compatible');
            if (statusText) {
                statusText.innerText = 'القطعة متوافقة مع سيارتك';
                statusText.style.color = '#065f46';
            }
            if (icon) icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#065f46" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        } else if (data.status === 'error') {
            badge.classList.add('not-compatible');
            if (statusText) {
                statusText.innerText = 'القطعة قد لا تكون متوافقة';
                statusText.style.color = '#991b1b';
            }
            if (icon) icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#991b1b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        } else {
            if (statusText) statusText.innerText = 'تأكد من التوافق الفني قبل الشراء';
        }
    } catch (err) {
        console.error('Garage Check Error:', err);
    }
}

let isProcessingAdd = false;

async function addToCartBySeller(btn, sellerName, customId = null, customName = null, customPrice = null, customImg = null) {
    if (isProcessingAdd) return;
    isProcessingAdd = true;

    const productId = customId || urlParams.get('id');
    const name = customName || document.getElementById('pName').innerText;
    const priceText = document.getElementById('pPrice') ? document.getElementById('pPrice').innerText : '0';
    const price = customPrice || parseInt(priceText.replace(/[^\d]/g, ''));
    const image = customImg || (document.getElementById('pImg') ? document.getElementById('pImg').src : 'https://via.placeholder.com/80');

    if (!productId || productId === 'null') {
        alert('⚠️ عذراً، لم نتمكن من تحديد رقم المنتج.');
        isProcessingAdd = false;
        return;
    }

    const overlay = document.getElementById('truckOverlay');
    const truckAnimBox = document.getElementById('truckAnimation');
    const statusText = document.getElementById('truckStatusText');

    if (overlay && truckAnimBox && statusText) {
        overlay.style.display = 'flex';
        statusText.innerText = `جاري معالجة طلب [${sellerName}]...`;
        truckAnimBox.innerHTML = '';
        const anim = lottie.loadAnimation({
            container: truckAnimBox,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: 'https://assets1.lottiefiles.com/packages/lf20_jpxsS6.json'
        });

        setTimeout(() => {
            let cart = JSON.parse(localStorage.getItem('cart') || '[]');
            cart.push({
                productId: productId,
                _id: productId,
                name: name,
                price: price,
                image: image,
                seller: sellerName || 'متركنهاش',
                quantity: 1
            });
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartBadge();

            statusText.innerText = 'تمت الإضافة للسلة';
            statusText.style.color = '#10b981';

            setTimeout(() => {
                overlay.style.display = 'none';
                anim.destroy();
                isProcessingAdd = false;
                statusText.style.color = 'white';
            }, 1200);
        }, 2200);
    } else {
        // Fallback
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        cart.push({ productId, _id: productId, name, price, image, seller: sellerName || 'متركنهاش', quantity: 1 });
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartBadge();
        isProcessingAdd = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initProductDetails();
    updateCartBadge();
    checkLoginStatus(); // From common.js
});
