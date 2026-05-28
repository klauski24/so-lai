const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

const compactCurrency = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1
});

const state = {
  data: null,
  summary: null
};

const statusLabels = {
  delivered: "Đã giao",
  returned: "Hoàn hàng",
  cancelled: "Đã hủy",
  received: "Đã nhận",
  pending: "Chưa nhận",
  loss: "lỗ",
  thin: "mỏng",
  healthy: "ổn"
};

const csvTemplates = {
  products: [
    "sku,name,category,cost,target_margin",
    "AO-THUN-01,Ao thun basic,Thoi trang,65000,0.3",
    "SON-01,Son kem mini,My pham,72000,0.28"
  ].join("\n"),
  orders: [
    "id,date,channel,sku,quantity,sale_price,platform_fee,shipping_fee,discount,cod_status,status",
    "DH001,2026-05-20,Shopee,AO-THUN-01,2,129000,18000,15000,10000,received,delivered",
    "DH002,2026-05-21,TikTok Shop,SON-01,1,149000,16000,12000,0,pending,delivered"
  ].join("\n"),
  ads: [
    "id,date,channel,campaign,sku,amount",
    "ADS001,2026-05-20,TikTok Shop,Live 20/5,SON-01,250000",
    "ADS002,2026-05-21,Shopee,Search Ads,AO-THUN-01,120000"
  ].join("\n")
};

function formatMoney(value) {
  return currency.format(Math.round(Number(value || 0)));
}

function formatShortMoney(value) {
  return `${compactCurrency.format(Math.round(Number(value || 0)))} VND`;
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function classForNumber(value) {
  return Number(value) < 0 ? "negative" : "positive";
}

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function load() {
  const [data, summary] = await Promise.all([api("/api/data"), api("/api/summary")]);
  state.data = data;
  state.summary = summary;
  render();
}

function renderShop() {
  const shop = state.data.shop || {};
  document.querySelector("#shopTitle").textContent = shop.name ? `Thông tin shop: ${shop.name}` : "Thông tin shop";
  document.querySelector("#shopMeta").textContent = [shop.category, shop.owner ? `phụ trách: ${shop.owner}` : ""].filter(Boolean).join(" - ") || "Thiết lập shop trước, sau đó nhập đơn hàng và chi phí.";
  document.querySelector("#shopName").value = shop.name || "";
  document.querySelector("#shopOwner").value = shop.owner || "";
  document.querySelector("#shopCategory").value = shop.category || "";
}

function renderMetrics() {
  const { totals } = state.summary;
  document.querySelector("#grossRevenue").textContent = formatMoney(totals.grossRevenue);
  document.querySelector("#netProfit").textContent = formatMoney(totals.netProfit);
  document.querySelector("#netProfit").className = classForNumber(totals.netProfit);
  document.querySelector("#netMargin").textContent = formatPercent(totals.netMargin);
  document.querySelector("#codPending").textContent = formatMoney(totals.codPending);
  document.querySelector("#returnRate").textContent = formatPercent(totals.returnRate);
}

function renderChannels() {
  const container = document.querySelector("#channelBars");
  const maxRevenue = Math.max(...state.summary.channels.map((channel) => channel.revenue), 1);
  container.innerHTML = state.summary.channels
    .map((channel) => {
      const width = Math.max(4, (channel.revenue / maxRevenue) * 100);
      return `
        <div class="bar-row">
          <div class="bar-label">${channel.channel}</div>
          <div class="bar-track" aria-label="${channel.channel} revenue">
            <div class="bar-fill" style="width:${width}%"></div>
          </div>
          <div class="bar-value">${formatShortMoney(channel.revenue)}</div>
        </div>
        <div class="bar-row">
          <div class="bar-label"></div>
          <div class="muted">Lãi ${formatMoney(channel.netProfit)} - COD treo ${formatMoney(channel.codPending)} - Hoàn ${channel.returns}</div>
          <div class="bar-value">${formatPercent(channel.margin)}</div>
        </div>
      `;
    })
    .join("");
}

function renderAlerts() {
  document.querySelector("#alerts").innerHTML = state.summary.alerts
    .map((alert) => `<div class="alert ${alert.type}">${alert.text}</div>`)
    .join("");
}

function renderProducts() {
  document.querySelector("#productsBody").innerHTML = state.summary.products
    .map(
      (product) => `
      <tr>
        <td><strong>${product.sku}</strong></td>
        <td>${product.name}</td>
        <td class="numeric">${product.units}</td>
        <td class="numeric">${formatMoney(product.revenue)}</td>
        <td class="numeric ${classForNumber(product.netProfit)}">${formatMoney(product.netProfit)}</td>
        <td class="numeric">${formatPercent(product.margin)}</td>
        <td><span class="pill ${product.status}">${statusLabels[product.status]}</span></td>
      </tr>
    `
    )
    .join("");
}

function renderOrders() {
  document.querySelector("#ordersBody").innerHTML = state.summary.orders
    .map(
      (order) => `
      <tr>
        <td><strong>${order.id}</strong></td>
        <td>${order.date}</td>
        <td>${order.channel}</td>
        <td>${order.productName}</td>
        <td class="numeric">${formatMoney(order.grossRevenue)}</td>
        <td class="numeric">${formatMoney(order.costOfGoods)}</td>
        <td class="numeric">${formatMoney(order.adShare)}</td>
        <td><span class="pill">${statusLabels[order.status] || order.status}</span></td>
        <td><span class="pill ${order.codStatus === "pending" ? "thin" : "healthy"}">${statusLabels[order.codStatus] || order.codStatus}</span></td>
        <td class="numeric ${classForNumber(order.netProfit)}">${formatMoney(order.netProfit)}</td>
      </tr>
    `
    )
    .join("");
}

function renderSkuSelect() {
  const select = document.querySelector("#skuSelect");
  const current = select.value;
  select.innerHTML = state.data.products
    .map((product) => `<option value="${product.sku}">${product.sku} - ${product.name}</option>`)
    .join("");
  if (current) select.value = current;
}

function render() {
  renderShop();
  renderMetrics();
  renderChannels();
  renderAlerts();
  renderProducts();
  renderOrders();
  renderSkuSelect();
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

document.querySelector("#shopForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/shop", {
    method: "POST",
    body: JSON.stringify(formToObject(event.currentTarget))
  });
  await load();
});

