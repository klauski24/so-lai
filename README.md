# ProfitLens

ProfitLens is a local-first profit dashboard for small online sellers. It helps sellers understand real profit after product cost, platform fees, shipping subsidies, discounts, ad spend, COD status, cancellations, and returns.

The app is built for small shops selling across TikTok Shop, Shopee, Facebook, Zalo, livestreams, and manual COD flows. It focuses on one practical question: is the shop actually profitable after all hidden costs?

## Features

- Real profit dashboard with revenue, net profit, margin, COD pending, and return rate.
- Product-level profit analysis with loss and thin-margin flags.
- Channel comparison for TikTok Shop, Shopee, Facebook, Zalo, and manual sales.
- COD pending tracker to show unreconciled delivered orders.
- Return and cancellation handling in profit calculations.
- Manual order entry for fast testing.
- CSV export for orders.
- Markdown export for monthly reporting.
- Local JSON storage with seed/reset flow.

## Why This Exists

Vietnamese social commerce and e-commerce are growing quickly, but many small sellers still manage cost, COD, ads, and return data in scattered spreadsheets. Revenue can look healthy while true margin is negative.

ProfitLens keeps the MVP narrow: it is not a full POS, CRM, or inventory system. It is a profit visibility tool.

## Run Locally

```powershell
cd "C:\Users\Administrator\Documents\Codex\thon"
npm start
```

Open:

```text
http://127.0.0.1:4182
```

Reset demo data:

```powershell
npm run seed
```

## Data Model

- `products`: SKU, product name, category, unit cost, target margin.
- `orders`: channel, SKU, quantity, sale price, platform fee, shipping fee, discount, COD status, delivery status.
- `adCosts`: campaign-level ad spend assigned to a SKU and channel.

Runtime data is stored in `data/db.json`, which is intentionally ignored by Git. The demo seed lives in `data/seed.json`.

## MVP Scope

This version intentionally avoids paid APIs and platform integrations. Sellers can enter data manually or adapt exports later. The next practical step would be importing Shopee/TikTok CSV files and mapping columns to ProfitLens fields.
