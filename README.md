# Sổ Lãi

Sổ Lãi là công cụ local-first giúp shop online nhỏ ở Việt Nam biết **lãi thật** sau khi trừ giá vốn, phí sàn, ship shop chịu, voucher/giảm giá, quảng cáo, hoàn hàng và COD chưa đối soát.

Đây không phải website giới thiệu, CRM hay POS đầy đủ. MVP chỉ tập trung vào một câu hỏi thực tế:

```text
Shop tháng này thật sự lời hay lỗ?
```

## Số liệu lấy từ đâu?

Ứng dụng không tự bịa số. Chủ shop cần nhập tay hoặc nhập từ các file báo cáo đang có:

- Báo cáo đơn hàng từ Shopee, TikTok Shop, Facebook, Zalo hoặc file chốt livestream.
- Giá vốn từng SKU từ file nhập hàng, sổ kho hoặc hóa đơn nhập hàng.
- Phí sàn, phí thanh toán, voucher, ship shop chịu từ báo cáo sàn.
- Chi phí quảng cáo từ TikTok Ads, Shopee Ads, Facebook Ads.
- COD đã nhận/chưa nhận từ đơn vị vận chuyển, sàn hoặc sao kê ngân hàng.
- Trạng thái đơn: đã giao, hoàn hàng, đã hủy.

Bản hiện tại có form nhập đơn thủ công để chứng minh workflow. Bước tiếp theo hợp lý là thêm import CSV cho từng mẫu file Shopee/TikTok.

## Tính năng MVP

- Thiết lập thông tin shop: tên shop, chủ shop, ngành hàng.
- Import CSV cho sản phẩm/giá vốn, đơn hàng và chi phí quảng cáo.
- Dashboard doanh thu, lãi/lỗ thật, biên lãi ròng, COD treo, tỷ lệ hoàn.
- Phân tích lãi theo kênh bán.
- Phân tích lãi theo SKU/sản phẩm.
- Cảnh báo sản phẩm đang lỗ, COD treo cao, tỷ lệ hoàn cao.
- Nhập đơn hàng thủ công.
- Xuất CSV đơn hàng.
- Xuất báo cáo Markdown.
- Chạy local, không cần tài khoản, không cần API trả phí.

## Quy trình dùng thật cho một shop

1. Vào app và điền **Thông tin shop**.
2. Chuẩn bị file sản phẩm từ Excel hoặc sổ kho:

```csv
sku,name,category,cost,target_margin
AO-THUN-01,Ao thun basic,Thoi trang,65000,0.3
SON-01,Son kem mini,My pham,72000,0.28
```

3. Chuẩn bị file đơn hàng từ báo cáo sàn hoặc bảng chốt đơn:

```csv
id,date,channel,sku,quantity,sale_price,platform_fee,shipping_fee,discount,cod_status,status
DH001,2026-05-20,Shopee,AO-THUN-01,2,129000,18000,15000,10000,received,delivered
DH002,2026-05-21,TikTok Shop,SON-01,1,149000,16000,12000,0,pending,delivered
```

4. Chuẩn bị file chi phí ads:

```csv
id,date,channel,campaign,sku,amount
ADS001,2026-05-20,TikTok Shop,Live 20/5,SON-01,250000
ADS002,2026-05-21,Shopee,Search Ads,AO-THUN-01,120000
```

5. Chọn file CSV hoặc dán từng CSV vào app. Nếu muốn dùng dữ liệu thật thay dữ liệu demo, tick **Xóa dữ liệu cũ trước khi nhập**.
6. Xem dashboard để biết SKU/kênh nào đang lỗ, COD nào còn treo, tỷ lệ hoàn có cao không.
7. Xuất báo cáo Markdown hoặc CSV để lưu lại theo tháng.

## Cột CSV được hỗ trợ

Sản phẩm:

```text
sku, name, category, cost, target_margin
```

Đơn hàng:

```text
id, date, channel, sku, quantity, sale_price, platform_fee, shipping_fee, discount, cod_status, status
```

Chi phí ads:

```text
id, date, channel, campaign, sku, amount
```

`cod_status` dùng `received` hoặc `pending`. `status` dùng `delivered`, `returned`, hoặc `cancelled`.

## Cách chạy

```powershell
cd "C:\Users\Administrator\Documents\Codex\thon"
npm start
```

Mở:

```text
http://127.0.0.1:4182
```

Reset dữ liệu demo:

```powershell
npm run seed
```

## Data model

- `shop`: thông tin shop.
- `products`: SKU, tên sản phẩm, ngành hàng, giá vốn, biên mục tiêu.
- `orders`: kênh bán, SKU, số lượng, giá bán, phí sàn, ship, giảm giá, COD, trạng thái đơn.
- `adCosts`: chi phí quảng cáo theo chiến dịch, kênh và SKU.

Runtime database nằm ở `data/db.json` và được ignore khỏi Git. Dữ liệu demo nằm ở `data/seed.json`.

## Vì sao thực tế?

Nhiều shop nhỏ nhìn doanh thu trên sàn nhưng không biết lãi thật vì dữ liệu nằm rải rác: báo cáo đơn hàng, đối soát COD, chi phí ads, giá vốn và hoàn hàng. Sổ Lãi gom các phần đó vào một bảng tính vận hành đơn giản để chủ shop ra quyết định: tăng ads, dừng SKU lỗ, giảm voucher, siết COD hay đổi giá bán.
