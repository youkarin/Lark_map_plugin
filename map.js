(function () {
  // ------------ 0. 一些全局变量 ------------
  var leafletMap = null;
  var markersLayer = null;

  var tableSelect = document.getElementById("tableSelect");
  var viewSelect = document.getElementById("viewSelect");
  var nameFieldSelect = document.getElementById("nameFieldSelect");
  var locFieldSelect = document.getElementById("locFieldSelect");
  var loadBtn = document.getElementById("loadBtn");
  var statusEl = document.getElementById("status");

  // ------------ 1. 兜底模式：没有 bitable 环境时画一张地图 ------------
  function initStandaloneMap(label) {
    console.log("Init standalone Leaflet map:", label);

    var center = [41.9, 12.5]; // 意大利附近
    leafletMap = L.map("map").setView(center, 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(leafletMap);

    markersLayer = L.layerGroup().addTo(leafletMap);

    L.marker(center)
      .addTo(markersLayer)
      .bindPopup(label || "Leaflet Standalone Map")
      .openPopup();

    if (statusEl) {
      statusEl.textContent = label || "单机模式";
    }
  }

  // ------------ 2. 创建 / 重建地图 ------------
  function initMap(center) {
    if (!center) {
      center = [41.9, 12.5];
    }

    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
      markersLayer = null;
    }

    leafletMap = L.map("map").setView(center, 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(leafletMap);

    markersLayer = L.layerGroup().addTo(leafletMap);
  }

  function renderPoints(points) {
    if (!leafletMap || !markersLayer) {
      initMap(points.length > 0 ? [points[0].lat, points[0].lng] : null);
    }

    markersLayer.clearLayers();

    points.forEach(function (p) {
      L.marker([p.lat, p.lng]).addTo(markersLayer).bindPopup(p.name);
    });

    if (points.length > 1) {
      var bounds = L.latLngBounds(
        points.map(function (p) {
          return [p.lat, p.lng];
        })
      );
      leafletMap.fitBounds(bounds, { padding: [20, 20] });
    } else if (points.length === 1) {
      leafletMap.setView([points[0].lat, points[0].lng], 10);
    }
  }

  // ------------ 3. 检查 Lark bitable SDK 是否存在 ------------
  var sdk = window["@lark-base-open/js-sdk"];
  if (!sdk || !sdk.bitable) {
    initStandaloneMap("没有 bitable 环境，单机模式");
    return;
  }

  var bitable = sdk.bitable;

  // ------------ 4. 主逻辑：在 Lark Base 环境中运行 ------------
  (async function () {
    try {
      if (statusEl) statusEl.textContent = "等待 bitable 环境...";

      await bitable.base.ready();
      console.log("bitable.base.ready() done.");

      var base = bitable.base;

      // 4.1 获取表列表，填充表下拉
      var tableMetaList = await base.getTableMetaList();
      tableMetaList.forEach(function (meta, idx) {
        var opt = document.createElement("option");
        opt.value = meta.id;
        opt.textContent = meta.name;
        tableSelect.appendChild(opt);
      });

      if (tableMetaList.length === 0) {
        if (statusEl) statusEl.textContent = "当前多维表格下没有数据表";
        initStandaloneMap("没有数据表，兜底地图");
        return;
      }

      // 4.2 监听表变化，加载视图和字段
      tableSelect.addEventListener("change", function () {
        var tableId = tableSelect.value;
        if (!tableId) return;
        loadViewsAndFields(base, tableId);
      });

      // 默认选中第一个表，并加载其视图和字段
      tableSelect.value = tableMetaList[0].id;
      await loadViewsAndFields(base, tableMetaList[0].id);

      // 4.3 点击“加载”按钮时，从选中的表/视图/字段读取数据并打点
      loadBtn.addEventListener("click", async function () {
        var tableId = tableSelect.value;
        var viewId = viewSelect.value;
        var nameFieldId = nameFieldSelect.value;
        var locFieldId = locFieldSelect.value;

        if (!tableId || !viewId || !nameFieldId || !locFieldId) {
          alert("请先选择 表 / 视图 / 名称字段 / 位置字段");
          return;
        }

        if (statusEl) statusEl.textContent = "读取数据中...";
        try {
          var table = await base.getTableById(tableId);
          var view = await table.getViewById(viewId);

          var res = await view.getRecords({ pageSize: 2000 });
          var records = res.records || [];

          var points = [];
          records.forEach(function (r) {
            var nameVal = r.fields[nameFieldId];
            var loc = r.fields[locFieldId];

            if (
              loc &&
              typeof loc.latitude === "number" &&
              typeof loc.longitude === "number"
            ) {
              points.push({
                name: nameVal || "未命名",
                lat: loc.latitude,
                lng: loc.longitude,
              });
            }
          });

          if (points.length === 0) {
            if (statusEl) statusEl.textContent = "没有有效位置数据，请确认位置字段是否为“位置”类型并有值";
          } else {
            if (statusEl)
              statusEl.textContent = "已加载 " + points.length + " 个点位";
          }

          renderPoints(points);
        } catch (e) {
          console.error("加载记录失败", e);
          if (statusEl) statusEl.textContent = "加载记录失败：" + e.message;
        }
      });

      // 初始化一个空地图
      initMap([41.9, 12.5]);
      if (statusEl) statusEl.textContent = "请选择表/字段后点击加载";
    } catch (err) {
      console.error("Init map in Lark failed, fallback to standalone map:", err);
      initStandaloneMap("bitable 初始化失败，兜底地图");
    }
  })();

  // ------------ 5. 辅助函数：加载指定表的视图和字段 ------------
  async function loadViewsAndFields(base, tableId) {
    try {
      if (statusEl) statusEl.textContent = "加载视图和字段中...";

      // 清空原来的内容
      viewSelect.innerHTML = "";
      nameFieldSelect.innerHTML = "";
      locFieldSelect.innerHTML = "";

      var table = await base.getTableById(tableId);

      // 视图列表
      var viewList = await table.getViewList();
      viewList.forEach(function (v, idx) {
        var opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.name;
        viewSelect.appendChild(opt);
      });

      // 字段列表
      var fieldList = await table.getFieldList();
      fieldList.forEach(function (f) {
        var opt1 = document.createElement("option");
        opt1.value = f.id;
        opt1.textContent = f.name;
        nameFieldSelect.appendChild(opt1);

        var opt2 = document.createElement("option");
        opt2.value = f.id;
        opt2.textContent = f.name;
        locFieldSelect.appendChild(opt2);
      });

      if (viewList.length > 0) {
        viewSelect.value = viewList[0].id;
      }
      if (fieldList.length > 0) {
        nameFieldSelect.value = fieldList[0].id;
        // 尝试自动选中一个名称类似“位置”的字段作为默认位置字段
        var locField = fieldList.find(function (f) {
          return f.name.includes("位置") || f.name.toLowerCase().includes("location");
        });
        locFieldSelect.value = locField ? locField.id : fieldList[0].id;
      }

      if (statusEl) statusEl.textContent = "视图/字段已加载，请选择后点击加载";
    } catch (e) {
      console.error("loadViewsAndFields error", e);
      if (statusEl) statusEl.textContent = "加载视图/字段失败：" + e.message;
    }
  }
})();
