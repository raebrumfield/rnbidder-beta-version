/* ═══════════════════════════════════════════
   RnB Bidding Tool — Estimator + Blueprint Counter
   ═══════════════════════════════════════════ */

// ─── PDF.js Setup ───
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// ─── Marker Categories ───
const MARKER_CATEGORIES = {
  outlet:   { label: "Outlet",       color: "#2196F3", letter: "O" },
  switch:   { label: "Switch",       color: "#4CAF50", letter: "S" },
  lighting: { label: "Light",        color: "#FF9800", letter: "L" },
  gfci:     { label: "GFCI",         color: "#9C27B0", letter: "G" },
  panel:    { label: "Panel",        color: "#F44336", letter: "P" },
  circuit:  { label: "Circuit",      color: "#795548", letter: "C" },
  ev:       { label: "EV Charger",   color: "#00BCD4", letter: "E" },
  wire:     { label: "Wire Run",     color: "#FF5722", letter: "W" },
  jbox:     { label: "J-Box",        color: "#607D8B", letter: "J" },
  other:    { label: "Other",        color: "#9E9E9E", letter: "?" },
};

// ─── Line Item Presets (used by both manual presets and Push to Estimator) ───
const PRESETS = {
  panel:    { description: "200A Panel Upgrade",        qty: 1, unitCost: 850,  laborHrs: 8,    laborRate: 85 },
  outlet:   { description: "Standard Outlet Install",   qty: 1, unitCost: 12,   laborHrs: 0.75, laborRate: 85 },
  switch:   { description: "Switch Install",            qty: 1, unitCost: 15,   laborHrs: 0.5,  laborRate: 85 },
  lighting: { description: "Lighting Fixture Install",  qty: 1, unitCost: 65,   laborHrs: 1,    laborRate: 85 },
  circuit:  { description: "New 20A Circuit Run",       qty: 1, unitCost: 45,   laborHrs: 2,    laborRate: 85 },
  ev:       { description: "EV Charger Install (L2)",   qty: 1, unitCost: 450,  laborHrs: 4,    laborRate: 85 },
  gfci:     { description: "GFCI Outlet Install",       qty: 1, unitCost: 22,   laborHrs: 0.75, laborRate: 85 },
  wire:     { description: "Wire Run (per 50 ft)",      qty: 1, unitCost: 75,   laborHrs: 1.5,  laborRate: 85 },
  jbox:     { description: "Junction Box",              qty: 1, unitCost: 18,   laborHrs: 0.5,  laborRate: 85 },
  other:    { description: "Miscellaneous Item",        qty: 1, unitCost: 0,    laborHrs: 0,    laborRate: 85 },
};

// ═══════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════
let currentBidId = null;
let lineItems = [];
let nextItemId = 0;

// Blueprint counter state
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let currentZoom = 1.0;
let baseScale = 1.0;       // scale to fit viewport width
let markers = [];           // { x, y, category, page } — x,y normalized 0–1
let activeCategory = null;

const MARKER_RADIUS = 14;  // px on the canvas
const HIT_RADIUS = 18;     // px click-to-remove tolerance


// ═══════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  initUploadZone();
  setDefaultDate();
  loadBidFromUrl();
  buildCategoryToolbar();
  buildCounterList();
  renderLineItems();
});

function setDefaultDate() {
  const d = document.getElementById("bidDate");
  if (!d.value) d.value = new Date().toISOString().split("T")[0];
}


// ═══════════════════════════════════════════
//  TAB SWITCHING
// ═══════════════════════════════════════════
function switchTab(tab) {
  const btnLine = document.getElementById("tabLineItems");
  const btnBlue = document.getElementById("tabBlueprint");
  const tabLine = document.getElementById("lineItemsTab");
  const tabBlue = document.getElementById("blueprintTab");

  if (tab === "blueprint") {
    btnBlue.classList.add("active");
    btnLine.classList.remove("active");
    tabBlue.style.display = "block";
    tabLine.style.display = "none";
  } else {
    btnLine.classList.add("active");
    btnBlue.classList.remove("active");
    tabLine.style.display = "block";
    tabBlue.style.display = "none";
  }
}


// ═══════════════════════════════════════════
//  PDF UPLOAD
// ═══════════════════════════════════════════
function initUploadZone() {
  const zone = document.getElementById("uploadZone");
  const input = document.getElementById("pdfUpload");
  const filename = document.getElementById("uploadFilename");

  zone.addEventListener("click", () => input.click());
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("dragover"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) handlePDFFile(e.dataTransfer.files[0]);
  });
  input.addEventListener("change", () => {
    if (input.files.length > 0) handlePDFFile(input.files[0]);
  });
}

