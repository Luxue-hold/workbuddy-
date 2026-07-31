/* ============================================================
   个人工作台 Workbench — 纯前端 / localStorage 持久化
   ============================================================ */
(function () {
  "use strict";

  const KEY = "workbench_v1";
  const TITLES = {
    overview: "概览",
    plan: "每日计划",
    diet: "饮食",
    fitness: "健身",
    mood: "心情记录",
    review: "每日复盘",
    time: "时间追踪",
    finance: "记账",
  };

  const MEALS = ["早餐", "午餐", "晚餐", "加餐"];
  const MOODS = [
    { key: "happy", emoji: "😄", label: "开心" },
    { key: "good", emoji: "😊", label: "不错" },
    { key: "neutral", emoji: "😐", label: "平淡" },
    { key: "sad", emoji: "😢", label: "低落" },
    { key: "angry", emoji: "😠", label: "烦躁" },
  ];
  const FIN_CATS = ["餐饮", "交通", "购物", "居住", "娱乐", "医疗", "工资", "其他"];

  /* ---------------- 数据层 ---------------- */
  let state = load();
  let currentView = "overview";
  let selectedDate = today();
  // 编辑态（不触发整页重渲染，避免清空输入）
  let editingMood = null;
  let editingRating = 0;
  // 计时器状态
  let timer = { running: false, startTs: 0, elapsed: 0, task: "", interval: null };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { plan: [], diet: [], fitness: [], mood: [], review: [], time: [], finance: [] };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast("保存失败：存储空间不足"); }
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------------- 工具 ---------------- */
  function today() { return fmtDate(new Date()); }
  function fmtDate(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function prettyDate(s) {
    const d = new Date(s + "T00:00:00");
    const w = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
    return `${s.slice(5)} ${w}`;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
  function isNum(v) { return v !== "" && !isNaN(v); }

  /* 按日期取集合 */
  function byDate(col, date) { return state[col].filter((x) => x.date === date); }
  /* 月份集合（按 YYYY-MM） */
  function byMonth(col, date) {
    const m = date.slice(0, 7);
    return state[col].filter((x) => x.date.slice(0, 7) === m);
  }
  function add(col, obj) { obj.id = uid(); state[col].push(obj); save(); }
  function update(col, id, patch) {
    const i = state[col].findIndex((x) => x.id === id);
    if (i > -1) { state[col][i] = { ...state[col][i], ...patch }; save(); }
  }
  function remove(col, id) { state[col] = state[col].filter((x) => x.id !== id); save(); }

  /* ---------------- 渲染框架 ---------------- */
  const appView = document.getElementById("app-view");

  function render() {
    document.getElementById("view-title").textContent = TITLES[currentView];
    document.getElementById("view-date").textContent =
      prettyDate(selectedDate) + " · " + (selectedDate === today() ? "今天" : "历史");
    appView.innerHTML = (views[currentView] || views.overview).html();
    (views[currentView] || views.overview).mount(appView);
    updateNavBadges();
  }
  function rerender() { render(); }

  function updateNavBadges() {
    const planLeft = byDate("plan", selectedDate).filter((p) => !p.done).length;
    const badge = document.querySelector('.nav-item[data-view="plan"] .nav-badge');
    if (badge) badge.remove();
    if (planLeft > 0) {
      const item = document.querySelector('.nav-item[data-view="plan"]');
      const b = document.createElement("span");
      b.className = "nav-badge";
      b.textContent = planLeft;
      item.appendChild(b);
    }
  }

  /* ============================================================
     视图：概览
     ============================================================ */
  const views = {};

  views.overview = {
    html() {
      const p = byDate("plan", selectedDate);
      const done = p.filter((x) => x.done).length;
      const dietItems = byDate("diet", selectedDate);
      const kcal = dietItems.reduce((s, x) => s + (Number(x.kcal) || 0) * (Number(x.qty) || 1), 0);
      const fit = byDate("fitness", selectedDate);
      const fitDur = fit.reduce((s, x) => s + (Number(x.duration) || 0), 0);
      const mood = byDate("mood", selectedDate).slice(-1)[0];
      const review = byDate("review", selectedDate).slice(-1)[0];
      const finToday = byDate("finance", selectedDate);
      const expToday = finToday.filter((x) => x.type === "expense").reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const monthFin = byMonth("finance", selectedDate);
      const expMonth = monthFin.filter((x) => x.type === "expense").reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const incMonth = monthFin.filter((x) => x.type === "income").reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const timeItems = byDate("time", selectedDate);
      const timeMin = timeItems.reduce((s, x) => s + (Number(x.minutes) || 0), 0);
      const timeHours = timeMin >= 60 ? `${Math.floor(timeMin / 60)}h${timeMin % 60 > 0 ? timeMin % 60 + "m" : ""}` : `${timeMin}m`;
      const moodEmoji = mood ? MOODS.find((m) => m.key === mood.mood)?.emoji : "—";

      const pc = p.length ? Math.round((done / p.length) * 100) : 0;
      const cards = [
        { icon: "📋", value: p.length ? `${done}/${p.length}` : "—", label: "计划完成", bar: pc },
        { icon: "🍱", value: kcal ? `${kcal} kcal` : "—", label: "今日摄入" },
        { icon: "💪", value: fit.length ? `${fit.length} 项` : "—", label: `训练 · ${fitDur}分钟` },
        { icon: "😊", value: moodEmoji, label: "今日心情" },
        { icon: "📝", value: review ? "✓ 已写" : "未写", label: "每日复盘" },
        { icon: "⏱️", value: timeItems.length ? `${timeItems.length} 项 · ${timeHours}` : "—", label: "今日追踪" },
        { icon: "💸", value: expToday ? `¥${expToday}` : "—", label: "今日支出" },
        { icon: "📅", value: `¥${expMonth}`, label: "本月支出" },
        { icon: "🏦", value: `¥${incMonth - expMonth}`, label: "本月结余" },
      ];

      const grid = cards.map((c) => `
        <div class="stat">
          <div class="stat-icon">${c.icon}</div>
          <div class="stat-value">${c.value}</div>
          <div class="stat-label">${c.label}</div>
          ${c.bar != null ? `<div class="stat-bar"><span style="width:${c.bar}%"></span></div>` : ""}
        </div>`).join("");

      const links = ["plan", "diet", "fitness", "mood", "review", "time", "finance"].map((v) => `
        <button class="btn-soft btn" data-go="${v}" style="margin:0 8px 8px 0">${TITLES[v]} →</button>`).join("");

      return `
        <div class="stat-grid">${grid}</div>
        <div class="card" style="margin-top:18px">
          <div class="card-title">快速进入</div>
          <div class="card-sub">${prettyDate(selectedDate)} · 点击进入对应模块记录</div>
          <div>${links}</div>
        </div>`;
    },
    mount(el) {
      el.querySelectorAll("[data-go]").forEach((b) =>
        b.addEventListener("click", () => { currentView = b.dataset.go; render(); })
      );
    },
  };

  /* ============================================================
     视图：每日计划
     ============================================================ */
  views.plan = {
    html() {
      const items = byDate("plan", selectedDate);
      const list = items.length
        ? items.map((p) => `
          <div class="item">
            <div class="check ${p.done ? "done" : ""}" data-toggle="${p.id}"></div>
            <div class="item-main">
              <div class="item-title plan-text ${p.done ? "done" : ""}">${esc(p.text)}</div>
            </div>
            <button class="item-del" data-del="${p.id}" title="删除">✕</button>
          </div>`).join("")
        : `<div class="list-empty">还没有计划，添加今天的待办吧 ✍️</div>`;
      const done = items.filter((x) => x.done).length;
      const pc = items.length ? Math.round((done / items.length) * 100) : 0;
      return `
        <div class="card">
          <div class="card-title">📋 每日计划 <span class="hint">${prettyDate(selectedDate)}</span></div>
          <div class="card-sub">把今天想做的事列出来，完成一项就打勾。</div>
          <div class="form-row">
            <div class="field" style="flex:1; min-width:220px">
              <input type="text" id="plan-input" placeholder="例如：写周报、跑步 5 公里…" maxlength="80" />
            </div>
            <button class="btn btn-primary" id="plan-add">添加</button>
          </div>
          ${items.length ? `<div class="progress" style="margin-top:16px"><span style="width:${pc}%"></span></div>
            <div class="hint" style="margin-top:6px">已完成 ${done} / ${items.length}（${pc}%）</div>` : ""}
          <div class="list">${list}</div>
        </div>`;
    },
    mount(el) {
      const input = el.querySelector("#plan-input");
      const submit = () => {
        const v = input.value.trim();
        if (!v) return;
        add("plan", { text: v, done: false, date: selectedDate });
        rerender();
      };
      el.querySelector("#plan-add").addEventListener("click", submit);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
      el.querySelectorAll("[data-toggle]").forEach((c) =>
        c.addEventListener("click", () => {
          const id = c.dataset.toggle;
          const it = state.plan.find((x) => x.id === id);
          if (it) { update("plan", id, { done: !it.done }); rerender(); }
        })
      );
      el.querySelectorAll("[data-del]").forEach((b) =>
        b.addEventListener("click", () => { remove("plan", b.dataset.del); rerender(); })
      );
    },
  };

  /* ============================================================
     视图：饮食
     ============================================================ */
  views.diet = {
    html() {
      const items = byDate("diet", selectedDate);
      const groups = MEALS.map((meal) => {
        const ms = items.filter((x) => x.meal === meal);
        const sum = ms.reduce((s, x) => s + (Number(x.kcal) || 0) * (Number(x.qty) || 1), 0);
        const rows = ms.length
          ? ms.map((x) => `
            <div class="item">
              <div class="item-main">
                <div class="item-title">${esc(x.name)}</div>
                <div class="item-meta">${Number(x.kcal) || 0} kcal × ${Number(x.qty) || 1} 份</div>
              </div>
              <div class="item-meta" style="font-weight:600">${Math.round((Number(x.kcal) || 0) * (Number(x.qty) || 1))} kcal</div>
              <button class="item-del" data-del="${x.id}">✕</button>
            </div>`).join("")
          : `<div class="list-empty" style="padding:14px 0">暂无</div>`;
        return `
          <div class="meal-group">
            <div class="meal-head"><span>${meal}</span><span class="meal-kcal">${sum} kcal</span></div>
            <div class="list">${rows}</div>
          </div>`;
      }).join("");
      const total = items.reduce((s, x) => s + (Number(x.kcal) || 0) * (Number(x.qty) || 1), 0);
      return `
        <div class="card">
          <div class="card-title">🍱 饮食记录 <span class="hint">${prettyDate(selectedDate)} · 全天 ${Math.round(total)} kcal</span></div>
          <div class="card-sub">按餐次记录食物与热量，了解每日摄入。</div>
          <div class="form-row">
            <div class="field"><label>餐次</label>
              <select id="d-meal">${MEALS.map((m) => `<option>${m}</option>`).join("")}</select></div>
            <div class="field" style="flex:1; min-width:160px"><label>食物名称</label>
              <input type="text" id="d-name" placeholder="如：鸡胸肉、米饭" maxlength="40" /></div>
            <div class="field" style="width:110px"><label>单份热量</label>
              <input type="number" id="d-kcal" placeholder="kcal" min="0" /></div>
            <div class="field" style="width:80px"><label>份数</label>
              <input type="number" id="d-qty" value="1" min="0" step="0.5" /></div>
            <button class="btn btn-primary" id="d-add">添加</button>
          </div>
          ${groups}
        </div>`;
    },
    mount(el) {
      const submit = () => {
        const name = el.querySelector("#d-name").value.trim();
        const kcal = el.querySelector("#d-kcal").value;
        if (!name) { toast("请填写食物名称"); return; }
        if (!isNum(kcal)) { toast("请填写热量"); return; }
        add("diet", {
          meal: el.querySelector("#d-meal").value,
          name, kcal: Number(kcal),
          qty: Number(el.querySelector("#d-qty").value) || 1,
          date: selectedDate,
        });
        rerender();
      };
      el.querySelector("#d-add").addEventListener("click", submit);
      el.querySelectorAll("[data-del]").forEach((b) =>
        b.addEventListener("click", () => { remove("diet", b.dataset.del); rerender(); })
      );
    },
  };

  /* ============================================================
     视图：健身
     ============================================================ */
  views.fitness = {
    html() {
      const items = byDate("fitness", selectedDate);
      const dur = items.reduce((s, x) => s + (Number(x.duration) || 0), 0);
      const sets = items.reduce((s, x) => s + (Number(x.sets) || 0), 0);
      const list = items.length
        ? items.map((x) => `
          <div class="item">
            <div class="item-main">
              <div class="item-title">${esc(x.name)}</div>
              <div class="item-meta">${x.sets ? x.sets + " 组" : ""}${x.reps ? " · " + x.reps + " 次" : ""}${x.weight ? " · " + x.weight + " kg" : ""}${x.duration ? " · " + x.duration + " 分钟" : ""}</div>
            </div>
            <button class="item-del" data-del="${x.id}">✕</button>
          </div>`).join("")
        : `<div class="list-empty">今天还没训练，动起来 💪</div>`;
      return `
        <div class="card">
          <div class="card-title">💪 健身记录 <span class="hint">${prettyDate(selectedDate)}</span></div>
          <div class="card-sub">${items.length ? `共 ${items.length} 个动作 · ${sets} 组 · ${dur} 分钟` : "记录今天的训练动作、组数与时长。"}</div>
          <div class="form-row">
            <div class="field" style="flex:1; min-width:160px"><label>动作 / 项目</label>
              <input type="text" id="f-name" placeholder="如：卧推、跑步" maxlength="40" /></div>
            <div class="field" style="width:80px"><label>组数</label>
              <input type="number" id="f-sets" min="0" placeholder="组" /></div>
            <div class="field" style="width:80px"><label>次数</label>
              <input type="number" id="f-reps" min="0" placeholder="次" /></div>
            <div class="field" style="width:90px"><label>重量kg</label>
              <input type="number" id="f-weight" min="0" placeholder="kg" /></div>
            <div class="field" style="width:90px"><label>时长分</label>
              <input type="number" id="f-dur" min="0" placeholder="分钟" /></div>
            <button class="btn btn-primary" id="f-add">添加</button>
          </div>
          <div class="list">${list}</div>
        </div>`;
    },
    mount(el) {
      const submit = () => {
        const name = el.querySelector("#f-name").value.trim();
        if (!name) { toast("请填写动作名称"); return; }
        const num = (id) => { const v = el.querySelector(id).value; return isNum(v) ? Number(v) : null; };
        add("fitness", {
          name, sets: num("#f-sets"), reps: num("#f-reps"),
          weight: num("#f-weight"), duration: num("#f-dur"), date: selectedDate,
        });
        rerender();
      };
      el.querySelector("#f-add").addEventListener("click", submit);
      el.querySelectorAll("[data-del]").forEach((b) =>
        b.addEventListener("click", () => { remove("fitness", b.dataset.del); rerender(); })
      );
    },
  };

  /* ============================================================
     视图：心情记录
     ============================================================ */
  views.mood = {
    html() {
      const todayMood = byDate("mood", selectedDate).slice(-1)[0];
      if (editingMood === null && todayMood) editingMood = todayMood.mood;
      const picker = MOODS.map((m) => `
        <div class="mood-opt ${editingMood === m.key ? "sel" : ""}" data-mood="${m.key}" title="${m.label}">${m.emoji}</div>`).join("");
      // 最近 7 天
      const hist = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(selectedDate + "T00:00:00");
        d.setDate(d.getDate() - i);
        const ds = fmtDate(d);
        const m = byDate("mood", ds).slice(-1)[0];
        hist.push({ ds, m });
      }
      const histHtml = hist.map((h) => {
        const mo = h.m ? MOODS.find((x) => x.key === h.m.mood) : null;
        return `<div class="mood-day"><span class="face">${mo ? mo.emoji : "·"}</span><span>${h.ds.slice(5)}</span></div>`;
      }).join("");
      return `
        <div class="card">
          <div class="card-title">😊 心情记录 <span class="hint">${prettyDate(selectedDate)}</span></div>
          <div class="card-sub">选一个最能代表此刻心情的表情，写几句也行。</div>
          <div class="mood-picker">${picker}</div>
          <div class="field" style="margin-top:16px">
            <label>备注（可选）</label>
            <textarea id="m-note" placeholder="今天发生了什么？">${todayMood ? esc(todayMood.note || "") : ""}</textarea>
          </div>
          <button class="btn btn-primary" id="m-save" style="margin-top:14px">${todayMood ? "更新心情" : "保存心情"}</button>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="card-title">📈 最近 7 天</div>
          <div class="card-sub">每天取最后一次记录。</div>
          <div class="mood-history">${histHtml}</div>
        </div>`;
    },
    mount(el) {
      el.querySelectorAll("[data-mood]").forEach((o) =>
        o.addEventListener("click", () => {
          editingMood = o.dataset.mood;
          el.querySelectorAll(".mood-opt").forEach((x) => x.classList.remove("sel"));
          o.classList.add("sel");
        })
      );
      el.querySelector("#m-save").addEventListener("click", () => {
        if (!editingMood) { toast("请选择一个心情"); return; }
        const note = el.querySelector("#m-note").value.trim();
        const existing = byDate("mood", selectedDate);
        // 同一天只保留一条（取最新）
        existing.forEach((x) => remove("mood", x.id));
        add("mood", { mood: editingMood, note, date: selectedDate });
        toast("心情已保存");
        rerender();
      });
    },
  };

  /* ============================================================
     视图：每日复盘
     ============================================================ */
  views.review = {
    html() {
      const r = byDate("review", selectedDate).slice(-1)[0];
      if (editingRating === 0 && r) editingRating = r.rating || 0;
      const stars = [];
      for (let i = 1; i <= 10; i++) {
        stars.push(`<span class="star ${i <= editingRating ? "on" : ""}" data-star="${i}">★</span>`);
      }
      return `
        <div class="card">
          <div class="card-title">📝 每日复盘 <span class="hint">${prettyDate(selectedDate)}</span></div>
          <div class="card-sub">${r ? "今天已复盘，可修改后重新保存。" : "花几分钟回顾今天，让成长有迹可循。"}</div>
          <div class="grid cols-2">
            <div class="field"><label>✨ 今天的三件小确幸 / 收获</label>
              <textarea id="r-good" placeholder="哪怕很小的事也值得记下来">${r ? esc(r.good || "") : ""}</textarea></div>
            <div class="field"><label>💡 不足 / 可改进</label>
              <textarea id="r-bad" placeholder="哪里可以做得更好？">${r ? esc(r.bad || "") : ""}</textarea></div>
            <div class="field"><label>📌 今日总结</label>
              <textarea id="r-summary" placeholder="一句话概括今天">${r ? esc(r.summary || "") : ""}</textarea></div>
            <div class="field"><label>🎯 明日计划</label>
              <textarea id="r-tomorrow" placeholder="明天最想完成的 1-3 件事">${r ? esc(r.tomorrow || "") : ""}</textarea></div>
          </div>
          <div class="field" style="margin-top:14px">
            <label id="r-rating-label">⭐ 今日评分（${editingRating}/10）</label>
            <div class="rating" id="r-rating">${stars.join("")}</div>
          </div>
          <button class="btn btn-primary" id="r-save" style="margin-top:16px">${r ? "更新复盘" : "保存复盘"}</button>
        </div>`;
    },
    mount(el) {
      el.querySelectorAll("[data-star]").forEach((s) =>
        s.addEventListener("click", () => {
          editingRating = Number(s.dataset.star);
          el.querySelectorAll(".star").forEach((x) =>
            x.classList.toggle("on", Number(x.dataset.star) <= editingRating));
          const lbl = el.querySelector("#r-rating-label");
          if (lbl) lbl.textContent = `⭐ 今日评分（${editingRating}/10）`;
        })
      );
      el.querySelector("#r-save").addEventListener("click", () => {
        const get = (id) => el.querySelector(id).value.trim();
        const data = { good: get("#r-good"), bad: get("#r-bad"), summary: get("#r-summary"), tomorrow: get("#r-tomorrow"), rating: editingRating, date: selectedDate };
        byDate("review", selectedDate).forEach((x) => remove("review", x.id));
        add("review", data);
        toast("复盘已保存");
        rerender();
      });
    },
  };

  /* ============================================================
     视图：时间追踪
     ============================================================ */
  views.time = {
    html() {
      const items = byDate("time", selectedDate).sort((a, b) => (b.id < a.id ? -1 : 1));
      const totalMin = items.reduce((s, x) => s + (Number(x.minutes) || 0), 0);
      const h = Math.floor(totalMin / 60), m = totalMin % 60;
      const durStr = h > 0 ? `${h}h${m > 0 ? m + "m" : ""}` : `${m}m`;

      // 按分类汇总
      const byCat = {};
      items.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + (Number(x.minutes) || 0); });
      const catBars = Object.entries(byCat).sort((a, b) => b[1] - a[1])
        .map(([cat, min]) => {
          const pc = totalMin ? Math.round((min / totalMin) * 100) : 0;
          return `<div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px"><span>${esc(cat)}</span><span style="color:var(--text-faint)">${min}m（${pc}%）</span></div>
            <div class="progress"><span style="width:${pc}%"></span></div>
          </div>`;
        }).join("");

      // 今日列表
      const list = items.length
        ? items.map((x) => `
          <div class="item">
            <div class="item-main">
              <div class="item-title">${esc(x.task)}</div>
              <div class="item-meta">${esc(x.category)} · ${x.time ? `开始 ${x.time}` : ""} · ${Number(x.minutes)} 分钟</div>
            </div>
            <div class="item-meta" style="font-weight:600;font-size:14px">${Number(x.minutes)}m</div>
            <button class="item-del" data-del="${x.id}">✕</button>
          </div>`).join("")
        : `<div class="list-empty">今天还没追踪过时间，开始计时吧 ⏱️</div>`;

      // 计时器 UI
      const running = timer.running;
      const display = running
        ? formatDuration(timer.elapsed + Math.floor((Date.now() - timer.startTs) / 1000))
        : formatDuration(timer.elapsed);

      return `
        <div class="grid cols-2">
          <!-- 左侧：计时器 -->
          <div class="card">
            <div class="card-title">⏱️ 实时计时 <span class="hint">${prettyDate(selectedDate)}</span></div>
            <div class="card-sub">开始计时 → 记录任务 → 停止并保存，精确追踪每一项工作用时。</div>
            <div class="timer-display" id="timer-display">${display}</div>
            <div class="field"><label>正在做的任务</label>
              <input type="text" id="tm-task" placeholder="例如：写周报、开项目会…" maxlength="40" value="${esc(timer.task)}" /></div>
            <div class="field" style="margin-top:8px"><label>分类</label>
              <select id="tm-cat">
                <option value="开发">开发</option><option value="会议">会议</option><option value="写作">写作</option>
                <option value="学习">学习</option><option value="沟通">沟通</option><option value="其他">其他</option>
              </select></div>
            <div style="display:flex;gap:10px;margin-top:14px">
              ${running ? `<button class="btn btn-danger btn-block" id="tm-stop">⏹ 停止并保存</button>` :
                `<button class="btn btn-primary btn-block" id="tm-start">▶ 开始计时</button>`}
              ${running || timer.elapsed > 0 ? `<button class="btn btn-soft" id="tm-reset" title="丢弃当前计时">↺</button>` : ""}
            </div>
            ${running ? `<div class="hint" style="margin-top:10px;text-align:center">计时中… 完成后点击"停止并保存"</div>` : ""}
          </div>
          <!-- 右侧：统计 -->
          <div class="card">
            <div class="card-title">📊 今日统计 <span class="hint">${items.length} 项 · 共 ${durStr}</span></div>
            <div class="card-sub">按分类汇总今日时间分布。</div>
            ${catBars || `<div class="list-empty" style="padding:20px 0">暂无数据</div>`}
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="card-title">📋 今日追踪记录</div>
          <div class="list">${list}</div>
        </div>`;
    },
    mount(el) {
      const startBtn = el.querySelector("#tm-start");
      const stopBtn = el.querySelector("#tm-stop");
      const resetBtn = el.querySelector("#tm-reset");
      const taskInput = el.querySelector("#tm-task");
      const catSelect = el.querySelector("#tm-cat");

      // 同步分类到计时器
      if (catSelect) catSelect.addEventListener("change", () => { timer.category = catSelect.value; });

      if (startBtn) startBtn.addEventListener("click", () => {
        const task = taskInput.value.trim();
        if (!task) { toast("请填写正在做的任务"); return; }
        timer.task = task;
        timer.category = catSelect.value;
        timer.running = true;
        timer.startTs = Date.now();
        // 更新 UI
        taskInput.value = task;
        startTimerInterval();
        rerender();
      });
      if (stopBtn) stopBtn.addEventListener("click", () => {
        if (!timer.running) return;
        const elapsed = timer.elapsed + Math.floor((Date.now() - timer.startTs) / 1000);
        const minutes = Math.max(1, Math.round(elapsed / 60));
        add("time", {
          task: timer.task,
          category: timer.category || catSelect.value,
          minutes,
          time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
          date: selectedDate,
        });
        stopTimer();
        timer.task = "";
        timer.elapsed = 0;
        timer.category = "开发";
        taskInput.value = "";
        rerender();
        toast(`已保存：${timer.task} · ${minutes} 分钟`);
      });
      if (resetBtn) resetBtn.addEventListener("click", () => {
        stopTimer();
        timer.elapsed = 0;
        timer.task = "";
        timer.category = "开发";
        taskInput.value = "";
        rerender();
      });

      el.querySelectorAll("[data-del]").forEach((b) =>
        b.addEventListener("click", () => { remove("time", b.dataset.del); rerender(); })
      );
    },
  };

  function formatDuration(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
  function startTimerInterval() {
    if (timer.interval) clearInterval(timer.interval);
    timer.interval = setInterval(() => {
      const el = document.getElementById("timer-display");
      if (el && timer.running) {
        const sec = timer.elapsed + Math.floor((Date.now() - timer.startTs) / 1000);
        el.textContent = formatDuration(sec);
      }
    }, 200);
  }
  function stopTimer() {
    timer.running = false;
    if (timer.interval) { clearInterval(timer.interval); timer.interval = null; }
  }

  /* ============================================================
     视图：记账
     ============================================================ */
  views.finance = {
    html() {
      const all = byDate("finance", selectedDate).slice().sort((a, b) => (b.id < a.id ? -1 : 1));
      const expToday = all.filter((x) => x.type === "expense").reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const incToday = all.filter((x) => x.type === "income").reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const month = byMonth("finance", selectedDate);
      const expMonth = month.filter((x) => x.type === "expense").reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const incMonth = month.filter((x) => x.type === "income").reduce((s, x) => s + (Number(x.amount) || 0), 0);

      // 分类小计（本月支出）
      const byCat = {};
      month.filter((x) => x.type === "expense").forEach((x) => {
        byCat[x.category] = (byCat[x.category] || 0) + (Number(x.amount) || 0);
      });
      const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1])
        .map(([c, v]) => `<tr><td>${esc(c)}</td><td class="amount-exp">¥${v}</td></tr>`).join("") ||
        `<tr><td colspan="2" class="list-empty" style="padding:14px">本月暂无支出</td></tr>`;

      const rows = all.length
        ? all.map((x) => `
          <tr>
            <td>${esc(x.category)}</td>
            <td>${esc(x.note || "—")}</td>
            <td class="${x.type === "income" ? "amount-inc" : "amount-exp"}">${x.type === "income" ? "+" : "-"}¥${Number(x.amount) || 0}</td>
            <td><button class="item-del" data-del="${x.id}">✕</button></td>
          </tr>`).join("")
        : `<tr><td colspan="4" class="list-empty" style="padding:24px">今天还没有记账记录</td></tr>`;

      return `
        <div class="fin-summary" style="margin-bottom:16px">
          <div class="fin-box"><div class="l">今日支出</div><div class="v amount-exp">¥${expToday}</div></div>
          <div class="fin-box"><div class="l">今日收入</div><div class="v amount-inc">¥${incToday}</div></div>
          <div class="fin-box"><div class="l">本月结余</div><div class="v">¥${incMonth - expMonth}</div></div>
        </div>
        <div class="grid cols-2">
          <div class="card">
            <div class="card-title">💰 记一笔 <span class="hint">${prettyDate(selectedDate)}</span></div>
            <div class="form-row" style="margin-bottom:10px">
              <div class="field">
                <label>类型</label>
                <select id="f-type">
                  <option value="expense">支出</option>
                  <option value="income">收入</option>
                </select>
              </div>
              <div class="field"><label>分类</label>
                <select id="f-cat">${FIN_CATS.map((c) => `<option>${c}</option>`).join("")}</select></div>
              <div class="field" style="width:130px"><label>金额</label>
                <input type="number" id="f-amount" min="0" step="0.01" placeholder="0.00" /></div>
            </div>
            <div class="field"><label>备注（可选）</label>
              <input type="text" id="f-note" placeholder="如：午饭、地铁卡充值" maxlength="40" /></div>
            <button class="btn btn-primary btn-block" id="f-rec" style="margin-top:14px">记一笔</button>
          </div>
          <div class="card">
            <div class="card-title">📊 本月支出分类</div>
            <div class="card-sub">${prettyDate(selectedDate).slice(0, 2)} 月已支出 ¥${expMonth}</div>
            <table class="table"><tbody>${catRows}</tbody></table>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="card-title">🧾 ${prettyDate(selectedDate)} 明细</div>
          <table class="table">
            <thead><tr><th>分类</th><th>备注</th><th>金额</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    },
    mount(el) {
      el.querySelector("#f-rec").addEventListener("click", () => {
        const type = el.querySelector("#f-type").value;
        const amount = el.querySelector("#f-amount").value;
        const cat = el.querySelector("#f-cat").value;
        if (!isNum(amount) || Number(amount) <= 0) { toast("请输入有效金额"); return; }
        add("finance", { type, category: cat, amount: Number(amount), note: el.querySelector("#f-note").value.trim(), date: selectedDate });
        rerender();
      });
      el.querySelectorAll("[data-del]").forEach((b) =>
        b.addEventListener("click", () => { remove("finance", b.dataset.del); rerender(); })
      );
    },
  };

  /* ============================================================
     全局交互：导航 / 日期 / 导入导出 / toast
     ============================================================ */
  document.getElementById("nav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    currentView = btn.dataset.view;
    editingMood = null; editingRating = 0;
    document.querySelectorAll(".nav-item").forEach((x) => x.classList.toggle("active", x === btn));
    render();
  });

  const dateSel = document.getElementById("date-select");
  dateSel.value = selectedDate;
  dateSel.addEventListener("change", () => {
    selectedDate = dateSel.value || today();
    editingMood = null; editingRating = 0;
    render();
  });

  // 导出
  document.getElementById("btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `workbench-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("数据已导出");
  });
  // 导入
  const importFile = document.getElementById("import-file");
  document.getElementById("btn-import").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (typeof data !== "object") throw 0;
        ["plan", "diet", "fitness", "mood", "review", "time", "finance"].forEach((k) => { if (!Array.isArray(data[k])) data[k] = []; });
        state = data; save(); render(); toast("数据已导入");
      } catch (err) { toast("导入失败：文件格式不正确"); }
    };
    reader.readAsText(file);
    importFile.value = "";
  });

  // 移动端菜单
  const sidebar = document.querySelector(".sidebar");
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  document.body.appendChild(scrim);
  function toggleMenu(open) {
    sidebar.classList.toggle("open", open);
    scrim.classList.toggle("show", open);
  }
  scrim.addEventListener("click", () => toggleMenu(false));
  // 在 topbar 加入菜单按钮（移动端）
  const menuBtn = document.createElement("button");
  menuBtn.className = "menu-toggle";
  menuBtn.textContent = "☰";
  menuBtn.addEventListener("click", () => toggleMenu(true));
  document.querySelector(".topbar-left").prepend(menuBtn);

  // toast
  let toastTimer;
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---------------- 启动 ---------------- */
  render();
})();
