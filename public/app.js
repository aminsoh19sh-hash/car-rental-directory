const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ===== Splash =====
window.addEventListener('load', () => {
  setTimeout(() => {
    $('#splash')?.classList.add('out');
  }, 1200);
});

// ===== State =====
let currentResults = [];
let currentCity = 'casablanca';
let currentCityName = 'الدار البيضاء';

// ===== City Names =====
const cityNames = {
  casablanca: 'الدار البيضاء',
  rabat: 'الرباط',
  marrakech: 'مراكش',
  agadir: 'أكادير',
  tanger: 'طنجة',
  fes: 'فاس',
  meknes: 'مكناس',
  ouarzazate: 'ورزازات',
  essaouira: 'الصويرة',
  dakhla: 'الداخلة'
};

// ===== Elements =====
const homeEl = $('#home');
const resultsEl = $('#results');
const detailEl = $('#detail');

// ===== Search =====
$('#searchBtn').addEventListener('click', doSearch);

async function doSearch() {
  const city = $('#citySelect').value;
  const type = $('#typeSelect').value;
  const btn = $('#searchBtn');

  currentCity = city;
  currentCityName = cityNames[city] || city;

  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> جاري البحث...';

  try {
    const res = await fetch(`/api/search?city=${city}&type=${type}`);
    const data = await res.json();

    if (data.error) throw new Error(data.details || data.error);

    currentResults = data.agencies || [];
    renderResults(currentResults, city);

  } catch (error) {
    console.error(error);
    alert('فشل في جلب البيانات.\n\n' + (error.message || 'تحقق من اتصالك بالإنترنت.'));
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

// ===== Render Results =====
function renderResults(agencies, city) {
  $('#resultsTitle').textContent = `محلات تأجير السيارات — ${cityNames[city] || city}`;
  $('#resultsCount').textContent = `${agencies.length} محل`;

  const grid = $('#resultsGrid');

  if (!agencies.length) {
    grid.innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <h3>لا توجد نتائج</h3>
        <p>لم نجد محلات تأجير سيارات مسجلة في هذه المدينة بعد.<br>جرّب مدينة أخرى أو تحقق من اتصالك بالإنترنت.</p>
      </div>
    `;
  } else {
    grid.innerHTML = agencies.map(a => `
      <div class="agency-card" data-id="${a.id}">
        <div class="agency-head">
          <div>
            <div class="agency-name">${escapeHtml(a.name)}</div>
            <div class="agency-city">${cityNames[city] || city}</div>
          </div>
          <div class="agency-source">OSM</div>
        </div>
        <div class="agency-details">
          ${a.phone ? `
            <div class="agency-detail">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
              <span>${escapeHtml(a.phone)}</span>
            </div>
          ` : ''}
          ${a.address ? `
            <div class="agency-detail">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>${escapeHtml(a.address)}</span>
            </div>
          ` : ''}
          ${a.website ? `
            <div class="agency-detail">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
              </svg>
              <a href="${escapeHtml(a.website)}" target="_blank" rel="noopener">زيارة الموقع</a>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');

    $$('.agency-card').forEach(card => {
      card.addEventListener('click', () => {
        const agency = currentResults.find(a => String(a.id) === card.dataset.id);
        if (agency) showDetail(agency, cityNames[city] || city);
      });
    });
  }

  homeEl.classList.add('hidden');
  resultsEl.classList.remove('hidden');
  detailEl.classList.add('hidden');
  window.scrollTo(0, 0);
}

// ===== Show Detail =====
function showDetail(agency, cityName) {
  const content = $('#detailContent');

  content.innerHTML = `
    <div class="detail-card">
      <div class="detail-hero">
        <span class="eyebrow">CAR RENTAL AGENCY</span>
        <h2>${escapeHtml(agency.name)}</h2>
        <div class="city">${escapeHtml(cityName)} — المغرب</div>
      </div>
      <div class="detail-body">
        <div class="detail-grid">
          <div class="detail-item">
            <div class="label">الهاتف</div>
            <div class="value ${agency.phone ? '' : 'no-data'}">
              ${agency.phone ? escapeHtml(agency.phone) : 'غير متوفر في المصدر'}
            </div>
          </div>
          <div class="detail-item">
            <div class="label">البريد الإلكتروني</div>
            <div class="value ${agency.email ? '' : 'no-data'}">
              ${agency.email ? `<a href="mailto:${escapeHtml(agency.email)}">${escapeHtml(agency.email)}</a>` : 'غير متوفر في المصدر'}
            </div>
          </div>
          <div class="detail-item">
            <div class="label">الموقع الإلكتروني</div>
            <div class="value ${agency.website ? '' : 'no-data'}">
              ${agency.website ? `<a href="${escapeHtml(agency.website)}" target="_blank" rel="noopener">${escapeHtml(agency.website)}</a>` : 'غير متوفر في المصدر'}
            </div>
          </div>
          <div class="detail-item">
            <div class="label">العنوان</div>
            <div class="value ${agency.address ? '' : 'no-data'}">
              ${agency.address ? escapeHtml(agency.address) : 'غير متوفر'}
            </div>
          </div>
          <div class="detail-item">
            <div class="label">ساعات العمل</div>
            <div class="value ${agency.openingHours ? '' : 'no-data'}">
              ${agency.openingHours ? escapeHtml(agency.openingHours) : 'غير متوفر'}
            </div>
          </div>
          <div class="detail-item">
            <div class="label">المصدر</div>
            <div class="value">
              <a href="${escapeHtml(agency.sourceUrl)}" target="_blank" rel="noopener">OpenStreetMap</a>
            </div>
          </div>
        </div>

        <div class="detail-actions">
          ${agency.lat && agency.lon ? `
            <a href="https://www.google.com/maps/search/?api=1&query=${agency.lat},${agency.lon}"
               target="_blank" rel="noopener" class="btn-action primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              عرض على الخريطة
            </a>
          ` : ''}
          ${agency.phone ? `
            <a href="tel:${escapeHtml(agency.phone)}" class="btn-action">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
              اتصال
            </a>
            <a href="https://wa.me/${agency.phone.replace(/[^0-9]/g, '')}"
               target="_blank" rel="noopener" class="btn-action whatsapp">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              واتساب
            </a>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  resultsEl.classList.add('hidden');
  detailEl.classList.remove('hidden');
  window.scrollTo(0, 0);
}

// ===== Navigation =====
$('#backBtn').addEventListener('click', () => {
  resultsEl.classList.add('hidden');
  homeEl.classList.remove('hidden');
  window.scrollTo(0, 0);
});

$('#closeDetailBtn').addEventListener('click', () => {
  detailEl.classList.add('hidden');
  resultsEl.classList.remove('hidden');
  window.scrollTo(0, 0);
});

// ===== Escape HTML =====
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}