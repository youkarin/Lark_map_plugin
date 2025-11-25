(async () => {
  const { bitable } = window['@lark-base-open/js-sdk'];

  // 等飞书 Base 环境准备好
  await bitable.base.ready();

  // 1. 获取当前 Base 的表和视图
  const table = await bitable.base.getActiveTable();
  const view = await table.getActiveView();
  const fields = await table.getFieldList();

  // TODO: 如果你的字段名不是“门店名称”和“位置”，就在这里改
  const nameField = fields.find((f) => f.name === "门店名称");
  const locField = fields.find((f) => f.name === "位置"); // 位置字段（带经纬度）

  if (!nameField || !locField) {
    alert("请确认表中存在字段：门店名称 和 位置（位置字段）");
    console.error("字段未找到", { nameField, locField, fields });
    return;
  }

  // 2. 读取视图中的记录（示例：最多 500 条）
  const { records } = await view.getRecords({ pageSize: 500 });

  const points = [];

  for (const r of records) {
    const name = r.fields[nameField.id];
    const loc = r.fields[locField.id];

    // 飞书位置字段一般包含 latitude / longitude
    if (loc && typeof loc.latitude === "number" && typeof loc.longitude === "number") {
      points.push({
        name: name || "未命名",
        lat: loc.latitude,
        lng: loc.longitude,
      });
    }
  }

  // 3. 初始化 Leaflet 地图
  let center = [41.9, 12.5]; // 默认意大利附近
  if (points.length > 0) {
    center = [points[0].lat, points[0].lng];
  }

  const map = L.map("map").setView(center, 6);

  // OpenStreetMap 底图（完全免费）
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // 4. 在地图上添加图钉
  points.forEach((p) => {
    L.marker([p.lat, p.lng])
      .addTo(map)
      .bindPopup(p.name);
  });

  // 5. 自动缩放到所有点
  if (points.length > 1) {
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [20, 20] });
  }
})();
