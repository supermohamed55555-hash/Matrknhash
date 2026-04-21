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
                    <div class="card p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-900 flex items-center gap-2">
                                    ${s.sellerName}
                                    ${s.isTrusted ? '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase">موثوق</span>' : ''}
                                </h4>
                                <div class="flex items-center gap-1 text-amber-500 text-xs font-bold">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                    ${s.rating}
                                    <span class="text-slate-400 mr-2 font-normal">| ${s.location}</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-1">
                            <div class="text-2xl font-black text-slate-900">${s.price.toLocaleString()} ج.م</div>
                            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">توصيل: ${s.shipping}</div>
                        </div>
                        <div class="flex gap-2 w-full md:w-auto">
                            <button class="btn btn-primary px-8" onclick="addToCartBySeller(this, '${s.sellerName}', null, null, ${s.price})">شراء الآن</button>
                            <a href="https://wa.me/201016487547" target="_blank" class="btn btn-outline p-3">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            </a>
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

    if (!userTextEl || !userTextEl.value) { alert("يرجى تزويدنا ببيانات المركبة لإتمام عملية الفحص."); return; }
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
