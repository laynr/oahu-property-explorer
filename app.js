require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/widgets/Search",
  "esri/widgets/Home"
], function (Map, MapView, FeatureLayer, Search, Home) {
  const serviceUrl = "https://services2.arcgis.com/iRXQh9fsThHqHhAy/ArcGIS/rest/services/OahuTMK_Landowners/FeatureServer/0";

  const outFields = [
    "tmk",
    "TMK9TXT",
    "Landowner",
    "Lessee__if_applicable_",
    "Sub_Lessee",
    "Physical_Address",
    "Contact_Info",
    "GISAcres",
    "Recorded_Area_Acres",
    "Recorded_Area_Square_Feet",
    "zone",
    "section",
    "plat",
    "Notes",
    "qpub_link",
    "in_date"
  ];

  const parcelLayer = new FeatureLayer({
    url: serviceUrl,
    outFields,
    title: "Oahu parcels",
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [0, 0, 0, 0],
        outline: {
          color: [32, 52, 62, 0.35],
          width: 0.35
        }
      }
    }
  });

  const map = new Map({
    basemap: "topo-vector",
    layers: [parcelLayer]
  });

  const view = new MapView({
    map,
    container: "viewDiv",
    center: [-157.98, 21.47],
    zoom: 10,
    constraints: {
      minZoom: 9,
      maxZoom: 20
    }
  });

  const search = new Search({
    view,
    includeDefaultSources: false,
    popupEnabled: false,
    sources: [
      {
        layer: parcelLayer,
        searchFields: ["Landowner", "TMK9TXT", "Physical_Address"],
        displayField: "TMK9TXT",
        outFields,
        exactMatch: false,
        name: "Oahu Parcels",
        placeholder: "Search owner, TMK, or address",
        suggestionTemplate: "{Landowner} | TMK {TMK9TXT} | {Physical_Address}",
        resultTemplate: "{Landowner} | TMK {TMK9TXT}",
        maxResults: 12,
        maxSuggestions: 12,
        minSuggestCharacters: 2
      }
    ]
  });
  const home = new Home({ view });
  view.ui.add(search, "top-right");
  view.ui.add(home, "top-right");

  const details = document.getElementById("details");
  const ownerSearchInput = document.getElementById("ownerSearchInput");
  const ownerSearchButton = document.getElementById("ownerSearchButton");
  const ownerSearchStatus = document.getElementById("ownerSearchStatus");
  const ownerSearchResults = document.getElementById("ownerSearchResults");
  let activeHighlight = null;
  let parcelLayerView = null;

  function esc(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatValue(v) {
    if (v === null || v === undefined || v === "") return "-";
    if (typeof v === "number") return v.toLocaleString();
    return esc(v);
  }

  function dateFromEpoch(epochMs) {
    if (!epochMs) return "-";
    const d = new Date(epochMs);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  }

  function setDetails(feature) {
    const a = feature.attributes;
    const qpub = a.qpub_link && String(a.qpub_link).trim() ? esc(a.qpub_link) : null;
    const ownerName = a.Landowner && String(a.Landowner).trim() ? a.Landowner : "Not listed in this dataset";

    details.classList.remove("empty");
    details.innerHTML = `
      <dl class="kv">
        <dt>Owner</dt><dd>${formatValue(ownerName)}</dd>
        <dt>TMK</dt><dd>${formatValue(a.TMK9TXT || a.tmk)}</dd>
        <dt>Physical Address</dt><dd>${formatValue(a.Physical_Address)}</dd>
        <dt>Lessee</dt><dd>${formatValue(a.Lessee__if_applicable_ || a.Sub_Lessee)}</dd>
        <dt>Area (acres)</dt><dd>${formatValue(a.Recorded_Area_Acres || a.GISAcres)}</dd>
        <dt>Area (sq ft)</dt><dd>${formatValue(a.Recorded_Area_Square_Feet)}</dd>
        <dt>Zone / Section / Plat</dt><dd>${formatValue(a.zone)} / ${formatValue(a.section)} / ${formatValue(a.plat)}</dd>
        <dt>Contact</dt><dd>${formatValue(a.Contact_Info)}</dd>
        <dt>Notes</dt><dd>${formatValue(a.Notes)}</dd>
        <dt>Record Date</dt><dd>${dateFromEpoch(a.in_date)}</dd>
        <dt>Tax Record Link</dt>
        <dd>${qpub ? `<a href="${qpub}" target="_blank" rel="noopener noreferrer">Open parcel details</a>` : "-"}</dd>
      </dl>
    `;
  }

  function clearDetails(message) {
    details.classList.add("empty");
    details.innerHTML = `<p>${esc(message)}</p>`;
  }

  function setHighlight(feature) {
    if (activeHighlight) activeHighlight.remove();
    if (parcelLayerView) {
      activeHighlight = parcelLayerView.highlight(feature);
    }
  }

  async function getFullFeatureByObjectId(objectId) {
    const query = parcelLayer.createQuery();
    query.objectIds = [objectId];
    query.outFields = outFields;
    query.returnGeometry = true;

    const result = await parcelLayer.queryFeatures(query);
    return result.features[0] || null;
  }

  async function getFullFeature(feature) {
    const attrs = feature.attributes || {};
    const objectIdField = parcelLayer.objectIdField || "OBJECTID_1";
    const objectId = attrs[objectIdField] ?? attrs.OBJECTID_1 ?? attrs.OBJECTID ?? attrs.objectid;

    if (objectId === undefined || objectId === null) return feature;
    return (await getFullFeatureByObjectId(objectId)) || feature;
  }

  function clearSearchResults() {
    ownerSearchResults.innerHTML = "";
  }

  function renderSearchResult(feature) {
    const attrs = feature.attributes || {};
    const owner = attrs.Landowner && String(attrs.Landowner).trim() ? attrs.Landowner : "Owner not listed";
    const tmk = attrs.TMK9TXT || attrs.tmk || "-";
    const addr = attrs.Physical_Address || "Address not listed";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-result";
    btn.innerHTML = `<strong>${esc(owner)}</strong><span>TMK ${esc(String(tmk))} | ${esc(String(addr))}</span>`;
    btn.addEventListener("click", async function () {
      const objectIdField = parcelLayer.objectIdField || "OBJECTID_1";
      const objectId = attrs[objectIdField] ?? attrs.OBJECTID_1 ?? attrs.OBJECTID ?? attrs.objectid;
      const fullFeature = objectId !== undefined ? await getFullFeatureByObjectId(objectId) : feature;
      if (!fullFeature) return;
      setHighlight(fullFeature);
      setDetails(fullFeature);
      await view.goTo(fullFeature.geometry);
    });
    ownerSearchResults.appendChild(btn);
  }

  function normalizeSearchTerm(value) {
    return String(value || "").trim().replaceAll("'", "''");
  }

  async function runOwnerSearch() {
    const raw = ownerSearchInput.value || "";
    const term = normalizeSearchTerm(raw);
    clearSearchResults();

    if (!term) {
      ownerSearchStatus.textContent = "Enter owner, TMK, or address.";
      return;
    }

    ownerSearchStatus.textContent = "Searching...";

    const query = parcelLayer.createQuery();
    query.where = [
      `UPPER(Landowner) LIKE UPPER('%${term}%')`,
      `TMK9TXT LIKE '%${term}%'`,
      `UPPER(Physical_Address) LIKE UPPER('%${term}%')`,
      `tmk LIKE '%${term}%'`
    ].join(" OR ");
    query.outFields = outFields;
    query.returnGeometry = true;
    query.num = 15;

    const result = await parcelLayer.queryFeatures(query);
    const features = result.features || [];

    if (!features.length) {
      ownerSearchStatus.textContent = "No matches found.";
      return;
    }

    ownerSearchStatus.textContent = `${features.length} match${features.length === 1 ? "" : "es"} found.`;
    features.forEach(renderSearchResult);
  }

  async function pickParcel(event) {
    const query = parcelLayer.createQuery();
    query.geometry = event.mapPoint;
    query.spatialRelationship = "intersects";
    query.outFields = outFields;
    query.returnGeometry = true;
    query.num = 1;

    const result = await parcelLayer.queryFeatures(query);
    const feature = result.features && result.features[0];

    if (!feature) {
      clearDetails("No parcel found at that point. Try zooming in and clicking inside a parcel.");
      if (activeHighlight) {
        activeHighlight.remove();
        activeHighlight = null;
      }
      return;
    }

    setHighlight(feature);
    setDetails(feature);
  }

  view.when(async function () {
    parcelLayerView = await view.whenLayerView(parcelLayer);
    clearDetails("Map ready. Click any parcel on Oahu.");
  });

  view.on("click", function (event) {
    pickParcel(event);
  });

  search.on("select-result", async function (event) {
    if (!event.result || !event.result.feature) return;
    const fullFeature = await getFullFeature(event.result.feature);
    setHighlight(fullFeature);
    setDetails(fullFeature);
  });

  ownerSearchButton.addEventListener("click", function () {
    runOwnerSearch();
  });

  ownerSearchInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") runOwnerSearch();
  });
});