document.querySelector("#orderForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  await api("/api/orders", {
    method: "POST",
    body: JSON.stringify(formToObject(form))
  });
  form.reset();
  form.elements.date.value = new Date().toISOString().slice(0, 10);
  await load();
});

document.querySelectorAll(".template-button").forEach((button) => {
  button.addEventListener("click", () => {
    const form = button.closest(".import-card");
    form.elements.csv.value = csvTemplates[button.dataset.template];
  });
});

document.querySelectorAll(".csv-file").forEach((input) => {
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const form = input.closest(".import-card");
    form.elements.csv.value = await file.text();
  });
});

document.querySelectorAll(".import-card").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const type = form.dataset.import;
    const result = form.querySelector(".import-result");
    result.textContent = "Đang nhập...";
    try {
      const response = await api(`/api/import/${type}`, {
        method: "POST",
        body: JSON.stringify({
          csv: form.elements.csv.value,
          mode: form.elements.replace.checked ? "replace" : "append"
        })
      });
      const errorText = response.errors?.length ? ` Lỗi: ${response.errors.join("; ")}` : "";
      result.textContent = `Đã thêm ${response.created}, cập nhật ${response.updated}.${errorText}`;
      await load();
    } catch (error) {
      result.textContent = `Không nhập được: ${error.message}`;
    }
  });
});

document.querySelector("#resetButton").addEventListener("click", async () => {
  await api("/api/reset", { method: "POST", body: "{}" });
  await load();
});

document.querySelector("#orderForm").elements.date.value = new Date().toISOString().slice(0, 10);
load().catch((error) => {
  document.body.innerHTML = `<main><section class="panel"><h1>Sổ Lãi không tải được</h1><p>${error.message}</p></section></main>`;
});
