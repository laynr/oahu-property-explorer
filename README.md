# Oahu Property Explorer

Interactive map of Oahu parcels. Click a parcel to view owner and useful lot details.

Live site: `https://laynr.github.io/oahu-property-explorer/`

## Run

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Features

- Click parcel to view owner, TMK, address, area, and related fields
- Search by owner name, TMK, or physical address
- Direct link to parcel tax details when available (`qpub_link`)

## Data source

The map reads parcel attributes from:

- `https://services2.arcgis.com/iRXQh9fsThHqHhAy/ArcGIS/rest/services/OahuTMK_Landowners/FeatureServer/0`

This includes fields such as `Landowner`, `TMK9TXT`, `Physical_Address`, parcel area, and `qpub_link`.

## Notes

- Parcel ownership/assessment data changes over time; verify critical records with official City and County Honolulu sources.
- This app is a reference viewer and not a legal survey/title system.
