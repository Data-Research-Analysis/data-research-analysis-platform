# Google Ad Manager Integration - Quick Reference

## 📋 Current Implementation

**Status:** ✅ Core features implemented (Simplified v1.0)  
**Report Types:** 2 (Revenue, Geography)  
**Sync Options:** Daily, Weekly, Manual  
**Date Range:** Last 30 days (preset)

---

## 🎯 What's Available

### Report Types
- **Revenue Report**: Impressions, clicks, revenue, CPM, CTR by ad unit and country
- **Geography Report**: Performance by country, region, city

### Sync Frequencies
- **Manual**: On-demand only
- **Daily**: Every day at 2:00 AM
- **Weekly**: Every Sunday at 2:00 AM

### Date Range
- **Last 30 Days**: Fixed preset (custom ranges in future release)

---

## 🔄 Setup Flow (5 Minutes)

```
Step 1: Navigate → Data Sources → "Add Data Source"
Step 2: Select "Google Ad Manager" → "Sign In with Google"
Step 3: Authorize and select your GAM network
Step 4: Configure:
        • Name: "Production Network Revenue"
        • Reports: Revenue, Geography (select one or both)
        • Sync: Daily, Weekly, or Manual
Step 5: Click "Connect & Sync Data"
Step 6: Data appears in AI Data Modeler
```

---

## 💾 Database Schema

**Schema Name:** `dra_google_ad_manager`

**Table Format:** `{report_type}_{network_id}`

**Examples:**
- `revenue_12345678`
- `geography_12345678`

**Column Naming:** Uses `{table_name}_{column_name}` format for special schema

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
| GET | `/api/google-ad-manager/networks` | List networks |
| POST | `/api/google-ad-manager/add-data-source` | Create connection |
| POST | `/api/google-ad-manager/sync/:id` | Manual sync |
| GET | `/api/google-ad-manager/sync-status/:id` | Get history |
| DELETE | `/api/google-ad-manager/:id` | Delete source |

---

## ⏸️ Not in Current Release

- ❌ Inventory, Orders, Device reports (planned)
- ❌ Custom date ranges (planned)
- ❌ Hourly sync (not implemented)
- ❌ Advanced sync configuration (removed)
- ❌ Admin dashboard (use AI Data Modeler)
- ❌ Ad unit filtering (planned)

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

- **Current Status**: [`CURRENT_IMPLEMENTATION_STATUS.md`](./CURRENT_IMPLEMENTATION_STATUS.md)
- **Implementation Plan**: [`GOOGLE_AD_MANAGER_IMPLEMENTATION_PLAN.md`](./GOOGLE_AD_MANAGER_IMPLEMENTATION_PLAN.md)
- **Troubleshooting**: [`GAM_TROUBLESHOOTING_GUIDE.md`](./GAM_TROUBLESHOOTING_GUIDE.md)

---

## ❓ FAQ

**Q: Why can't I select Inventory/Orders/Device reports?**  
A: Only Revenue and Geography are available in v1.0. Additional reports planned for future release.

**Q: Why can't I set hourly sync?**  
A: Hourly sync not available. Use Daily, Weekly, or Manual.

**Q: Where are custom date ranges?**  
A: Currently supports last 30 days only. Custom ranges planned for future.

**Q: Where is the GAM dashboard?**  
A: Not included. Use AI Data Modeler to create custom dashboards.

---

**Document Version:** 2.0 (Updated for Simplified Release)  
**Last Updated:** December 17, 2025  
**Status:** Current Implementation