async function handlePDFFile(file) {
  if (file.type !== "application/pdf") {
    showToast("Please upload a PDF file.");
    return;
  }

  document.getElementById("uploadFilename").textContent = file.name;
  showToast("Loading blueprint: " + file.name);

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPages = pdfDoc.numPages;
    currentPage = 1;
    markers = [];
    activeCategory = null;

    // Show blueprint workspace & counter panel
    document.getElementById("blueprintEmpty").style.display = "none";
    document.getElementById("blueprintWorkspace").style.display = "flex";
    document.getElementById("counterPanel").style.display = "block";

    // Switch to blueprint tab
    switchTab("blueprint");

    // Update page controls
    document.getElementById("pageTotal").textContent = totalPages;
    updatePageButtons();

    // Render first page
    await renderCurrentPage();
    showToast("Blueprint loaded — " + totalPages + " page(s)");

  } catch (err) {
    console.error("PDF load error:", err);
    showToast("Error loading PDF. Try another file.");
  }
}


// ═══════════════════════════════════════════
//  PDF RENDERING
// ═══════════════════════════════════════════
async function renderCurrentPage() {
  if (!pdfDoc) return;

  const page = await pdfDoc.getPage(currentPage);
  const viewport = page.getViewport({ scale: 1 });

  // Calculate scale to fit viewport width
  const container = document.getElementById("pdfViewport");
  const availableWidth = container.clientWidth - 40; // minus padding
  baseScale = availableWidth / viewport.width;

  const renderScale = baseScale * currentZoom;
  const scaledViewport = page.getViewport({ scale: renderScale });

  // PDF canvas
  const pdfCanvas = document.getElementById("pdfCanvas");
  const pdfCtx = pdfCanvas.getContext("2d");
  pdfCanvas.width = scaledViewport.width;
  pdfCanvas.height = scaledViewport.height;

  // Marker overlay canvas — same size
  const markerCanvas = document.getElementById("markerCanvas");
  markerCanvas.width = scaledViewport.width;
  markerCanvas.height = scaledViewport.height;

  // Render PDF
  await page.render({ canvasContext: pdfCtx, viewport: scaledViewport }).promise;

  // Draw markers for this page
  renderMarkers();

  // Update page number display
  document.getElementById("pageNum").textContent = currentPage;
  document.getElementById("zoomLevel").textContent = Math.round(currentZoom * 100) + "%";

  // Attach click handler to marker canvas
  markerCanvas.onclick = handleCanvasClick;
  updateMarkerCursor();
}


// ═══════════════════════════════════════════
//  PAGE NAVIGATION
// ═══════════════════════════════════════════
function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    updatePageButtons();
    renderCurrentPage();
  }
}

function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    updatePageButtons();
    renderCurrentPage();
  }
}

function updatePageButtons() {
  document.getElementById("prevPageBtn").disabled = (currentPage <= 1);
  document.getElementById("nextPageBtn").disabled = (currentPage >= totalPages);
}


// ═══════════════════════════════════════════
//  ZOOM
// ═══════════════════════════════════════════
function zoomIn() {
  currentZoom = Math.min(currentZoom + 0.25, 4);
  renderCurrentPage();
}

function zoomOut() {
  currentZoom = Math.max(currentZoom - 0.25, 0.25);
  renderCurrentPage();
}

function fitToWidth() {
  currentZoom = 1.0;
  renderCurrentPage();
}


// ═══════════════════════════════════════════
//  CATEGORY TOOLBAR
// ═══════════════════════════════════════════
function buildCategoryToolbar() {
  const container = document.getElementById("toolbarCategories");
  container.innerHTML = Object.entries(MARKER_CATEGORIES).map(([key, cat]) => {
    return `<button class="cat-marker-btn" data-cat="${key}" onclick="selectCategory('${key}')">
      <span class="cat-marker-dot" style="background:${cat.color}"></span>
      ${cat.label}
    </button>`;
  }).join("");
}

