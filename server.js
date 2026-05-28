const http = require("http");
const fs = require("fs");
const path = require("path");

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const dataDir = path.join(rootDir, "data");
const seedPath = path.join(dataDir, "seed.json");
const dbPath = path.join(dataDir, "db.json");
const port = Number(process.env.PORT || 4182);

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function ensureDb(force = false) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (force || !fs.existsSync(dbPath)) {
    fs.copyFileSync(seedPath, dbPath);
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeDb(db) {
  db.meta = db.meta || {};
  db.meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function send(res, status, body, headers = jsonHeaders) {
  res.writeHead(status, headers);
  if (Buffer.isBuffer(body) || typeof body === "string") {
    res.end(body);
    return;
  }
  res.end(JSON.stringify(body));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function money(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  return Number(cleaned || 0);
}

function parseCsv(text) {
  const rows = [];
  let cell = "";
  let row = [];
  let quoted = false;
  const input = String(text || "").replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => normalizeHeader(header));
  return rows.slice(1).map((values) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = values[index] ?? "";
    });
    return item;
  });
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pick(row, keys, fallback = "") {
  for (const key of keys) {
    const normalized = normalizeHeader(key);
    if (row[normalized] !== undefined && row[normalized] !== "") return row[normalized];
  }
  return fallback;
}

function normalizeOrderStatus(value) {
  const text = normalizeHeader(value);
  if (["hoan", "hoan_hang", "returned", "return"].includes(text)) return "returned";
  if (["huy", "da_huy", "cancelled", "canceled", "cancel"].includes(text)) return "cancelled";
  return "delivered";
}

function normalizeCodStatus(value) {
  const text = normalizeHeader(value);
  if (["da_nhan", "received", "paid", "done"].includes(text)) return "received";
  return "pending";
}

function upsertBy(array, key, item) {
  const index = array.findIndex((entry) => String(entry[key]).toLowerCase() === String(item[key]).toLowerCase());
  if (index >= 0) {
    array[index] = { ...array[index], ...item };
    return "updated";
  }
  array.unshift(item);
  return "created";
}

function orderMath(order, product, adShare = 0) {
  const grossRevenue = order.status === "cancelled" ? 0 : money(order.salePrice) * money(order.quantity);
  const costOfGoods = order.status === "cancelled" ? 0 : money(product?.cost) * money(order.quantity);
  const returnLoss = order.status === "returned" ? costOfGoods + money(order.shippingFee) : 0;
  const netProfit =
    grossRevenue -
    costOfGoods -
    money(order.platformFee) -
    money(order.shippingFee) -
    money(order.discount) -
    money(adShare) -
    (order.status === "returned" ? grossRevenue : 0);
  return { grossRevenue, costOfGoods, returnLoss, netProfit };
}

