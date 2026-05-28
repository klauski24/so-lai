---
title: I Built Sổ Lãi, a Practical Profit Tracker for Vietnamese Online Shops
published: false
tags: devchallenge, githubchallenge, webdev, productivity
---

*This is a submission for the [GitHub Finish-Up-A-Thon Challenge](https://dev.to/challenges/github-2026-05-21)*

## What I Built

I built **So Lai**, a local-first profit tracker for small online shops in Vietnam.

The goal is simple: help a seller answer the question they often cannot answer from platform revenue alone:

> Is my shop actually profitable after product cost, marketplace fees, shipping subsidies, discounts, ad spend, returns, and pending COD?

So Lai is not trying to be a full POS, CRM, or inventory suite. It focuses on the painful middle layer that many small sellers still manage through scattered spreadsheets:

- Product cost by SKU
- Orders from Shopee, TikTok Shop, Facebook, Zalo, or livestream sales
- Platform fees, shipping cost, vouchers, and discounts
- Ad spend by channel and SKU
- Return/cancellation status
- COD received vs. pending
- Net profit by order, product, and sales channel

The app runs locally with Node.js and JSON storage, so it does not require paid APIs or cloud setup.

GitHub repo: https://github.com/klauski24/so-lai

## Demo

Run locally:

```powershell
git clone https://github.com/klauski24/so-lai.git
cd so-lai
npm start
```

Open:

```text
http://127.0.0.1:4182
```

What the demo shows:

- A Vietnamese-language dashboard called **Sổ Lãi**
- Shop profile setup
- Clear explanation of where the numbers come from
- CSV import for products, orders, and ad costs
- Manual order entry
- Profit analysis by channel and SKU
- Alerts for loss-making products, high COD pending, and high return rate
- CSV and Markdown report export

Screenshots are included in the repository:

- `so-lai-desktop.png`
- `so-lai-mobile.png`

## The Comeback Story

The first version was too vague.

It started as an English-named dashboard called **ProfitLens**. It had some useful calculations, but it did not feel practical yet. The biggest problems were:

- The app used Vietnamese currency but had an English product name.
- There was no place to define the shop.
- It was not clear where the data should come from.
- The dashboard looked like a demo, not something a seller could actually use.

I reworked the project into **So Lai**, a more grounded tool for Vietnamese sellers.

The before/after arc became:

- Before: a generic dashboard with sample data
- After: a local-first shop profit workbook with shop setup, CSV import, real data source guidance, and exportable reports

The most important improvement was adding a realistic input workflow. A shop can now start with CSV files exported or copied from tools they already use:

- Marketplace order reports
- Product cost spreadsheets
- Ads manager exports
- COD reconciliation records

That made the project feel much closer to a real small-business workflow.

## What Changed

I finished the project by adding:

- Vietnamese branding and UI copy
- Shop profile fields
- CSV import endpoints for products, orders, and ad costs
- CSV paste and file upload UI
- Template CSV examples inside the app
- Order-level profit calculations
- Product-level and channel-level summaries
- COD pending tracking
- Return/cancellation handling
- Markdown report export
- README with a practical workflow for real shop data
- Desktop and mobile screenshots

The current data model is intentionally small:

```text
shop
products
orders
adCosts
```

That kept the app focused and usable instead of turning it into another oversized management system.

## My Experience with GitHub Copilot

GitHub Copilot helped me move from idea to finished MVP quickly.

It was especially useful for:

- Designing the CSV import workflow
- Building the product/order/ad cost data model
- Writing practical profit calculations
- Refactoring the UI copy from a generic English dashboard into a Vietnamese seller-focused tool
- Creating sample CSV formats
- Improving the README so another person can actually run and test the project

The best part was using Copilot as an iteration partner. The project improved when I kept asking whether the tool was realistic enough for an actual seller, not just whether the code worked.

## What I Learned

The biggest lesson: a business tool is not useful just because it has charts.

It becomes useful when the user can answer:

- Where do I put my real data?
- What format does the data need?
- What decision does this dashboard help me make?

For So Lai, the answer is:

- Put in products, orders, COD status, and ads through CSV.
- Use the dashboard to find products and channels that are secretly losing money.
- Export the result as a report for monthly review.

## What's Next

The next practical step is preset imports for real platform exports:

- Shopee order CSV mapping
- TikTok Shop order CSV mapping
- Facebook/Zalo manual order templates
- COD reconciliation import

After that, I would add a monthly comparison view so sellers can see whether changes in pricing, voucher strategy, or ad spend actually improved profit.

Thanks for reading!