function selectCategory(key) {
  // Toggle: clicking the same category deselects it
  if (activeCategory === key) {
    activeCategory = null;
  } else {
    activeCategory = key;
  }

  // Update button states
  document.querySelectorAll(".cat-marker-btn").forEach(btn => {
    const cat = btn.dataset.cat;
    const catData = MARKER_CATEGORIES[cat];
    if (cat === activeCategory) {
      btn.classList.add("active");
      btn.style.background = catData.color;
      btn.style.borderColor = catData.color;
      btn.style.color = "#fff";
    } else {
      btn.classList.remove("active");
      btn.style.background = "";
      btn.style.borderColor = "";
      btn.style.color = "";
    }
  });

  // Update indicator
  const indicator = document.getElementById("activeIndicator");
  if (activeCategory) {
    const cat = MARKER_CATEGORIES[activeCategory];
    indicator.textContent = "Placing: " + cat.label + " — Click on the blueprint to mark. Click an existing marker to remove it.";
    indicator.style.background = cat.color;
    indicator.classList.add("has-category");
  } else {
    indicator.textContent = "Select a category above, then click on the blueprint to mark items.";
    indicator.style.background = "";
    indicator.classList.remove("has-category");
  }

  updateMarkerCursor();
}

function updateMarkerCursor() {
  const canvas = document.getElementById("markerCanvas");
  if (canvas) {
    if (activeCategory) {
      canvas.classList.add("has-category");
    } else {
      canvas.classList.remove("has-category");
    }
  }
}


// ═══════════════════════════════════════════
//  MARKER SYSTEM
// ═══════════════════════════════════════════
function handleCanvasClick(e) {
  const canvas = document.getElementById("markerCanvas");
  const rect = canvas.getBoundingClientRect();

  // Get click position in canvas pixel coordinates
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top) * scaleY;

  // Check if clicking on an existing marker (to remove it)
  const hitIdx = findMarkerAt(canvasX, canvasY);
  if (hitIdx >= 0) {
    markers.splice(hitIdx, 1);
    renderMarkers();
    updateCounterDisplay();
    showToast("Marker removed");
    return;
  }

  // If no category selected, do nothing
  if (!activeCategory) {
    showToast("Select a category first!");
    return;
  }

  // Normalize coordinates to 0–1 range
  const normX = canvasX / canvas.width;
  const normY = canvasY / canvas.height;

  markers.push({
    x: normX,
    y: normY,
    category: activeCategory,
    page: currentPage,
  });

  renderMarkers();
  updateCounterDisplay();
}

function findMarkerAt(canvasX, canvasY) {
  // Search in reverse so topmost markers get priority
  for (let i = markers.length - 1; i >= 0; i--) {
    const m = markers[i];
    if (m.page !== currentPage) continue;

    const canvas = document.getElementById("markerCanvas");
    const mx = m.x * canvas.width;
    const my = m.y * canvas.height;
    const dist = Math.sqrt((canvasX - mx) ** 2 + (canvasY - my) ** 2);
    if (dist <= HIT_RADIUS) return i;
  }
  return -1;
}