function summarize(db) {
  const productsBySku = Object.fromEntries(db.products.map((product) => [product.sku, product]));
  const adBySku = new Map();
  const adByChannel = new Map();
  for (const ad of db.adCosts) {
    adBySku.set(ad.sku, money(adBySku.get(ad.sku)) + money(ad.amount));
    adByChannel.set(ad.channel, money(adByChannel.get(ad.channel)) + money(ad.amount));
  }

  const orderCountBySku = new Map();
  for (const order of db.orders) {
    if (order.status !== "cancelled") {
      orderCountBySku.set(order.sku, money(orderCountBySku.get(order.sku)) + 1);
    }
  }

  const enrichedOrders = db.orders.map((order) => {
    const product = productsBySku[order.sku];
    const adShare = money(adBySku.get(order.sku)) / Math.max(1, money(orderCountBySku.get(order.sku)));
    return {
      ...order,
      productName: product?.name || "Unknown product",
      unitCost: money(product?.cost),
      adShare,
      ...orderMath(order, product, adShare)
    };
  });

  const totals = enrichedOrders.reduce(
    (acc, order) => {
      acc.grossRevenue += order.grossRevenue;
      acc.costOfGoods += order.costOfGoods;
      acc.platformFees += money(order.platformFee);
      acc.shippingFees += money(order.shippingFee);
      acc.discounts += money(order.discount);
      acc.adSpend += order.adShare;
      acc.returnLoss += order.returnLoss;
      acc.netProfit += order.netProfit;
      acc.codPending += order.codStatus === "pending" && order.status !== "cancelled" ? order.grossRevenue : 0;
      acc.returned += order.status === "returned" ? 1 : 0;
      acc.cancelled += order.status === "cancelled" ? 1 : 0;
      return acc;
    },
    {
      grossRevenue: 0,
      costOfGoods: 0,
      platformFees: 0,
      shippingFees: 0,
      discounts: 0,
      adSpend: 0,
      returnLoss: 0,
      netProfit: 0,
      codPending: 0,
      returned: 0,
      cancelled: 0
    }
  );

  totals.orderCount = db.orders.length;
  totals.deliveredCount = db.orders.filter((order) => order.status === "delivered").length;
  totals.returnRate = totals.orderCount ? totals.returned / totals.orderCount : 0;
  totals.netMargin = totals.grossRevenue ? totals.netProfit / totals.grossRevenue : 0;

  const productMap = new Map();
  const channelMap = new Map();
  for (const order of enrichedOrders) {
    const product = productMap.get(order.sku) || {
      sku: order.sku,
      name: order.productName,
      units: 0,
      revenue: 0,
      netProfit: 0,
      returns: 0
    };
    product.units += order.status === "cancelled" ? 0 : money(order.quantity);
    product.revenue += order.grossRevenue;
    product.netProfit += order.netProfit;
    product.returns += order.status === "returned" ? 1 : 0;
    productMap.set(order.sku, product);

    const channel = channelMap.get(order.channel) || {
      channel: order.channel,
      orders: 0,
      revenue: 0,
      adSpend: money(adByChannel.get(order.channel)),
      netProfit: 0,
      codPending: 0,
      returns: 0
    };
    channel.orders += 1;
    channel.revenue += order.grossRevenue;
    channel.netProfit += order.netProfit;
    channel.codPending += order.codStatus === "pending" && order.status !== "cancelled" ? order.grossRevenue : 0;
    channel.returns += order.status === "returned" ? 1 : 0;
    channelMap.set(order.channel, channel);
  }

  const products = [...productMap.values()].map((product) => {
    const margin = product.revenue ? product.netProfit / product.revenue : 0;
    return {
      ...product,
      margin,
      status: product.netProfit < 0 ? "loss" : margin < 0.12 ? "thin" : "healthy"
    };
  });

  const channels = [...channelMap.values()].map((channel) => ({
    ...channel,
    margin: channel.revenue ? channel.netProfit / channel.revenue : 0
  }));

  const alerts = [];
  if (totals.netProfit < 0) alerts.push({ type: "danger", text: "Shop đang lỗ sau khi trừ giá vốn, ads, phí sàn, ship và hoàn hàng." });
  if (totals.codPending > totals.grossRevenue * 0.2) alerts.push({ type: "warning", text: "COD chưa đối soát đang cao. Nên chốt tiền về trước khi tăng ngân sách ads." });
  if (totals.returnRate > 0.08) alerts.push({ type: "warning", text: "Tỷ lệ hoàn trên 8%. Cần kiểm tra mô tả sản phẩm, tư vấn trước khi gửi và xác nhận COD." });
  for (const product of products.filter((item) => item.status === "loss")) {
    alerts.push({ type: "danger", text: `${product.name} đang lỗ. Cần xem lại giá bán, ads, voucher hoặc ship shop chịu.` });
  }
  if (!alerts.length) alerts.push({ type: "success", text: "Các chỉ số chính đang ổn. Tiếp tục theo dõi ads và COD chưa đối soát." });

  return {
    shop: db.shop || {},
    meta: db.meta,
    totals,
    products: products.sort((a, b) => b.netProfit - a.netProfit),
    channels: channels.sort((a, b) => b.revenue - a.revenue),
    orders: enrichedOrders.sort((a, b) => b.date.localeCompare(a.date)),
    alerts
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function ordersCsv(summary) {
  const headers = ["id", "date", "channel", "sku", "productName", "quantity", "grossRevenue", "costOfGoods", "platformFee", "shippingFee", "discount", "adShare", "status", "codStatus", "netProfit"];
  const rows = summary.orders.map((order) => headers.map((key) => csvEscape(Math.round(order[key] ?? 0) || order[key])).join(","));
  return [headers.join(","), ...rows].join("\n");
}

function markdownReport(summary) {
  const t = summary.totals;
  const lines = [
    `# Bao cao lai that - ${summary.shop?.name || "Shop"}`,
    "",
    `Generated: ${new Date().toLocaleString("en-US")}`,
    "",
    "## Tong quan",
    "",
    `- Doanh thu ghi nhan: ${Math.round(t.grossRevenue).toLocaleString("vi-VN")} VND`,
    `- Lai/lo that: ${Math.round(t.netProfit).toLocaleString("vi-VN")} VND`,
    `- Bien loi nhuan rong: ${(t.netMargin * 100).toFixed(1)}%`,
    `- COD chua doi soat: ${Math.round(t.codPending).toLocaleString("vi-VN")} VND`,
    `- Ty le hoan: ${(t.returnRate * 100).toFixed(1)}%`,
    "",
    "## Canh bao",
    "",
    ...summary.alerts.map((alert) => `- ${alert.text}`),
    "",
    "## Lai theo san pham",
    "",
    "| SKU | San pham | Doanh thu | Lai/lo | Bien |",
    "| --- | --- | ---: | ---: | ---: |",
    ...summary.products.map((p) => `| ${p.sku} | ${p.name} | ${Math.round(p.revenue).toLocaleString("vi-VN")} | ${Math.round(p.netProfit).toLocaleString("vi-VN")} | ${(p.margin * 100).toFixed(1)}% |`),
    "",
    "## Lai theo kenh",
    "",
    "| Kenh | Don | Doanh thu | COD treo | Lai/lo |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...summary.channels.map((c) => `| ${c.channel} | ${c.orders} | ${Math.round(c.revenue).toLocaleString("vi-VN")} | ${Math.round(c.codPending).toLocaleString("vi-VN")} | ${Math.round(c.netProfit).toLocaleString("vi-VN")} |`)
  ];
  return lines.join("\n");
}

function safeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const db = readDb();

  if (req.method === "GET" && url.pathname === "/api/summary") {
    return send(res, 200, summarize(db));
  }

  if (req.method === "GET" && url.pathname === "/api/data") {
    return send(res, 200, db);
  }

  if (req.method === "POST" && url.pathname === "/api/shop") {
    const body = JSON.parse(await collectBody(req) || "{}");
    db.shop = {
      ...(db.shop || {}),
      name: body.name || db.shop?.name || "Shop",
      owner: body.owner || "",
      category: body.category || "",
      currency: "VND",
      dataNote: body.dataNote || db.shop?.dataNote || ""
    };
    writeDb(db);
    return send(res, 200, db.shop);
  }

  if (req.method === "POST" && url.pathname === "/api/orders") {
    const body = JSON.parse(await collectBody(req) || "{}");
    const order = {
      id: body.id || safeId("ORD"),
      date: body.date || new Date().toISOString().slice(0, 10),
      channel: body.channel || "Manual",
      sku: body.sku,
      quantity: Number(body.quantity || 1),
      salePrice: Number(body.salePrice || 0),
      platformFee: Number(body.platformFee || 0),
      shippingFee: Number(body.shippingFee || 0),
      discount: Number(body.discount || 0),
      codStatus: body.codStatus || "pending",
      status: body.status || "delivered"
    };
    db.orders.unshift(order);
    writeDb(db);
    return send(res, 201, order);
  }

  if (req.method === "POST" && url.pathname === "/api/products") {
    const body = JSON.parse(await collectBody(req) || "{}");
    const product = {
      id: body.id || safeId("sku"),
      sku: body.sku,
      name: body.name,
      category: body.category || "General",
      cost: Number(body.cost || 0),
      targetMargin: Number(body.targetMargin || 0.25)
    };
    db.products.unshift(product);
    writeDb(db);
    return send(res, 201, product);
  }

  if (req.method === "POST" && url.pathname === "/api/ads") {
    const body = JSON.parse(await collectBody(req) || "{}");
    const ad = {
      id: body.id || safeId("ADS"),
      date: body.date || new Date().toISOString().slice(0, 10),
      channel: body.channel || "Manual",
      campaign: body.campaign || "Manual ad cost",
      amount: Number(body.amount || 0),
      sku: body.sku || ""
    };
    db.adCosts.unshift(ad);
    writeDb(db);
    return send(res, 201, ad);
  }

  if (req.method === "POST" && url.pathname === "/api/import/products") {
    const body = JSON.parse(await collectBody(req) || "{}");
    const rows = parseCsv(body.csv);
    let created = 0;
    let updated = 0;
    const errors = [];
    if (body.mode === "replace") db.products = [];

    rows.forEach((row, index) => {
      const sku = pick(row, ["sku", "ma_sku", "ma_hang", "ma_san_pham"]).trim();
      const name = pick(row, ["name", "ten_san_pham", "san_pham", "product"]).trim();
      if (!sku || !name) {
        errors.push(`Dong ${index + 2}: thieu SKU hoac ten san pham`);
        return;
      }
      const result = upsertBy(db.products, "sku", {
        id: `sku-${sku.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        sku,
        name,
        category: pick(row, ["category", "nganh_hang", "nhom_hang"], "General"),
        cost: money(pick(row, ["cost", "gia_von", "gia_nhap"], 0)),
        targetMargin: money(pick(row, ["target_margin", "bien_muc_tieu"], 0.25))
      });
      if (result === "created") created += 1;
      else updated += 1;
    });

    writeDb(db);
    return send(res, 200, { created, updated, errors });
  }

  if (req.method === "POST" && url.pathname === "/api/import/orders") {
    const body = JSON.parse(await collectBody(req) || "{}");
    const rows = parseCsv(body.csv);
    let created = 0;
    let updated = 0;
    const errors = [];
    if (body.mode === "replace") db.orders = [];

    rows.forEach((row, index) => {
      const sku = pick(row, ["sku", "ma_sku", "ma_hang", "ma_san_pham"]).trim();
      if (!sku) {
        errors.push(`Dong ${index + 2}: thieu SKU`);
        return;
      }
      const id = pick(row, ["id", "order_id", "ma_don", "ma_don_hang"], safeId("ORD"));
      const result = upsertBy(db.orders, "id", {
        id,
        date: pick(row, ["date", "ngay", "ngay_dat"], new Date().toISOString().slice(0, 10)),
        channel: pick(row, ["channel", "kenh", "kenh_ban"], "Nhap tay"),
        sku,
        quantity: money(pick(row, ["quantity", "qty", "so_luong", "sl"], 1)),
        salePrice: money(pick(row, ["sale_price", "gia_ban", "don_gia"], 0)),
        platformFee: money(pick(row, ["platform_fee", "phi_san", "phi"], 0)),
        shippingFee: money(pick(row, ["shipping_fee", "ship_shop_chiu", "phi_ship"], 0)),
        discount: money(pick(row, ["discount", "giam_gia", "voucher"], 0)),
        codStatus: normalizeCodStatus(pick(row, ["cod_status", "cod", "doi_soat"], "pending")),
        status: normalizeOrderStatus(pick(row, ["status", "trang_thai", "trang_thai_don"], "delivered"))
      });
      if (result === "created") created += 1;
      else updated += 1;
    });

    writeDb(db);
    return send(res, 200, { created, updated, errors });
  }

  if (req.method === "POST" && url.pathname === "/api/import/ads") {
    const body = JSON.parse(await collectBody(req) || "{}");
    const rows = parseCsv(body.csv);
    let created = 0;
    let updated = 0;
    const errors = [];
    if (body.mode === "replace") db.adCosts = [];

    rows.forEach((row, index) => {
      const sku = pick(row, ["sku", "ma_sku", "ma_hang", "ma_san_pham"]).trim();
      const amount = money(pick(row, ["amount", "chi_phi", "ad_spend", "tien_ads"], 0));
      if (!sku || !amount) {
        errors.push(`Dong ${index + 2}: thieu SKU hoac chi phi ads`);
        return;
      }
      const id = pick(row, ["id", "ads_id", "ma_chien_dich"], safeId("ADS"));
      const result = upsertBy(db.adCosts, "id", {
        id,
        date: pick(row, ["date", "ngay"], new Date().toISOString().slice(0, 10)),
        channel: pick(row, ["channel", "kenh", "kenh_ads"], "Manual"),
        campaign: pick(row, ["campaign", "chien_dich", "ten_chien_dich"], "Chi phi ads"),
        amount,
        sku
      });
      if (result === "created") created += 1;
      else updated += 1;
    });

    writeDb(db);
    return send(res, 200, { created, updated, errors });
  }

  if (req.method === "POST" && url.pathname === "/api/reset") {
    ensureDb(true);
    return send(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/export/orders.csv") {
    return send(res, 200, ordersCsv(summarize(db)), { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=so-lai-orders.csv" });
  }

  if (req.method === "GET" && url.pathname === "/api/export/report.md") {
    return send(res, 200, markdownReport(summarize(db)), { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": "attachment; filename=bao-cao-lai-that.md" });
  }

  return send(res, 404, { error: "Not found" });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(publicDir, requestPath));
  if (!filePath.startsWith(publicDir)) return send(res, 403, "Forbidden", { "Content-Type": "text/plain" });
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, "Not found", { "Content-Type": "text/plain" });

  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg"
  };
  send(res, 200, fs.readFileSync(filePath), { "Content-Type": types[ext] || "application/octet-stream" });
}

if (process.argv.includes("--seed")) {
  ensureDb(true);
  console.log(`Seeded ${dbPath}`);
  process.exit(0);
}

ensureDb();

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res).catch((error) => send(res, 500, { error: error.message }));
  } else {
    serveStatic(req, res);
  }
});

server.listen(port, () => {
  console.log(`So Lai running at http://127.0.0.1:${port}`);
});
