(function () {
  // 1. 单机模式：不依赖 bitable，只画一张默认地图（用于浏览器测试 / 兜底）
  function initStandaloneMap(label) {
    console.log("Init standalone Leaflet map:", label);

    const center = [41.9, 12.5]; // 意大利附近
    const map = L.map("map").setView(center, 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    L.marker(center)
      .addTo(map)
      .bindPopup(label || "Leaflet Standalone Map")
      .openPopup();
  }

  // 2. 检查是否有飞书 bitable 环境
  const sdk = window["@lark-base-open/js-sdk"];
  if (!sdk || !sdk.bitable) {
    // 不在飞书 Base 里，或者 SDK 没注入，走单机模式
    initStandaloneMap("No bitable SDK, standalone mode");
    return;
  }

  const { bitable } = sdk;

  // 3. 在飞书 Base 环境中的主逻辑
  (async () => {
    try {
      console.log("Waiting for bitable.base.ready()...");
      await bitable.base.ready();
      console.log("bitable.base.ready() done.");

      const table = await bitable.base.getActiveTable();
      const view = await table.getActiveView();
      const fields = await table.getFieldList();

      // TODO: 如果你的字段名不是“门店名称”和“位置”，这里改成你的真实字段名
      const nameField = fields.find((f) => f.name === "门店名称");
      const locField = fields.find((f) => f.name === "位置"); // 位置字段（带经纬度）

      if (!nameField || !locField) {
        console.error("字段未找到", { nameField, locField, fields });
        alert("请确认表中存在字段：门店名称 和 位置（位置字段）");
        // 即使字段不对，也画一张兜底地图
        initStandaloneMap("字段未找到，使用兜底地图");
        return;
      }

      const { records } = await view.getRecords({ pageSize: 500 });

      const points = [];
      for (const r of records) {
        const name = r.fields[nameField.id];
        const loc = r.fields[locField.id];

        if (
          loc &&
          typeof loc.latitude === "number" &&
          typeof loc.longitude === "number"
        ) {
          points.push({
            name: name || "未命名",
            lat: loc.latitude,
            lng: loc.longitude,
          });
        }
      }

      let center = [41.9, 12.5];
      if (points.length > 0) {
        center = [points[0].lat, points[0].lng];
      }

      const map = L.map("map").setView(center, 6);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      points.forEach((p) => {
        L.marker([p.lat, p.lng]).addTo(map).bindPopup(p.name);
      });

      if (points.length > 1) {