function renderMarkers() {
  const canvas = document.getElementById("markerCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pageMarkers = markers.filter(m => m.page === currentPage);

  pageMarkers.forEach(m => {
    const cat = MARKER_CATEGORIES[m.category];
    if (!cat) return;

    const x = m.x * canvas.width;
    const y = m.y * canvas.height;

    // Outer ring (darker border)
    ctx.beginPath();
    ctx.arc(x, y, MARKER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = cat.color + "B3"; // ~70% opacity
    ctx.fill();
    ctx.strokeStyle = cat.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Letter label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(cat.letter, x, y + 1);
  });
}


// ═══════════════════════════════════════════
//  MARKER ACTIONS
// ═══════════════════════════════════════════
function undoLastMarker() {
  // Remove the last marker on the current page
  for (let i = markers.length - 1; i >= 0; i--) {
    if (markers[i].page === currentPage) {
      markers.splice(i, 1);
      renderMarkers();
      updateCounterDisplay();
      showToast("Last marker undone");
      return;
    }
  }
  showToast("No markers to undo on this page");
}

function clearPageMarkers() {
  const before = markers.length;
  markers = markers.filter(m => m.page !== currentPage);
  if (markers.length < before) {
    renderMarkers();
    updateCounterDisplay();
    showToast("Page " + currentPage + " markers cleared");
  } else {
    showToast("No markers on this page");
  }
}

function clearAllMarkers() {
  if (markers.length === 0) {
    showToast("No markers to clear");
    return;
  }
  if (!confirm("Clear ALL markers on ALL pages?")) return;
  markers = [];
  renderMarkers();
  updateCounterDisplay();
  showToast("All markers cleared");
}


// ═══════════════════════════════════════════
//  COUNTER DISPLAY (Sidebar)
// ═══════════════════════════════════════════
function buildCounterList() {
  const container = document.getElementById("counterList");
  container.innerHTML = Object.entries(MARKER_CATEGORIES).map(([key, cat]) => {
    return `<div class="counter-row" data-cat="${key}">
      <span class="counter-dot" style="background:${cat.color}"></span>
      <span class="counter-label">${cat.label}</span>
      <span class="counter-count" id="count-${key}">0</span>
    </div>`;
  }).join("");
}

function updateCounterDisplay() {
  let total = 0;
  Object.keys(MARKER_CATEGORIES).forEach(key => {
    const count = markers.filter(m => m.category === key).length;
    const el = document.getElementById("count-" + key);
    if (el) el.textContent = count;
    total += count;
  });

  const totalEl = document.getElementById("counterTotal");
  if (totalEl) {
    totalEl.innerHTML = "Total markers: <strong>" + total + "</strong>";
  }
}


// ═══════════════════════════════════════════
//  PUSH TO ESTIMATOR
// ═══════════════════════════════════════════
function pushToEstimator() {
  // Count markers by category
  const counts = {};
  markers.forEach(m => {
    counts[m.category] = (counts[m.category] || 0) + 1;
  });

  if (Object.keys(counts).length === 0) {
    showToast("No markers to push. Mark items on the blueprint first!");
    return;
  }

  // Create line items for each category that has markers
  let added = 0;
  Object.entries(counts).forEach(([cat, count]) => {
    const preset = PRESETS[cat];
    if (!preset) return;

    // Check if a line item for this category already exists
    const existing = lineItems.find(item => item.description === preset.description);
    if (existing) {
      // Update quantity
      existing.qty = count;
    } else {
      // Add new line item
      lineItems.push({
        _id: nextItemId++,
        description: preset.description,
        qty: count,
        unitCost: preset.unitCost,
        laborHrs: preset.laborHrs,
        laborRate: preset.laborRate,
      });
    }
    added++;
  });

  // Switch to Line Items tab to show results
  switchTab("lineItems");
  renderLineItems();
  showToast(added + " categories pushed to estimator!");
}


// ═══════════════════════════════════════════
//  LINE ITEM MANAGEMENT (existing functionality)
// ═══════════════════════════════════════════
function addLineItem(preset) {
  const item = preset
    ? { ...preset, _id: nextItemId++ }
    : { description: "", qty: 1, unitCost: 0, laborHrs: 0, laborRate: 85, _id: nextItemId++ };
  lineItems.push(item);
  renderLineItems();
}

function addPreset(key) {
  const preset = PRESETS[key];
  if (preset) addLineItem({ ...preset });
}

function removeLineItem(id) {
  lineItems = lineItems.filter(item => item._id !== id);
  renderLineItems();
}

function renderLineItems() {
  const tbody = document.getElementById("lineItemsBody");
  const empty = document.getElementById("emptyState");

  if (lineItems.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    recalcTotals();
    return;
  }

  empty.style.display = "none";

  tbody.innerHTML = lineItems.map(item => {
    const matCost = (item.qty || 0) * (item.unitCost || 0);
    const labCost = (item.laborHrs || 0) * (item.laborRate || 0);
    const lineTotal = matCost + labCost;
    return `
      <tr data-id="${item._id}">
        <td><input type="text" value="${escapeAttr(item.description || "")}" onchange="updateItem(${item._id}, 'description', this.value)" placeholder="Description"></td>
        <td><input type="number" value="${item.qty}" min="0" step="1" onchange="updateItem(${item._id}, 'qty', this.value)"></td>
        <td><input type="number" value="${item.unitCost}" min="0" step="0.01" onchange="updateItem(${item._id}, 'unitCost', this.value)" placeholder="$"></td>
        <td><input type="number" value="${item.laborHrs}" min="0" step="0.25" onchange="updateItem(${item._id}, 'laborHrs', this.value)"></td>
        <td><input type="number" value="${item.laborRate}" min="0" step="1" onchange="updateItem(${item._id}, 'laborRate', this.value)" placeholder="$/hr"></td>
        <td class="line-total-val">$${lineTotal.toFixed(2)}</td>
        <td><button class="remove-row-btn" onclick="removeLineItem(${item._id})" title="Remove">&times;</button></td>
      </tr>`;
  }).join("");

  recalcTotals();
}

function updateItem(id, field, value) {
  const item = lineItems.find(i => i._id === id);
  if (!item) return;
  if (field === "description") {
    item[field] = value;
  } else {
    item[field] = parseFloat(value) || 0;
  }
  renderLineItems();
}


// ═══════════════════════════════════════════
//  TOTALS
// ═══════════════════════════════════════════
function recalcTotals() {
  let materialsTotal = 0;
  let laborTotal = 0;

  lineItems.forEach(item => {
    materialsTotal += (item.qty || 0) * (item.unitCost || 0);
    laborTotal += (item.laborHrs || 0) * (item.laborRate || 0);
  });

  const subtotal = materialsTotal + laborTotal;
  const markupPct = parseFloat(document.getElementById("markupPercent").value) || 0;
  const taxPct = parseFloat(document.getElementById("taxPercent").value) || 0;
  const markupAmt = subtotal * (markupPct / 100);
  const taxAmt = (subtotal + markupAmt) * (taxPct / 100);
  const grandTotal = subtotal + markupAmt + taxAmt;

  document.getElementById("materialsSubtotal").textContent = "$" + materialsTotal.toFixed(2);
  document.getElementById("laborSubtotal").textContent = "$" + laborTotal.toFixed(2);
  document.getElementById("markupAmount").textContent = "$" + markupAmt.toFixed(2);
  document.getElementById("taxAmount").textContent = "$" + taxAmt.toFixed(2);
  document.getElementById("grandTotal").textContent = "$" + grandTotal.toFixed(2);
}


// ═══════════════════════════════════════════
//  SAVE BID
// ═══════════════════════════════════════════
function saveBid() {
  const bid = collectBidData();
  BidStore.save(bid);
  currentBidId = bid.id;

  const url = new URL(window.location);
  url.searchParams.set("bid", bid.id);
  window.history.replaceState({}, "", url);

  showToast("Bid saved!");
}

function collectBidData() {
  const materialsTotal = lineItems.reduce((sum, item) => sum + (item.qty || 0) * (item.unitCost || 0), 0);
  const laborTotal = lineItems.reduce((sum, item) => sum + (item.laborHrs || 0) * (item.laborRate || 0), 0);
  const subtotal = materialsTotal + laborTotal;
  const markupPct = parseFloat(document.getElementById("markupPercent").value) || 0;
  const taxPct = parseFloat(document.getElementById("taxPercent").value) || 0;
  const markupAmt = subtotal * (markupPct / 100);
  const taxAmt = (subtotal + markupAmt) * (taxPct / 100);
  const grandTotal = subtotal + markupAmt + taxAmt;

  return {
    id: currentBidId || BidStore.generateId(),
    name: document.getElementById("bidName").value.trim(),
    customerName: document.getElementById("customerName").value.trim(),
    jobAddress: document.getElementById("jobAddress").value.trim(),
    bidDate: document.getElementById("bidDate").value,
    notes: document.getElementById("bidNotes").value.trim(),
    markupPercent: markupPct,
    taxPercent: taxPct,
    materialsSubtotal: materialsTotal,
    laborSubtotal: laborTotal,
    markupAmount: markupAmt,
    taxAmount: taxAmt,
    grandTotal: grandTotal,
    lineItems: lineItems.map(({ _id, ...rest }) => rest),
    markers: markers, // save markers too
  };
}


// ═══════════════════════════════════════════
//  LOAD BID FROM URL
// ═══════════════════════════════════════════
function loadBidFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const bidId = params.get("bid");
  if (!bidId) return;

  const bid = BidStore.get(bidId);
  if (!bid) { showToast("Bid not found."); return; }

  currentBidId = bid.id;
  document.getElementById("bidName").value = bid.name || "";
  document.getElementById("customerName").value = bid.customerName || "";
  document.getElementById("jobAddress").value = bid.jobAddress || "";
  document.getElementById("bidDate").value = bid.bidDate || "";
  document.getElementById("markupPercent").value = bid.markupPercent ?? 20;
  document.getElementById("taxPercent").value = bid.taxPercent ?? 8.2;
  document.getElementById("bidNotes").value = bid.notes || "";
  lineItems = bid.lineItems ? bid.lineItems.map((item, i) => ({ ...item, _id: i })) : [];
  nextItemId = lineItems.length;

  // Restore markers if saved
  if (bid.markers && bid.markers.length > 0) {
    markers = bid.markers;
    updateCounterDisplay();
  }

  renderLineItems();
  showToast("Bid loaded: " + (bid.name || bid.id));
}


// ═══════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════
function exportCurrentBid(format) {
  const bid = collectBidData();
  if (format === "pdf") {
    exportBidToPDF(bid).then(() => showToast("PDF exported!")).catch(err => {
      console.error("PDF export failed:", err);
      showToast("PDF export failed — see console.");
    });
    return;
  }
  if (format === "json") {
    downloadFile(JSON.stringify(bid, null, 2), (bid.name || "bid") + ".json", "application/json");
  } else {
    downloadFile(bidToFormattedText(bid), (bid.name || "bid") + ".txt", "text/plain");
  }
  showToast("Bid exported!");
}

function bidToFormattedText(bid) {
  let t = "";
  t += "===========================================\n";
  t += "  RnB HOMES ELECTRICAL -- BID ESTIMATE\n";
  t += "===========================================\n\n";
  t += "Bid Name:     " + (bid.name || "--") + "\n";
  t += "Customer:     " + (bid.customerName || "--") + "\n";
  t += "Address:      " + (bid.jobAddress || "--") + "\n";
  t += "Date:         " + (bid.bidDate || "--") + "\n\n";
  t += "-------------------------------------------\n";
  t += "  LINE ITEMS\n";
  t += "-------------------------------------------\n\n";

  if (bid.lineItems && bid.lineItems.length > 0) {
    bid.lineItems.forEach((item, i) => {
      const matCost = (item.qty || 0) * (item.unitCost || 0);
      const labCost = (item.laborHrs || 0) * (item.laborRate || 0);
      t += (i + 1) + ". " + (item.description || "Item") + "\n";
      t += "   Qty: " + item.qty + "  x  $" + Number(item.unitCost).toFixed(2) + "  =  $" + matCost.toFixed(2) + " materials\n";
      t += "   Labor: " + item.laborHrs + " hrs  x  $" + Number(item.laborRate).toFixed(2) + "/hr  =  $" + labCost.toFixed(2) + "\n";
      t += "   Line Total: $" + (matCost + labCost).toFixed(2) + "\n\n";
    });
  } else {
    t += "(No line items)\n\n";
  }

  t += "-------------------------------------------\n";
  t += "  TOTALS\n";
  t += "-------------------------------------------\n\n";
  t += "Materials Subtotal:  $" + Number(bid.materialsSubtotal || 0).toFixed(2) + "\n";
  t += "Labor Subtotal:      $" + Number(bid.laborSubtotal || 0).toFixed(2) + "\n";
  t += "Markup (" + (bid.markupPercent || 0) + "%):       $" + Number(bid.markupAmount || 0).toFixed(2) + "\n";
  t += "Tax (" + (bid.taxPercent || 0) + "%):          $" + Number(bid.taxAmount || 0).toFixed(2) + "\n";
  t += "----------------------\n";
  t += "GRAND TOTAL:         $" + Number(bid.grandTotal || 0).toFixed(2) + "\n\n";

  if (bid.notes) {
    t += "-------------------------------------------\n";
    t += "  NOTES\n";
    t += "-------------------------------------------\n\n";
    t += bid.notes + "\n";
  }

  t += "\n===========================================\n";
  t += "  RnB Homes Electrical - Colorado Springs, CO\n";
  t += "===========================================\n";
  return t;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// ═══════════════════════════════════════════
//  CLEAR ESTIMATOR
// ═══════════════════════════════════════════
function clearEstimator() {
  if (!confirm("Clear all line items, markers, and bid details? This won't delete saved bids.")) return;
  currentBidId = null;
  lineItems = [];
  nextItemId = 0;
  markers = [];
  activeCategory = null;
  pdfDoc = null;

  document.getElementById("bidName").value = "";
  document.getElementById("customerName").value = "";
  document.getElementById("jobAddress").value = "";
  document.getElementById("bidNotes").value = "";
  document.getElementById("uploadFilename").textContent = "";
  setDefaultDate();

  // Reset blueprint UI
  document.getElementById("blueprintEmpty").style.display = "flex";
  document.getElementById("blueprintWorkspace").style.display = "none";
  document.getElementById("counterPanel").style.display = "none";
  updateCounterDisplay();
  buildCategoryToolbar(); // reset button states

  // Reset URL
  const url = new URL(window.location);
  url.searchParams.delete("bid");
  window.history.replaceState({}, "", url);

  switchTab("lineItems");
  renderLineItems();
  showToast("Estimator cleared.");
}


// ═══════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════
function escapeAttr(str) {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
