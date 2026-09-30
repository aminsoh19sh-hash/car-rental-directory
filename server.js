const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// دعم fetch لـ Node < 18
let fetchFn;
try {
  fetchFn = fetch;
} catch (e) {
  fetchFn = require('node-fetch');
}

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_PATH = path.join(__dirname, 'data', 'cache.json');

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// ===== قاعدة البيانات المؤقتة =====
function readCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) {
      fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
      fs.writeFileSync(CACHE_PATH, JSON.stringify({ agencies: {}, lastUpdate: null }, null, 2));
    }
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  } catch (e) {
    return { agencies: {}, lastUpdate: null };
  }
}

function writeCache(data) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2));
}

// ===== مدن المغرب =====
const CITIES = {
  casablanca: { lat: 33.5731, lon: -7.5898, radius: 25000, name: 'الدار البيضاء' },
  rabat: { lat: 34.0209, lon: -6.8416, radius: 20000, name: 'الرباط' },
  marrakech: { lat: 31.6295, lon: -7.9811, radius: 25000, name: 'مراكش' },
  agadir: { lat: 30.4278, lon: -9.5981, radius: 20000, name: 'أكادير' },
  tanger: { lat: 35.7595, lon: -5.8340, radius: 20000, name: 'طنجة' },
  fes: { lat: 34.0331, lon: -5.0003, radius: 20000, name: 'فاس' },
  meknes: { lat: 33.8935, lon: -5.5473, radius: 15000, name: 'مكناس' },
  ouarzazate: { lat: 30.9189, lon: -6.8934, radius: 15000, name: 'ورزازات' },
  essaouira: { lat: 31.5085, lon: -9.7595, radius: 15000, name: 'الصويرة' },
  dakhla: { lat: 23.6848, lon: -15.9580, radius: 15000, name: 'الداخلة' }
};

// ===== خوادم Overpass الاحتياطية =====
const OVERPASS_SERVERS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter'
];

// ===== جلب من Overpass =====
async function fetchFromOverpass(cityKey) {
  const loc = CITIES[cityKey] || CITIES.casablanca;

  const query = `
    [out:json][timeout:30];
    (
      node["amenity"="car_rental"](around:${loc.radius},${loc.lat},${loc.lon});
      way["amenity"="car_rental"](around:${loc.radius},${loc.lat},${loc.lon});
      relation["amenity"="car_rental"](around:${loc.radius},${loc.lat},${loc.lon});
    );
    out center tags;
  `;

  let lastError = null;

  for (const server of OVERPASS_SERVERS) {
    try {
      console.log(`🌐 Trying ${server}...`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 40000);

      const response = await fetchFn(server, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'CarRentalDirectory/1.0'
        },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      console.log(`✅ ${server}: ${data.elements?.length || 0} results`);

      return (data.elements || []).map(el => {
        const tags = el.tags || {};
        return {
          id: el.id,
          name: tags.name || tags['name:ar'] || tags['name:fr'] || tags['name:en'] || 'محل تأجير سيارات',
          phone: tags.phone || tags['contact:phone'] || null,
          email: tags.email || tags['contact:email'] || null,
          website: tags.website || tags['contact:website'] || null,
          address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'] || loc.name].filter(Boolean).join('، '),
          city: tags['addr:city'] || loc.name,
          lat: el.lat || el.center?.lat,
          lon: el.lon || el.center?.lon,
          openingHours: tags.opening_hours || null,
          operator: tags.operator || null,
          brand: tags.brand || null,
          source: 'OpenStreetMap',
          sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`
        };
      });

    } catch (error) {
      console.log(`❌ ${server} failed: ${error.message}`);
      lastError = error;
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Fallback: بيانات محلية
  try {
    const fallbackPath = path.join(__dirname, 'data', 'fallback.json');
    if (fs.existsSync(fallbackPath)) {
      const fallback = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
      if (fallback[cityKey] && fallback[cityKey].length) {
        console.log(`📁 Using fallback data for ${cityKey}`);
        return fallback[cityKey];
      }
    }
  } catch (e) {
    console.error('Fallback error:', e.message);
  }

  throw new Error(`All sources failed: ${lastError?.message || 'unknown'}`);
}

// ===== API: البحث =====
app.get('/api/search', async (req, res) => {
  try {
    const city = req.query.city || 'casablanca';
    console.log(`\n🔍 Search: ${city}`);

    const cache = readCache();

    if (cache.agencies[city] && cache.lastUpdate &&
        (Date.now() - new Date(cache.lastUpdate).getTime()) < 86400000) {
      console.log(`📦 Cache: ${cache.agencies[city].length} agencies`);
      return res.json({
        agencies: cache.agencies[city],
        cached: true,
        count: cache.agencies[city].length
      });
    }

    const agencies = await fetchFromOverpass(city);
    cache.agencies[city] = agencies;
    cache.lastUpdate = new Date().toISOString();
    writeCache(cache);

    res.json({ agencies, cached: false, count: agencies.length });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      error: 'فشل في جلب البيانات',
      details: error.message
    });
  }
});

// ===== API: الإحصائيات =====
app.get('/api/stats', (req, res) => {
  const cache = readCache();
  const all = Object.values(cache.agencies).flat();
  res.json({
    totalAgencies: all.length,
    cities: Object.keys(cache.agencies).length,
    lastUpdate: cache.lastUpdate
  });
});

// ===== SPA fallback =====
app.get('*', (req, res, next) => {
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('   🚗 CAR RENTAL DIRECTORY');
  console.log('========================================');
  console.log(`   URL: http://localhost:${PORT}`);
  console.log('========================================');
  console.log('');
});