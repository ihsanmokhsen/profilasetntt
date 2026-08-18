/* ============================================================
   Profil Aset NTT
   Peta Pemanfaat Aset Pihak Ketiga
   Provinsi Nusa Tenggara Timur
   ============================================================ */

(function () {

  // ── Splash Screen ──────────────────────────────────────────
  var splash = document.getElementById('splash');
  if (splash) {
    splash.addEventListener('click', function () {
      splash.classList.add('hide');
      // Hapus dari DOM setelah animasi
      setTimeout(function () {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 500);
    });
  }


  'use strict';

  // ── Data Aset (dari data.js) ──────────────────────────────
  var assets = window.SIMANTAB_ASSETS;

  // ── Nomor WhatsApp default (untuk semua aset, kecuali yang punya kontak person sendiri) ──
  var DEFAULT_WA = '0812-3973-6814';

  // ── Inisialisasi Peta ─────────────────────────────────────
  var mapEl = document.getElementById('map');
  if (!mapEl) {
    console.error('SIMANTAB: Elemen #map tidak ditemukan!');
    return;
  }

  var map = L.map('map', { zoomControl: true }).setView([-10.163, 123.595], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // ── Drawing Tool (Kotak Area) ──────────────────────────────
  var drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  var drawControl = new L.Control.Draw({
    draw: {
      polyline: false,
      circle: false,
      circlemarker: false,
      marker: false,
      polygon: {
        allowIntersection: false,
        showArea: true,
        shapeOptions: {
          color: '#263567',
          weight: 2,
          fillColor: '#2988e8',
          fillOpacity: 0.15
        },
        metric: ['km²', 'ha'],
        title: 'Gambar area poligon'
      },
      rectangle: {
        shapeOptions: {
          color: '#263567',
          weight: 2,
          fillColor: '#2988e8',
          fillOpacity: 0.15
        },
        metric: ['km²', 'ha'],
        title: 'Gambar area kotak'
      }
    },
    edit: {
      featureGroup: drawnItems,
      edit: false,
      remove: false
    }
  });
  map.addControl(drawControl);

  // Badge info area (muncul setelah gambar)
  var areaBadge = document.createElement('div');
  areaBadge.className = 'area-badge';
  areaBadge.innerHTML = '<span id="areaCount"></span><button id="clearArea">✕ Hapus</button>';
  document.querySelector('.map-wrap').appendChild(areaBadge);

  // ── Variabel untuk menyimpan rectangle / polygon yang sedang aktif
  var currentArea = null;

  // Variabel untuk menyimpan marker yang sedang dipilih
  var selectedMarkerId = null;

  // Fungsi pilih marker dengan animasi
  function selectMarker(id) {
    // Hapus animasi dari marker sebelumnya
    if (selectedMarkerId && markers[selectedMarkerId]) {
      var prevEl = markers[selectedMarkerId].getElement();
      if (prevEl) prevEl.classList.remove('selected-marker');
    }
    // Tambah animasi ke marker baru
    if (id && markers[id]) {
      var el = markers[id].getElement();
      if (el) el.classList.add('selected-marker');
      selectedMarkerId = id;
    }
  }

  // Hapus animasi marker saat klik area kosong di peta
  map.on('click', function (e) {
    if (!e.originalEvent.target.closest('.leaflet-marker-icon') &&
        !e.originalEvent.target.closest('.leaflet-popup')) {
      selectMarker(null);
    }
  });

  // Fungsi hapus area
  function clearDrawnArea() {
    if (currentArea) {
      drawnItems.removeLayer(currentArea);
      currentArea = null;
    }
    areaBadge.style.display = 'none';
  }

  // Event: saat user selesai menggambar
  map.on(L.Draw.Event.CREATED, function (e) {
    // Hapus area sebelumnya
    clearDrawnArea();

    currentArea = e.layer;
    drawnItems.addLayer(currentArea);

    // Ambil koordinat poligon
    var coords = [];
    var latlngs = e.layer.getLatLngs();
    function flatten(lls) {
      lls.forEach(function (ll) {
        if (Array.isArray(ll) && typeof ll[0] === 'number') {
          coords.push([ll[0], ll[1]]);
        } else if (ll.lat !== undefined) {
          coords.push([ll.lat, ll.lng]);
        } else {
          flatten(ll);
        }
      });
    }
    flatten(latlngs);
    updateCoordPanel(coords);

    // Filter aset yang berada di dalam area
    var bounds = currentArea.getBounds();
    var inside = assets.filter(function (a) {
      return bounds.contains(L.latLng(a.lat, a.lng));
    });

    // Prepend marked areas
    var marked = (window.SIMANTAB_MARKED_AREAS || []).map(function (area) {
      return Object.assign({}, area, { _isMarkedArea: true });
    });
    renderList(marked.concat(inside));
    areaBadge.style.display = 'flex';
    document.getElementById('areaCount').textContent =
      inside.length + ' aset dalam area';

    // Reset filter
    document.getElementById('kabupaten').value = '';
    document.getElementById('nama').value = '';
    document.getElementById('opd').value = '';
  });

  // Tombol hapus area
  document.getElementById('clearArea').addEventListener('click', function () {
    clearDrawnArea();
    var marked = (window.SIMANTAB_MARKED_AREAS || []).map(function (area) {
      return Object.assign({}, area, { _isMarkedArea: true });
    });
    renderList(marked.concat(assets));
    clearCoordPanel();
  });

  // ── Panel Koordinat (Capture & Paste) ──────────────────────
  var coordPanel = document.createElement('div');
  coordPanel.className = 'coord-panel';
  coordPanel.style.display = 'none';
  coordPanel.innerHTML =
    '<div class="coord-header">' +
      '<strong>📍 Koordinat Poligon</strong>' +
      '<button id="closeCoord" title="Tutup">✕</button>' +
    '</div>' +
    '<textarea id="coordOutput" rows="6" readonly placeholder="Koordinat akan muncul di sini..." style="width:100%;font-size:11px;font-family:monospace;resize:vertical;"></textarea>' +
    '<div style="display:flex;gap:4px;margin-top:4px;">' +
      '<button id="copyCoord" style="flex:1;padding:4px 8px;font-size:11px;cursor:pointer;background:#2988e8;color:#fff;border:none;border-radius:4px;">📋 Copy</button>' +
      '<button id="exportCoord" style="flex:1;padding:4px 8px;font-size:11px;cursor:pointer;background:#34a853;color:#fff;border:none;border-radius:4px;">📤 JS Format</button>' +
    '</div>' +
    '<div style="margin-top:8px;border-top:1px solid #ddd;padding-top:6px;">' +
      '<small style="color:#666;">Atau paste koordinat (lat, lng per baris):</small>' +
      '<div style="display:flex;gap:4px;margin-top:3px;">' +
        '<input id="pasteCoord" type="text" placeholder="cth: -10.150, 123.616" style="flex:1;font-size:11px;padding:3px 6px;border:1px solid #ccc;border-radius:3px;">' +
        '<button id="btnPasteCoord" style="padding:3px 10px;font-size:11px;cursor:pointer;background:#2988e8;color:#fff;border:none;border-radius:3px;">Tampil</button>' +
      '</div>' +
    '</div>';
  document.querySelector('.map-wrap').appendChild(coordPanel);

  function updateCoordPanel(coords) {
    coordPanel.style.display = 'block';
    var text = coords.map(function (c) {
      return '[' + c[0].toFixed(6) + ', ' + c[1].toFixed(6) + ']';
    }).join(',\n');
    document.getElementById('coordOutput').value = '[\n' + text + '\n]';
  }

  function clearCoordPanel() {
    coordPanel.style.display = 'none';
    document.getElementById('coordOutput').value = '';
    document.getElementById('pasteCoord').value = '';
    if (pastePolygon) { map.removeLayer(pastePolygon); pastePolygon = null; }
  }

  document.getElementById('closeCoord').addEventListener('click', clearCoordPanel);

  document.getElementById('copyCoord').addEventListener('click', function () {
    var txt = document.getElementById('coordOutput').value;
    navigator.clipboard.writeText(txt).then(function () {
      alert('Koordinat disalin!');
    }).catch(function () {
      document.getElementById('coordOutput').select();
      document.execCommand('copy');
    });
  });

  document.getElementById('exportCoord').addEventListener('click', function () {
    var txt = document.getElementById('coordOutput').value;
    var jsFormat = 'polygon: ' + txt.replace(/\n/g, '\n      ');
    navigator.clipboard.writeText(jsFormat).then(function () {
      alert('Format JS disalin!');
    }).catch(function () {
      var ta = document.createElement('textarea');
      ta.value = jsFormat;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  });

  var pastePolygon = null;
  document.getElementById('btnPasteCoord').addEventListener('click', function () {
    var raw = document.getElementById('pasteCoord').value.trim();
    if (!raw) return;
    if (pastePolygon) { map.removeLayer(pastePolygon); pastePolygon = null; }
    var coords = [];
    var lines = raw.split(/\n/);
    lines.forEach(function (line) {
      line = line.replace(/[\[\]]/g, '').trim();
      if (!line) return;
      var parts = line.split(/[\s,]+/);
      if (parts.length >= 2) {
        var lat = parseFloat(parts[0]);
        var lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) coords.push([lat, lng]);
      }
    });
    if (coords.length >= 3) {
      pastePolygon = L.polygon(coords, {
        color: '#2988e8',
        weight: 3,
        fillColor: '#d6e8fc',
        fillOpacity: 0.25,
        dashArray: '8 4'
      }).addTo(map);
      map.fitBounds(pastePolygon.getBounds().pad(0.3));
      updateCoordPanel(coords);
    } else {
      alert('Butuh minimal 3 titik koordinat! Format: lat, lng per baris.');
    }
  });

  document.getElementById('pasteCoord').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('btnPasteCoord').click();
  });

  // ── Icon Marker Kustom ────────────────────────────────────
  var markers = {};
  var markersByFilter = {
    dimanfaatkan: [],
    'belum-dimanfaatkan': [],
    sewa: [],
    prioritas: []
  };

  function filterForAsset(asset) {
    if (asset.statusClass === 'belum-dimanfaatkan') return 'belum-dimanfaatkan';
    if (asset.statusClass === 'sewa') return 'sewa';
    return 'dimanfaatkan';
  }

  var blueIcon = L.divIcon({
    className: '',
    html: '<div style="width:22px;height:22px;background:#2988e8;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 1px 4px #555"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -22]
  });

  var greenIcon = L.divIcon({
    className: '',
    html: '<div style="width:22px;height:22px;background:#34a853;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 1px 4px #555"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -22]
  });

  var orangeIcon = L.divIcon({
    className: '',
    html: '<div style="width:22px;height:22px;background:#ff9800;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 1px 4px #555"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -22]
  });

  // ── Tambah Marker ke Peta ─────────────────────────────────
  function addMarkers() {
    assets.forEach(function (a) {
      var icon = a.statusClass === 'belum-dimanfaatkan' ? greenIcon : (a.statusClass === 'sewa' ? orangeIcon : blueIcon);

      // Poligon area aset (jika ada) — digambar sebelum marker agar berada di bawah
      if (a.polygon && a.polygon.length) {
        var polyColor = a.statusClass === 'belum-dimanfaatkan' ? '#34a853' : (a.statusClass === 'sewa' ? '#ff9800' : '#2988e8');
        L.polygon(a.polygon, {
          color: polyColor,
          weight: 3,
          fillColor: polyColor,
          fillOpacity: 0.18,
          dashArray: null
        }).addTo(map);
      }

      var marker = L.marker([a.lat, a.lng], { icon: icon }).addTo(map);

      // Label permanen di atas marker untuk aset yang punya area (poligon)
      if (a.polygon && a.polygon.length) {
        marker.bindTooltip(a.pemanfaat + ' (' + a.luas + ')', {
          permanent: true,
          direction: 'top',
          offset: [0, -28],
          className: 'sewa-label'
        });
      }

      var waText = encodeURIComponent(
        'Halo, saya ingin menanyakan informasi mengenai aset:\n\n' +
        'Pemanfaat : ' + a.pemanfaat + '\n' +
        'Lokasi : ' + a.lokasi + '\n' +
        'Kabupaten/Kota : ' + a.kabupaten + '\n' +
        'Status Pemanfaatan : ' + a.statusPemanfaatan
      );

      // Nomor kontak person (jika ada) → konversi ke format internasional untuk wa.me
      // Default: semua aset pakai nomor 0812-3973-6814, kecuali yang punya kontak sendiri (mis. Ruko Friendship → Ibu Kefi)
      var waNumber = (a.telp || DEFAULT_WA).replace(/[^0-9]/g, '').replace(/^0/, '62');
      var waHref = 'https://wa.me/' + waNumber + '?text=' + waText;

      function row(label, val) {
        var display = val || '—';
        return '<tr><td>' + label + '</td><td>: ' + display + '</td></tr>';
      }

      // Bangun baris detail aset (kondisi & tersedia pakai badge jika nilai standar)
      var kondisiHtml = a.kondisi
        ? (function () {
            var k = a.kondisi.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');
            var known = ['baik', 'rusak-ringan', 'rusak-berat', 'sedang'];
            if (known.indexOf(k) !== -1) {
              return '<span class="badge badge-' + k + '">' + a.kondisi + '</span>';
            }
            return a.kondisi;
          })()
        : '—';

      var tersediaHtml = a.tersedia
        ? (function () {
            if (a.tersedia === 'Tersedia') {
              return '<span class="badge badge-green">' + a.tersedia + '</span>';
            }
            if (a.tersedia.toLowerCase().indexOf('tidak') === 0) {
              return '<span class="badge badge-red">' + a.tersedia + '</span>';
            }
            return a.tersedia;
          })()
        : '—';

      var detailFields =
        row('Nama Aset', a.nama) +
        row('Alamat', a.alamat) +
        '<tr><td>Kondisi</td><td>: ' + kondisiHtml + '</td></tr>' +
        row('Luas', a.luas) +
        row('Klasifikasi', a.klasifikasi) +
        row('Status', a.statusHak) +
        '<tr><td>Tersedia</td><td>: ' + tersediaHtml + '</td></tr>' +
        row('Sertifikat', a.sertifikat) +
        row('Keterangan', a.keterangan);

      // Gambar aset (jika tersedia)
      var imageHtml = '';
      if (a.image) {
        imageHtml = '<img src="' + a.image + '" alt="' + a.pemanfaat + '" style="width:100%;max-height:220px;object-fit:cover;border-radius:6px;margin-bottom:10px;display:block;">';
      }

      marker.bindPopup(
        '<div class="popup">' +
          '<h4>' + a.pemanfaat + '</h4>' +
          imageHtml +

          // Bagian Pemanfaatan (selalu tampil)
          '<div class="popup-section">' +
            '<table class="popup-table">' +
              '<tr><td>Lokasi</td><td>: ' + a.lokasi + '</td></tr>' +
              '<tr><td>Kab/Kota</td><td>: ' + a.kabupaten + '</td></tr>' +
              '<tr><td>Pemanfaatan</td><td>: <span class="badge badge-' + a.statusClass + '">' + a.statusPemanfaatan + '</span></td></tr>' +
              (a.kontak ? '<tr><td>Kontak</td><td>: ' + a.kontak + ' — ' + (a.telp || '—') + '</td></tr>' : '') +
            '</table>' +
          '</div>' +

          // Tombol Lihat Detail
          '<button class="popup-detail-btn" onclick="this.nextElementSibling.classList.toggle(\'show\');this.classList.toggle(\'active\');">📋 Lihat Detail ▾</button>' +

          // Bagian Detail Aset (tersembunyi)
          '<div class="popup-section popup-section--detail popup-detail-collapse">' +
            '<table class="popup-table">' + detailFields + '</table>' +
          '</div>' +

          '<a class="wa-btn" href="' + waHref + '" target="_blank" rel="noopener">' +
            'Tanya via WhatsApp' +
          '</a>' +
        '</div>'
      );
      markers[a.id] = marker;
      markersByFilter[filterForAsset(a)].push(marker);

      // Animasi saat marker diklik langsung di peta
      marker.on('click', function () {
        selectMarker(a.id);
        map.setView([a.lat, a.lng], 17, { animate: true });
      });
    });
  }

  // ── Render Daftar Aset (Sidebar) ──────────────────────────
  function renderList(data) {
    var list = document.getElementById('list');
    var empty = document.getElementById('empty');
    list.innerHTML = '';

    data.forEach(function (a) {
      var item = document.createElement('div');
      var isMarked = a._isMarkedArea;
      var pinColor = isMarked ? '#cc0000' : (a.statusClass === 'belum-dimanfaatkan' ? '#34a853' : (a.statusClass === 'sewa' ? '#ff9800' : '#2988e8'));
      item.className = 'asset';
      if (isMarked) item.classList.add('asset-marked');
      item.innerHTML =
        '<div class="pin" style="background:' + pinColor + ';border:2px solid white;width:12px;height:12px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>' +
        '<div class="asset-body">' +
          '<div class="asset-title"><span style="display:inline-block;width:10px;height:10px;background:' + pinColor + ';border-radius:2px;margin-right:4px;vertical-align:middle;"></span>' + a.pemanfaat + '</div>' +
          '<div class="asset-meta">📍 ' + a.lokasi + '</div>' +
          '<div class="asset-meta">🏛 ' + a.kabupaten + ' · <span class="badge badge-' + (isMarked ? 'orange' : a.statusClass) + '">' + (isMarked ? 'Siap Dikerjasamakan' : a.statusPemanfaatan) + '</span></div>' +
          (isMarked ? '<div class="asset-meta" style="color:#cc0000;font-weight:600;">📐 Luas: ' + a.luas + '</div>' : '') +
        '</div>';
      item.onclick = function () {
        map.setView([a.lat, a.lng], 17, { animate: true });
        if (isMarked) {
          if (markedAreaMarkers[a.id]) markedAreaMarkers[a.id].openPopup();
        } else {
          selectMarker(a.id);
          markers[a.id].openPopup();
        }
      };
      list.appendChild(item);
    });

    empty.style.display = data.length ? 'none' : 'block';
  }

  // ── Filter Aset ───────────────────────────────────────────
  function searchableValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function matchesGlobalSearch(asset, query) {
    if (!query) return true;
    return Object.keys(asset).some(function (key) {
      return searchableValue(asset[key]).toLowerCase().indexOf(query) !== -1;
    });
  }

  function filterAssets() {
    var kab = document.getElementById('kabupaten').value.toLowerCase();
    var nama = document.getElementById('nama').value.toLowerCase();
    var opd = document.getElementById('opd').value.toLowerCase();

    var filtered = assets.filter(function (a) {
      return (!kab || searchableValue(a.kabupaten).toLowerCase().indexOf(kab) !== -1) &&
             matchesGlobalSearch(a, nama) &&
             (!opd || searchableValue(a.opd).toLowerCase().indexOf(opd) !== -1);
    });

    // Area prioritas juga ikut pencarian global
    var marked = (window.SIMANTAB_MARKED_AREAS || []).map(function (area) {
      return Object.assign({}, area, { _isMarkedArea: true });
    });
    var filteredMarked = marked.filter(function (area) {
      return (!kab || searchableValue(area.kabupaten).toLowerCase().indexOf(kab) !== -1) &&
             matchesGlobalSearch(area, nama) &&
             (!opd || searchableValue(area.opd).toLowerCase().indexOf(opd) !== -1);
    });
    var combined = filteredMarked.concat(filtered);

    renderList(combined);

    if (filtered.length) {
      var grp = filtered.map(function (a) { return markers[a.id]; });
      var group = L.featureGroup(grp);
      map.fitBounds(group.getBounds().pad(0.15), { maxZoom: 14 });
    }
  }

  // ── Reset Peta (diekspos ke global scope) ─────────────────
  window.resetMap = function () {
    document.getElementById('kabupaten').value = '';
    document.getElementById('nama').value = '';
    document.getElementById('opd').value = '';
    clearDrawnArea();
    selectMarker(null);
    var marked = (window.SIMANTAB_MARKED_AREAS || []).map(function (area) {
      return Object.assign({}, area, { _isMarkedArea: true });
    });
    renderList(marked.concat(assets));
    map.setView([-10.163, 123.595], 12);
  };

  // ── Event Listener Filter ─────────────────────────────────
  document.getElementById('kabupaten').addEventListener('change', filterAssets);
  document.getElementById('nama').addEventListener('input', filterAssets);
  document.getElementById('opd').addEventListener('change', filterAssets);

  // ── Populate Kabupaten Dropdown ───────────────────────────
  var kabupatens = [];
  assets.forEach(function (a) {
    if (a.kabupaten && kabupatens.indexOf(a.kabupaten) === -1) kabupatens.push(a.kabupaten);
  });
  kabupatens.sort();
  var kabSelect = document.getElementById('kabupaten');
  kabupatens.forEach(function (k) {
    var opt = document.createElement('option');
    opt.value = k;
    opt.textContent = k;
    kabSelect.appendChild(opt);
  });

  // ── Populate OPD Dropdown ─────────────────────────────────
  var opds = [];
  assets.forEach(function (a) {
    if (a.opd && opds.indexOf(a.opd) === -1) opds.push(a.opd);
  });
  opds.sort();
  var opdSelect = document.getElementById('opd');
  opds.forEach(function (o) {
    var opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    opdSelect.appendChild(opt);
  });

  // ── Update Statistik Ringkasan ────────────────────────────
  function updateStats() {
    var markedCount = (window.SIMANTAB_MARKED_AREAS || []).length;
    var total = assets.length + markedCount;
    var dimanfaatkan = 0;
    var belum = markedCount;
    assets.forEach(function (a) {
      if (a.statusClass === 'belum-dimanfaatkan') {
        belum++;
      } else {
        dimanfaatkan++;
      }
    });
    var statsEl = document.getElementById('stats');
    statsEl.innerHTML =
      '<div class="stat-item stat-total"><span class="stat-num">' + total + '</span>Total Aset</div>' +
      '<div class="stat-item stat-aktif"><span class="stat-num">' + dimanfaatkan + '</span>Dimanfaatkan</div>' +
      '<div class="stat-item stat-kosong"><span class="stat-num">' + belum + '</span>Belum</div>';
  }

  // ── Render Area Bertanda (Poligon + Pin) ──────────────────
  var markedAreaMarkers = {};
  var markedAreaMarkerList = [];
  var labelsVisible = true;
  function addMarkedAreas() {
    var marked = window.SIMANTAB_MARKED_AREAS || [];
    if (!marked.length) return;

    marked.forEach(function (area) {
      // Poligon transparan merah muda, outline merah tebal
      var polygon = L.polygon(area.polygon, {
        color: '#cc0000',
        weight: 3,
        fillColor: '#ff4d6d',
        fillOpacity: 0.25,
        dashArray: null
      });

      // Pin di tengah area
      var pinIcon = L.divIcon({
        className: '',
        html: '<div style="width:24px;height:24px;background:#cc0000;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px #444"></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
        popupAnchor: [0, -24]
      });

      var marker = L.marker([area.lat, area.lng], { icon: pinIcon, zIndexOffset: 1000 });
      var areaLayer = L.layerGroup([polygon, marker]).addTo(map);
      markedAreaMarkers[area.id] = marker;
      markersByFilter.prioritas.push(areaLayer);

      // Klik pin area bertanda: tengahkan tampilan ke titik
      marker.on('click', function () {
        map.setView([area.lat, area.lng], 17, { animate: true });
      });

      // Popup lengkap area bertanda
      var waText = encodeURIComponent(
        'Halo, saya ingin menanyakan informasi mengenai tanah kosong:\n\n' +
        'Lokasi : ' + area.nama + '\n' +
        'Alamat : ' + area.lokasi + '\n' +
        'Luas : ' + area.luas + '\n' +
        'Keterangan : ' + (area.keterangan || '—')
      );

      function areaRow(label, val) {
        return '<tr><td>' + label + '</td><td>: ' + (val || '—') + '</td></tr>';
      }
      var areaKondisi = area.kondisi
        ? '<span class="badge badge-rusak-berat">' + area.kondisi + '</span>'
        : '—';
      var areaTersedia = area.tersedia && area.tersedia.indexOf('Tersedia') === 0
        ? '<span class="badge badge-green">' + area.tersedia + '</span>'
        : (area.tersedia || '—');

      marker.bindPopup(
        '<div class="popup">' +
          (area.image ? '<img src="' + area.image + '" alt="Foto" style="width:100%;max-height:180px;object-fit:cover;border-radius:6px;margin-bottom:6px;">' : '') +
          '<h4>📍 ' + area.pemanfaat + '</h4>' +
          '<div class="popup-section">' +
            '<table class="popup-table">' +
              areaRow('Nama Aset', area.nama) +
              areaRow('Pemanfaat', area.pemanfaat) +
              areaRow('Alamat', area.lokasi) +
              areaRow('Kab/Kota', area.kabupaten) +
              areaRow('Status', area.statusPemanfaatan) +
              areaRow('Luas', area.luas) +
            '</table>' +
          '</div>' +

          // Tombol Lihat Detail
          '<button class="popup-detail-btn" onclick="this.nextElementSibling.classList.toggle(\'show\');this.classList.toggle(\'active\');">📋 Lihat Detail ▾</button>' +

          // Bagian Detail (tersembunyi)
          '<div class="popup-section popup-detail-collapse" style="margin-top:10px;padding-top:10px;border-top:1px dashed #d0d4e0;">' +
            '<table class="popup-table">' +
              areaRow('Klasifikasi', area.klasifikasi) +
              areaRow('Status Hak', area.statusHak) +
              areaRow('Sertifikat', area.sertifikat) +
              areaRow('Kondisi', areaKondisi) +
              areaRow('Tersedia', areaTersedia) +
              areaRow('Keterangan', area.keterangan) +
            '</table>' +
          '</div>' +
          '<span class="wa-btn-blink">Siap Dikerjasamakan — Hubungi</span>' +
          '<a class="wa-btn" href="https://wa.me/' + DEFAULT_WA.replace(/[^0-9]/g, '').replace(/^0/, '62') + '?text=' + waText + '" target="_blank" rel="noopener" style="margin-top:4px;">' +
            'Tanya via WhatsApp' +
          '</a>' +
        '</div>'
      );

      // Klik polygon juga buka popup dan tengahkan tampilan
      polygon.on('click', function () {
        map.setView([area.lat, area.lng], 17, { animate: true });
        marker.openPopup();
      });

      // Label permanen di atas marker
      var labelText = area.nama.replace(/^Tanah Kosong\s*/, '') + ' (' + area.luas + ')';
      marker.bindTooltip(labelText, {
        permanent: true,
        direction: 'top',
        offset: [0, -28],
        className: 'marked-label'
      });

      // Simpan marker untuk toggle label
      markedAreaMarkerList.push(marker);
    });
  }

  // ── Toggle Label Area Bertanda ────────────────────────────
  document.getElementById('toggleLabels').addEventListener('click', function () {
    labelsVisible = !labelsVisible;
    var btn = this;
    if (labelsVisible) {
      markedAreaMarkerList.forEach(function (m) { m.openTooltip(); });
      btn.classList.remove('off');
    } else {
      markedAreaMarkerList.forEach(function (m) { m.closeTooltip(); });
      btn.classList.add('off');
    }
  });

  // ── Toggle Kategori Marker ────────────────────────────────
  document.querySelectorAll('.legend-toggle').forEach(function (button) {
    button.addEventListener('click', function () {
      var filter = this.getAttribute('data-filter');
      var visible = this.classList.toggle('active');
      markersByFilter[filter].forEach(function (marker) {
        if (visible) {
          marker.addTo(map);
        } else {
          map.removeLayer(marker);
        }
      });
      this.setAttribute('aria-pressed', visible ? 'true' : 'false');
    });
    button.setAttribute('aria-pressed', 'true');
  });

  // ── Inisialisasi Awal ─────────────────────────────────────
  addMarkers();
  addMarkedAreas();
  updateStats();
  
  // Gabungkan marked areas ke assets list untuk sidebar
  var allItems = assets.slice();
  (window.SIMANTAB_MARKED_AREAS || []).forEach(function (area) {
    allItems.unshift(Object.assign({}, area, { _isMarkedArea: true }));
  });
  renderList(allItems);

  // ── Sidebar Toggle (Mobile) ────────────────────────────────
  var sidebar = document.querySelector('.sidebar');
  var openBtn = document.getElementById('openSidebar');
  var closeBtn = document.getElementById('closeSidebar');

  // Buat overlay backdrop untuk mobile
  var overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.querySelector('.app').appendChild(overlay);

  var toggleBtn = document.getElementById('toggleSidebarBtn');

  function openSidebar() {
    sidebar.classList.add('open');
    sidebar.classList.remove('collapsed');
    overlay.classList.add('show');
    openBtn.classList.add('hidden');
    if (toggleBtn) toggleBtn.classList.remove('collapsed');
    // Invalidate map size setelah transisi
    setTimeout(function () { map.invalidateSize(); }, 350);
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebar.classList.add('collapsed');
    overlay.classList.remove('show');
    openBtn.classList.remove('hidden');
    if (toggleBtn) toggleBtn.classList.add('collapsed');
    setTimeout(function () { map.invalidateSize(); }, 350);
  }

  function toggleSidebar() {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  // Event handler tombol
  if (openBtn) openBtn.addEventListener('click', openSidebar);
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', closeSidebar);

  // Auto-collapse sidebar di mobile saat pertama load
  function handleMobileLayout() {
    if (window.innerWidth <= 700) {
      sidebar.classList.add('collapsed');
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
      openBtn.classList.remove('hidden');
    } else {
      sidebar.classList.remove('collapsed', 'open');
      overlay.classList.remove('show');
      openBtn.classList.add('hidden');
    }
    map.invalidateSize();
  }

  handleMobileLayout();

  // ── Pastikan ukuran peta selalu akurat ────────────────────
  function fixMapSize() {
    map.invalidateSize();
  }

  // Panggil segera (ukuran flex sudah tersedia saat ini)
  fixMapSize();

  // Panggil lagi setelah resource eksternal (gambar tile, dll) selesai
  window.addEventListener('load', function () {
    fixMapSize();
    handleMobileLayout();
    requestAnimationFrame(function () {
      fixMapSize();
    });
    setTimeout(fixMapSize, 300);
    setTimeout(fixMapSize, 800);
  });

  // Panggil setiap kali window di-resize
  window.addEventListener('resize', function () {
    fixMapSize();
    handleMobileLayout();
  });

})();
