(function () {
  // -------- 1. 兜底模式：不依赖 Lark，直接画一张地图 --------
  function initStandaloneMap(label) {
    console.log("Init standalone Leaflet map:", label);

    var center = [41.9, 12.5]; // 意大利附近
    var map = L.map("map").setView(center, 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    L.marker(center)
      .addTo(map)
      .bindPopup(label || "Leaflet Standalone Map")
      .openPopup();
  }

  // -------- 2. 检查 Lark bitable SDK 是否存在 --------
  var sdk = window["@lark-base-open/js-sdk"];
  if (!sdk || !sdk.bitable) {
    // 不在飞书 Base 里，或者 SDK 没加载成功：直接画兜底地图
    initStandaloneMap("没有 bitable 环境，单机模式");
    return;
  }

  var bitable = sdk.bitable;

  // -------- 3. 在 Lark Base 环境中的主逻辑 --------
  (async function () {
    try {
      console.log("Waiting for bitable.base.ready()...");
      await bitable.base.ready();
      console.log("bitable.base.ready() done.");

      var table = await bitable.base.getActiveTable();
      var view = await table.getActiveView();
      var fields = await table.getFieldList();

      // ⚠️ 如果你的字段名不同，请改成你自己的
      var nameField = fields.find(function (f) {
        return f.name === "门店名称";
      });
      var locField = fields.find(function (f) {
        return f.name === "位置"; // 位置字段（带经纬度）
      });

      if (!nameField || !locField) {
        console.error("字段未找到", { nameField: nameField, locField: locField, fields: fields });
        alert("请确认表中存在字段：门店名称 和 位置（位置字段）");
        initStandaloneMap("字段未找到，兜底地图");
        return;
      }

      var result = await view.getRecords({ pageSize: 500 });
      var records = result.records || [];

      var points = [];
      records.forEach(function (r) {
        var name = r.fields[nameField.id];
        var loc = r.fields[locField.id];

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
      });

      var center = [41.9, 12.5];
      if (points.length > 0) {
        center = [points[0].lat, points[0].lng];
      }

      var map = L.map("map").setView(center, 6);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      points.forEach(function (p) {
        L.marker([p.lat, p.lng]).addTo(map).bindPopup(p.name);
      });

      if (points.length > 1) {
        var bounds = L.latLngBounds(
          points.map(function (p) {
            return [p.lat, p.lng];
          })
        );
        map.fitBounds(bounds, { padding: [20, 20] });
      }

      console.log("Map initialized with", points.length, "points.");
    } catch (err) {
      console.error("Init map in Lark failed, fallback to standalone map:", err);
      initStandaloneMap("bitable 初始化失败，兜底地图");
    }
  })();
})();
