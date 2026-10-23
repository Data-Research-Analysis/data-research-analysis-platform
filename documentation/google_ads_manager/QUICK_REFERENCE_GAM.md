# Google Ad Manager Integration - Quick Reference

## 📋 Current Implementation

**Status:** ✅ Implemented  
**Report Types (driver):** 6 — Revenue, Geography, Device, Ad Unit, Advertiser, Time Series  
**Report Types (UI):** 5 — Revenue, Inventory, Orders, Geography, Device (Inventory/Orders map to Revenue)  
**Sync Options:** Hourly, Daily, Weekly, Manual  
**Date Range:** Optional; defaults to the last 30 days

---

## 🎯 What's Available

### Report Types
- **Revenue**: Impressions, clicks, revenue, CPM, CTR by ad unit and country
- **Geography**: Performance by country, region, city
- **Device**: Device category, browser, OS
- **Ad Unit**: Ad unit performance with ad-server/fill metrics
- **Advertiser**: Advertiser/order/line-item delivery
- **Time Series**: Daily network totals

### Sync Frequencies
- **Manual**: On-demand only
- **Hourly**, **Daily**, **Weekly**: Scheduler-driven (GAM is scheduler-eligible)

### Date Range
- Optional start/end dates; default is the last 30 days

---

## 🔄 Setup Flow (5 Minutes)

```
Step 1: Navigate → Data Sources → "Add Data Source"
Step 2: Select "Google Ad Manager" → "Sign In with Google"
Step 3: Authorize and select your GAM network
Step 4: Configure:
        • Name: "Production Network Revenue"
        • Reports: Revenue, Geography, Device, etc.
        • Sync: Hourly, Daily, Weekly, or Manual
Step 5: Click "Connect & Sync Data"
Step 6: Data appears in AI Data Modeler
```

---

## 💾 Database Schema

**Schema Name:** `dra_google_ad_manager`

**Table Format:** hash-based physical name `ds{dataSourceId}_{md5[:8]}` per report type + network

**Logical names:** `revenue`, `geography`, `device`, `ad_unit`, `advertiser`, `time_series`

**Examples:**
- `dra_google_ad_manager."ds42_ab12cd34"` (revenue)
- `dra_google_ad_manager."ds42_ef56gh78"` (geography)

---

## 🔐 Security

✅ OAuth 2.0 authentication  
✅ Encrypted token storage (backend only)  
✅ Automatic token refresh  
✅ Rate limiting on all endpoints  
✅ Audit logging  

---

## 📊 API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/google-ad-manager/networks` | List networks |
| GET | `/google-ad-manager/report-types` | List advertised report types |
| POST | `/google-ad-manager/add-data-source` | Create connection |
| POST | `/google-ad-manager/sync/:dataSourceId` | Manual sync |
| GET | `/google-ad-manager/sync-status/:dataSourceId` | Get history |
| DELETE | `/google-ad-manager/data-source/:dataSourceId` | Delete source |

---

## ⏸️ Not in Current Release

- ❌ Separate Inventory/Orders schemas (currently mapped to Revenue)
- ❌ Pre-built GAM dashboard (use AI Data Modeler)
- ❌ GAM-specific export panel (use platform export)

---

## 🎯 Use Cases

### 1. Revenue Dashboard
**Goal:** Track daily revenue

**AI Data Modeler Query:**
```
"Show me total revenue by country for the last 30 days"
```

### 2. Ad Unit Optimization
**Goal:** Find top performers

**AI Data Modeler Query:**
```
"Which ad units have the highest revenue and CPM?"
```

### 3. Geographic Analysis
**Goal:** Identify markets

**AI Data Modeler Query:**
```
"Compare revenue across all countries, grouped by region"
```

---

## 📚 Documentation

- **Technical Documentation**: [`GOOGLE_AD_MANAGER_DOCUMENTATION.md`](./GOOGLE_AD_MANAGER_DOCUMENTATION.md)
- **Report Types**: [`GAM_REPORT_TYPES_REFERENCE.md`](./GAM_REPORT_TYPES_REFERENCE.md)
- **Troubleshooting**: [`GAM_TROUBLESHOOTING_GUIDE.md`](./GAM_TROUBLESHOOTING_GUIDE.md)

---

## ❓ FAQ

**Q: Why do Inventory/Orders behave like Revenue?**  
A: They are advertised in the UI but currently run the revenue query; separate schemas are not implemented. Device, ad unit, advertiser, and time series are implemented in the driver.

**Q: Can I sync hourly?**  
A: Yes. Hourly, daily, weekly, and manual schedules are supported; GAM is scheduler-eligible.

**Q: Can I set custom date ranges?**  
A: Yes. Start/end dates are optional and default to the last 30 days.

**Q: Where is the GAM dashboard?**  
A: Not included. Use AI Data Modeler to create custom dashboards.

---

**Document Version:** 3.0  
**Last Updated:** 2026-10-22  
**Status:** Current implementation
