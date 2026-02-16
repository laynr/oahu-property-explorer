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

    details.classList.remove("empty");
    details.innerHTML = `
      <dl class="kv">
        <dt>Owner</dt><dd>${formatValue(a.Landowner)}</dd>
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

  async function getFullFeature(feature) {
    const attrs = feature.attributes || {};
    const objectIdField = parcelLayer.objectIdField || "OBJECTID";
    const objectId = attrs[objectIdField] ?? attrs.OBJECTID ?? attrs.objectid;

    if (objectId === undefined || objectId === null) {
      return feature;
    }

    const query = parcelLayer.createQuery();
    query.objectIds = [objectId];
    query.outFields = outFields;
    query.returnGeometry = true;

    const result = await parcelLayer.queryFeatures(query);
    return result.features[0] || feature;
  }

  async function pickParcel(screenPoint) {
    const hit = await view.hitTest(screenPoint, { include: [parcelLayer] });
    const result = hit.results.find((r) => r.graphic && r.graphic.layer === parcelLayer);

    if (!result) {
      clearDetails("No parcel found at that point. Try zooming in and clicking inside a parcel.");
      if (activeHighlight) {
        activeHighlight.remove();
        activeHighlight = null;
      }
      return;
    }

    const fullFeature = await getFullFeature(result.graphic);
    setHighlight(fullFeature);
    setDetails(fullFeature);
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
});
