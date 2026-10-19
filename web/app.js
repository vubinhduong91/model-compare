/* AI coding model comparison dashboard. Data: window.MODEL_DATA (web/data.js, built by scripts/build.py). */
/* global echarts */
(() => {
  'use strict';

  const D = window.MODEL_DATA;
  const GROUPS = ['anchor', 'peer', 'flash', 'closed'];
  const SYMBOL = { anchor: 'circle', peer: 'diamond', flash: 'triangle', closed: 'rect' };
  const METRIC = Object.fromEntries(D.metrics.map((m) => [m.id, m]));
  const ANCHOR = D.models.find((m) => m.group === 'anchor');
  // Metrics whose spread is multiplicative: normalise them on a log scale.
  const LOG_UNITS = new Set(['$/1M', '$', 's']);

  const I18N = {
    vi: {
      title: 'So sánh model AI cho lập trình',
      subtitle: 'Mốc so sánh: {anchor} · {n} model · dữ liệu build lúc {date}',
      groups: 'Nhóm:',
      g_anchor: 'Mốc ({anchor})', g_peer: 'Cùng tầm', g_flash: 'Bản giá rẻ (Flash)', g_closed: 'Model đóng (tham chiếu)',
      theme_auto: 'Tự động', theme_light: 'Sáng', theme_dark: 'Tối',
      sec_summary: 'Tóm tắt',
      summary_lead: '{anchor} xếp hạng thế nào trong {n} model đang hiển thị (hạng 1 = tốt nhất).',
      rank: 'hạng {r}/{n}',
      hl_best: '{metric} cao nhất: {model} ({value}).',
      hl_best_open: 'Cao nhất trong các model open-weight: {model} ({value}).',
      hl_cheapest: 'Giá blended rẻ nhất: {model} ({value}).',
      hl_fastest: 'Sinh token nhanh nhất: {model} ({value}).',
      hl_frontier: 'Đáng tiền nhất — nằm trên đường Pareto ({y} × {x}): {list}.',
      sec_scatter: 'Năng lực so với giá',
      scatter_desc: 'Mỗi điểm là một model. Càng lên trên càng giỏi; với trục giá, càng sang trái càng rẻ. Đường Pareto nối các model không bị model nào khác vượt cùng lúc trên cả hai trục.',
      presets: 'Gợi ý:',
      p_coding_price: 'Coding × Giá', p_coding_task: 'Coding × Chi phí/task', p_swe_price: 'SWE-bench × Giá',
      p_arena_price: 'WebDev × Giá', p_speed_price: 'Tốc độ × Giá',
      axis_x: 'Trục X', axis_y: 'Trục Y', log_x: 'Trục X dạng log',
      frontier: 'Đường Pareto',
      missing: 'Chưa có dữ liệu: {list}.',
      sec_bench: 'Benchmark coding',
      bench_desc: 'Mỗi biểu đồ là một benchmark, xếp từ tốt đến kém. Model không có trong biểu đồ nghĩa là leaderboard đó chưa chạy model này.',
      sec_price: 'Giá API',
      price_desc: 'Giá niêm yết của chính hãng, USD cho 1 triệu token. "Chi phí thực tế / task" cho thấy model tiêu nhiều token thì vẫn đắt dù đơn giá rẻ.',
      sec_speed: 'Tốc độ',
      speed_desc: 'Đo qua API chính hãng bởi Artificial Analysis. Ở chế độ suy luận tối đa, thời gian chờ câu trả lời phụ thuộc nhiều vào việc model "nghĩ" bao lâu.',
      sec_table: 'Bảng tổng hợp',
      table_desc: 'Ô càng đậm = càng tốt so với các model đang hiển thị (đã tính chiều tốt/xấu của từng chỉ số; giá và thời gian so theo thang log). Bấm tiêu đề cột để sắp xếp.',
      col_model: 'Model', col_group: 'Nhóm', col_open: 'Open-weight', col_license: 'License',
      yes: 'Có', no: 'Không',
      sec_calc: 'Máy tính chi phí API',
      calc_desc: 'Ước tính chi phí mỗi tháng theo cách bạn dùng. Agent coding gửi lại context nhiều lần nên tỉ lệ cache-hit ảnh hưởng rất lớn tới hoá đơn.',
      c_req: 'Request / ngày', c_in: 'Token input / request', c_out: 'Token output / request',
      c_cache: '% input cache-hit', c_days: 'Ngày dùng / tháng',
      cp_light: 'Dùng nhẹ', cp_agent: 'Agent coding cả ngày', cp_heavy: 'Agent cường độ cao',
      c_per_req: '$ / request', c_month: '$ / tháng', c_plan: 'Gói subscription rẻ nhất có model này',
      c_axis: 'USD / tháng',
      calc_note: 'Model suy luận sinh thêm token "thinking", nên token output thực tế thường cao hơn số bạn nhập — đối chiếu thêm chỉ số "Chi phí thực tế / task".',
      sec_plans: 'Gói subscription coding',
      plans_desc: 'Trả cố định theo tháng, dùng với Claude Code / Codex / Cursor… Mỗi hãng đo hạn mức bằng đơn vị riêng nên không quy đổi trực tiếp được với nhau hay với giá API.',
      p_provider: 'Hãng', p_plan: 'Gói', p_month: '$ / tháng', p_year: '$ / tháng (trả năm)', p_usage: 'Hạn mức',
      p_models: 'Model (trong danh sách này)', p_tools: 'Công cụ', p_src: 'Nguồn',
      checked: 'kiểm tra {date}',
      sec_sources: 'Nguồn dữ liệu & phương pháp',
      fetched: 'lấy lúc {date}', page_updated: 'trang ghi cập nhật {date}',
      method_title: 'Cách tính',
      method: [
        'Giá = giá niêm yết của chính hãng (endpoint chính hãng trên OpenRouter, đối chiếu khớp với Artificial Analysis). Provider bên thứ ba có thể rẻ hơn nhưng hay chạy bản lượng tử hoá (fp4/fp8) — xem tooltip ở biểu đồ giá.',
        'Điểm coding AA = trung bình Terminal-Bench 4.0 và SciCode, đúng hai bài tạo nên nhóm Coding trong AA Intelligence Index.',
        'SWE-bench lấy từ Vals AI vì leaderboard swebench.com ngừng cập nhật từ 02/2026. SWE-bench Verified đã gần bão hoà (nhiều model > 90%), nên nên xem kèm Terminal-Bench.',
        'Terminal-Bench chính thức đo cặp model + agent (Claude Code, Codex…); bản của AA chạy mọi model trên cùng một harness nên công bằng hơn khi chỉ so model.',
        'Độ trễ dùng "thời gian đến token trả lời đầu tiên" (đã gồm thời gian suy nghĩ) vì Claude/GPT/Gemini ẩn phần reasoning.',
        'Ở mỗi nguồn lấy biến thể mạnh nhất của model (effort Max/xHigh); tên biến thể hiện trong tooltip.',
        'WebDev Arena và giá gói subscription được nhập tay vì trang chặn script — xem data/manual.toml và data/plans.toml.',
      ],
      gaps_title: 'Dữ liệu còn thiếu',
      no_gaps: 'Không thiếu dữ liệu nào.',
      footer: 'Cập nhật dữ liệu:',
      tip_cheapest: 'Rẻ nhất trên OpenRouter: {p} ({q}) — ${i} / ${o}',
      tip_ci: '±{ci} (95% CI) · {votes} lượt bình chọn',
      none: '—',
    },
    en: {
      title: 'AI coding model comparison',
      subtitle: 'Anchor: {anchor} · {n} models · data built {date}',
      groups: 'Groups:',
      g_anchor: 'Anchor ({anchor})', g_peer: 'Peers', g_flash: 'Budget (Flash)', g_closed: 'Closed (reference)',
      theme_auto: 'Auto', theme_light: 'Light', theme_dark: 'Dark',
      sec_summary: 'Summary',
      summary_lead: 'How {anchor} ranks among the {n} models shown (rank 1 = best).',
      rank: 'rank {r} of {n}',
      hl_best: 'Highest {metric}: {model} ({value}).',
      hl_best_open: 'Best open-weight model: {model} ({value}).',
      hl_cheapest: 'Cheapest blended price: {model} ({value}).',
      hl_fastest: 'Fastest output: {model} ({value}).',
      hl_frontier: 'Best value — on the Pareto frontier ({y} × {x}): {list}.',
      sec_scatter: 'Ability vs price',
      scatter_desc: 'Each dot is a model. Higher is better; on price axes, further left is cheaper. The Pareto line joins models that no other model beats on both axes at once.',
      presets: 'Presets:',
      p_coding_price: 'Coding × Price', p_coding_task: 'Coding × Cost/task', p_swe_price: 'SWE-bench × Price',
      p_arena_price: 'WebDev × Price', p_speed_price: 'Speed × Price',
      axis_x: 'X axis', axis_y: 'Y axis', log_x: 'Log X axis',
      frontier: 'Pareto frontier',
      missing: 'No data: {list}.',
      sec_bench: 'Coding benchmarks',
      bench_desc: 'One chart per benchmark, best first. A model missing from a chart has not been run on that leaderboard.',
      sec_price: 'API price',
      price_desc: 'First-party list prices, USD per 1M tokens. "Real cost per task" shows that a token-hungry model can still be expensive at a low unit price.',
      sec_speed: 'Speed',
      speed_desc: 'Measured on first-party APIs by Artificial Analysis. At maximum reasoning effort, waiting time depends mostly on how long the model thinks.',
      sec_table: 'Overview table',
      table_desc: 'Darker = better relative to the models shown (direction-aware; prices and times compared on a log scale). Click a column header to sort.',
      col_model: 'Model', col_group: 'Group', col_open: 'Open weights', col_license: 'License',
      yes: 'Yes', no: 'No',
      sec_calc: 'API cost calculator',
      calc_desc: 'Estimate your monthly bill from how you work. Coding agents resend context many times, so the cache-hit rate moves the bill a lot.',
      c_req: 'Requests / day', c_in: 'Input tokens / request', c_out: 'Output tokens / request',
      c_cache: '% input cache hits', c_days: 'Days used / month',
      cp_light: 'Light use', cp_agent: 'Agent all day', cp_heavy: 'Heavy agent use',
      c_per_req: '$ / request', c_month: '$ / month', c_plan: 'Cheapest subscription with this model',
      c_axis: 'USD / month',
      calc_note: 'Reasoning models emit extra "thinking" tokens, so real output is usually higher than what you enter — cross-check with "Real cost per task".',
      sec_plans: 'Coding subscriptions',
      plans_desc: 'Flat monthly fee, used with Claude Code / Codex / Cursor… Each vendor meters usage in its own units, so plans cannot be converted into each other or into API prices.',
      p_provider: 'Vendor', p_plan: 'Plan', p_month: '$ / month', p_year: '$ / month (yearly)', p_usage: 'Usage',
      p_models: 'Models (from this list)', p_tools: 'Tools', p_src: 'Source',
      checked: 'checked {date}',
      sec_sources: 'Data sources & method',
      fetched: 'fetched {date}', page_updated: 'page says updated {date}',
      method_title: 'Method',
      method: [
        'Price = first-party list price (first-party endpoint on OpenRouter, cross-checked against Artificial Analysis). Third-party providers can be cheaper but often serve quantised weights (fp4/fp8) — see the price chart tooltips.',
        'AA coding score = mean of Terminal-Bench 4.0 and SciCode, the two evals that make up the Coding category of the AA Intelligence Index.',
        'SWE-bench comes from Vals AI because the swebench.com leaderboard has not been updated since Feb 2026. SWE-bench Verified is close to saturated (many models > 90%), so read it alongside Terminal-Bench.',
        'The official Terminal-Bench board measures model + agent pairs (Claude Code, Codex…); AA runs every model on one harness, which is fairer for comparing models alone.',
        'Latency uses "time to first answer token" (thinking included) because Claude/GPT/Gemini hide their reasoning.',
        'Each source uses the strongest variant of a model (Max/xHigh effort); the variant name is in the tooltip.',
        'WebDev Arena scores and subscription prices are entered by hand because those sites block scripts — see data/manual.toml and data/plans.toml.',
      ],
      gaps_title: 'Data gaps',
      no_gaps: 'No gaps.',
      footer: 'Refresh data:',
      tip_cheapest: 'Cheapest on OpenRouter: {p} ({q}) — ${i} / ${o}',
      tip_ci: '±{ci} (95% CI) · {votes} votes',
      none: '—',
    },
  };

  const PRESETS = [
    { key: 'p_coding_price', y: 'aa_coding', x: 'price_blended', log: true },
    { key: 'p_coding_task', y: 'aa_coding', x: 'aa_cost_per_task', log: true },
    { key: 'p_swe_price', y: 'swe_verified', x: 'price_blended', log: true },
    { key: 'p_arena_price', y: 'arena_webdev', x: 'price_blended', log: true },
    { key: 'p_speed_price', y: 'aa_tps', x: 'price_blended', log: true },
  ];
  const CALC_PRESETS = {
    cp_light: { req: 60, inTok: 20000, outTok: 1000, cache: 60, days: 22 },
    cp_agent: { req: 200, inTok: 40000, outTok: 1500, cache: 80, days: 22 },
    cp_heavy: { req: 800, inTok: 80000, outTok: 2500, cache: 90, days: 26 },
  };
  const BENCH = ['aa_coding', 'swe_verified', 'aa_tbench40', 'tbench_official', 'aa_scicode', 'arena_webdev', 'aa_intelligence'];
  const PRICE = ['price_blended', 'price_input', 'price_output', 'price_cache', 'aa_cost_per_task'];
  const SPEED = ['aa_tps', 'aa_ttfat', 'aa_e2e'];
  const SHORT = {
    swe_verified: 'SWE-bench V.', tbench_official: 'TB 4.0 (off.)', aa_tbench40: 'TB 4.0 (AA)', aa_scicode: 'SciCode',
    aa_coding: 'Coding AA', arena_webdev: 'WebDev Elo', aa_intelligence: 'AA Index', price_input: 'In $/1M',
    price_output: 'Out $/1M', price_cache: 'Cache $/1M', price_blended: 'Blend $/1M', aa_cost_per_task: '$/task',
    aa_tps: 'tok/s', aa_ttfat: 'TTFA s', aa_e2e: 'E2E s', context: 'Context',
  };

  // ---------------------------------------------------------------- state
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const state = {
    lang: store.get('mc.lang') === 'en' ? 'en' : 'vi',
    theme: ['light', 'dark'].includes(store.get('mc.theme')) ? store.get('mc.theme') : 'auto',
    groups: new Set(GROUPS),
    x: 'price_blended', y: 'aa_coding', logX: true,
    sort: { id: 'aa_coding', best: true },
    calc: { ...CALC_PRESETS.cp_agent },
  };

  // ---------------------------------------------------------------- helpers
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    kids.flat().forEach((k) => k != null && n.append(k));
    return n;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const t = (key, vars = {}) => {
    const s = I18N[state.lang][key] ?? I18N.vi[key] ?? key;
    return typeof s === 'string' ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`)) : s;
  };
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const color = (g) => css(`--s-${g}`);
  const label = (m) => (state.lang === 'vi' ? m.vi : m.en);
  const desc = (m) => (state.lang === 'vi' ? m.dvi : m.den);
  const groupName = (g) => t(`g_${g}`, { anchor: ANCHOR.name });
  const visible = () => D.models.filter((m) => state.groups.has(m.group));
  const val = (m, id) => (m.values[id] ? m.values[id].v : null);
  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
    return isNaN(d) ? iso : d.toLocaleDateString(state.lang === 'vi' ? 'vi-VN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const num = (v, min, max) => v.toLocaleString('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });

  function fmt(v, metric) {
    if (v == null) return t('none');
    const d = metric.decimals;
    switch (metric.unit) {
      case '%': return `${num(v, d, d)}%`;
      case '$/1M': case '$': return `$${num(v, 2, Math.max(2, d))}`;
      case 'tokens': return v >= 1e6 ? `${num(v / 1e6, 0, 2)}M` : `${num(v / 1e3, 0, 0)}K`;
      case 's': return `${num(v, d, d)} s`;
      case 'tok/s': return `${num(v, 0, 0)} tok/s`;
      default: return num(v, d, d);
    }
  }
  const fmtAxis = (metric) => (v) => {
    if (metric.unit === '$/1M' || metric.unit === '$') return `$${num(v, 0, 2)}`;
    if (metric.unit === '%') return `${v}%`;
    if (metric.unit === 'tokens') return fmt(v, metric);
    return num(v, 0, 2);
  };

  /** Score in [0,1], 1 = best among `list`, direction- and log-aware. */
  function goodness(metric, v, list) {
    const vals = list.map((m) => val(m, metric.id)).filter((x) => x != null && (!LOG_UNITS.has(metric.unit) || x > 0));
    if (v == null || vals.length < 2) return null;
    const f = LOG_UNITS.has(metric.unit) ? Math.log : (x) => x;
    const lo = f(Math.min(...vals)), hi = f(Math.max(...vals));
    if (hi === lo) return 1;
    const g = (f(v) - lo) / (hi - lo);
    return metric.higher ? g : 1 - g;
  }
  /** Models sorted best-first on a metric (models without data dropped). */
  function ranked(metricId, list = visible()) {
    const m = METRIC[metricId];
    return list.filter((x) => val(x, metricId) != null)
      .sort((a, b) => (m.higher ? val(b, metricId) - val(a, metricId) : val(a, metricId) - val(b, metricId)));
  }
  /** Points not dominated on both axes (respecting each metric's direction). */
  function pareto(list, xm, ym) {
    const sx = xm.higher ? 1 : -1, sy = ym.higher ? 1 : -1;
    return list.filter((p) => !list.some((q) => q !== p
      && sx * val(q, xm.id) >= sx * val(p, xm.id) && sy * val(q, ym.id) >= sy * val(p, ym.id)
      && (sx * val(q, xm.id) > sx * val(p, xm.id) || sy * val(q, ym.id) > sy * val(p, ym.id))));
  }
  function swatch(g, size = 12) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('aria-hidden', 'true');
    const shapes = {
      circle: ['circle', { cx: 6, cy: 6, r: 5 }],
      diamond: ['path', { d: 'M6 0.5 L11.5 6 L6 11.5 L0.5 6 Z' }],
      triangle: ['path', { d: 'M6 1 L11.5 11 L0.5 11 Z' }],
      rect: ['rect', { x: 1, y: 1, width: 10, height: 10, rx: 1.5 }],
    };
    const [tag, attrs] = shapes[SYMBOL[g]];
    const s = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.setAttribute('fill', color(g));
    svg.append(s);
    return svg;
  }
  const lineKey = (c) => `<span style="display:inline-block;width:12px;height:2px;background:${c};vertical-align:middle;margin-right:6px"></span>`;
  function tipBox(title, rows) {
    return `<div style="font-weight:600;margin-bottom:4px">${esc(title)}</div>${rows.map((r) => `<div style="line-height:1.6">${r.c ? lineKey(r.c) : ''}<b>${esc(r.v)}</b> <span style="opacity:.75">${esc(r.l || '')}</span></div>`).join('')}`;
  }
  function baseOption() {
    return {
      animationDuration: 300,
      textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: css('--ink-2') },
      tooltip: {
        backgroundColor: css('--surface'), borderColor: css('--border'), borderWidth: 1,
        textStyle: { color: css('--ink'), fontSize: 12 }, extraCssText: 'box-shadow:0 4px 16px rgba(0,0,0,.12);max-width:340px;white-space:normal',
        confine: true,
      },
    };
  }
  const axisStyle = () => ({
    axisLine: { lineStyle: { color: css('--axis') } },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: css('--grid'), width: 1, type: 'solid' } },
    axisLabel: { color: css('--ink-2'), fontSize: 11 },
    nameTextStyle: { color: css('--ink-2'), fontSize: 12 },
  });
  const charts = new Map();
  function chart(node) {
    let c = charts.get(node);
    if (!c) { c = echarts.init(node, null, { renderer: 'svg' }); charts.set(node, c); }
    return c;
  }

  // ---------------------------------------------------------------- header / filters
  function renderStatic() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    $('#subtitle').textContent = t('subtitle', { anchor: ANCHOR.name, n: D.models.length, date: fmtDate(D.generated_at) });
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
    document.querySelectorAll('[data-theme-choice]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === state.theme)));

    const f = $('#group-filters');
    f.replaceChildren(el('span', { text: t('groups') }));
    for (const g of GROUPS) {
      f.append(el('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(state.groups.has(g)),
        onclick: () => {
          if (state.groups.has(g) && state.groups.size > 1) state.groups.delete(g); else state.groups.add(g);
          renderAll();
        },
      }, swatch(g), el('span', { text: groupName(g) })));
    }
    document.querySelectorAll('[data-legend]').forEach((n) => {
      n.replaceChildren(...GROUPS.filter((g) => state.groups.has(g)).map((g) => el('span', {}, swatch(g, 10), groupName(g))));
    });
  }

  // ---------------------------------------------------------------- summary
  function renderSummary() {
    const list = visible();
    $('#summary-lead').textContent = t('summary_lead', { anchor: ANCHOR.name, n: list.length });
    const tiles = $('#tiles');
    tiles.replaceChildren();
    if (state.groups.has('anchor')) {
      for (const id of ['aa_coding', 'swe_verified', 'arena_webdev', 'price_blended', 'aa_cost_per_task', 'aa_tps']) {
        const m = METRIC[id];
        const r = ranked(id, list);
        const pos = r.indexOf(ANCHOR) + 1;
        tiles.append(el('div', { class: 'tile', title: desc(m) },
          el('div', { class: 'label', text: label(m) }),
          el('div', { class: 'value', text: fmt(val(ANCHOR, id), m) }),
          el('div', { class: 'rank', text: pos ? t('rank', { r: pos, n: r.length }) : t('none') })));
      }
    }
    const hl = $('#highlights');
    hl.replaceChildren();
    const add = (s) => hl.append(el('li', { text: s }));
    const top = (id, l = list) => ranked(id, l)[0];
    const c = top('aa_coding');
    if (c) add(t('hl_best', { metric: label(METRIC.aa_coding), model: c.name, value: fmt(val(c, 'aa_coding'), METRIC.aa_coding) }));
    const co = top('aa_coding', list.filter((m) => m.details.open_weights));
    if (co) add(t('hl_best_open', { model: co.name, value: fmt(val(co, 'aa_coding'), METRIC.aa_coding) }));
    const ch = top('price_blended');
    if (ch) add(t('hl_cheapest', { model: ch.name, value: fmt(val(ch, 'price_blended'), METRIC.price_blended) }));
    const fa = top('aa_tps');
    if (fa) add(t('hl_fastest', { model: fa.name, value: fmt(val(fa, 'aa_tps'), METRIC.aa_tps) }));
    const both = list.filter((m) => val(m, 'aa_coding') != null && val(m, 'price_blended') != null);
    const front = pareto(both, METRIC.price_blended, METRIC.aa_coding).sort((a, b) => val(a, 'price_blended') - val(b, 'price_blended'));
    if (front.length) add(t('hl_frontier', { y: label(METRIC.aa_coding), x: label(METRIC.price_blended), list: front.map((m) => m.name).join(', ') }));
  }

  // ---------------------------------------------------------------- scatter
  function fillSelect(sel, current) {
    sel.replaceChildren();
    for (const grp of ['perf', 'price', 'speed', 'spec']) {
      const og = el('optgroup', { label: { perf: state.lang === 'vi' ? 'Năng lực' : 'Ability', price: state.lang === 'vi' ? 'Giá' : 'Price', speed: state.lang === 'vi' ? 'Tốc độ' : 'Speed', spec: 'Spec' }[grp] });
      D.metrics.filter((m) => m.group === grp).forEach((m) => og.append(el('option', { value: m.id, text: `${label(m)}${m.unit ? ` (${m.unit})` : ''}` })));
      sel.append(og);
    }
    sel.value = current;
  }
  function renderScatter() {
    fillSelect($('#sel-x'), state.x);
    fillSelect($('#sel-y'), state.y);
    $('#log-x').checked = state.logX;
    const p = $('#presets');
    p.replaceChildren(...PRESETS.map((pr) => el('button', {
      type: 'button', class: 'btn',
      onclick: () => { Object.assign(state, { x: pr.x, y: pr.y, logX: pr.log }); renderScatter(); },
    }, t(pr.key))));
    p.querySelectorAll('button').forEach((b) => { b.style.marginRight = '6px'; });

    const xm = METRIC[state.x], ym = METRIC[state.y];
    const list = visible();
    const ok = list.filter((m) => val(m, xm.id) != null && val(m, ym.id) != null && (!state.logX || val(m, xm.id) > 0));
    const missing = list.filter((m) => !ok.includes(m));
    $('#scatter-missing').textContent = missing.length ? t('missing', { list: missing.map((m) => m.name).join(', ') }) : '';

    const surface = css('--surface');
    const front = pareto(ok, xm, ym).sort((a, b) => val(a, xm.id) - val(b, xm.id));
    // Narrow screens: label only the anchor and frontier models; the tooltip and table carry the rest.
    const narrow = $('#scatter').clientWidth < 640;
    const labelled = (m) => !narrow || m.group === 'anchor' || front.includes(m);
    const series = GROUPS.filter((g) => state.groups.has(g)).map((g) => ({
      type: 'scatter', name: groupName(g), symbol: SYMBOL[g], symbolSize: g === 'anchor' ? 17 : 13,
      itemStyle: { color: color(g), borderColor: surface, borderWidth: 2 },
      label: {
        show: true, position: 'right', distance: 6, fontSize: 11, color: g === 'anchor' ? css('--ink') : css('--ink-2'),
        fontWeight: g === 'anchor' ? 'bold' : 'normal', formatter: (q) => q.data.name,
      },
      labelLayout: { moveOverlap: 'shiftY', hideOverlap: narrow },
      emphasis: { scale: 1.25, label: { show: true, color: css('--ink') } },
      z: 3,
      data: ok.filter((m) => m.group === g).map((m) => ({
        value: [val(m, xm.id), val(m, ym.id)], name: m.name, mid: m.id, label: { show: labelled(m) },
      })),
    }));
    if (front.length > 1) {
      series.unshift({
        type: 'line', name: t('frontier'), silent: true, z: 1, symbol: 'none',
        itemStyle: { color: css('--ink-2') },
        lineStyle: { color: css('--ink-2'), width: 1.5, opacity: 0.55 },
        data: front.map((m) => [val(m, xm.id), val(m, ym.id)]),
      });
    }
    const ax = axisStyle();
    const better = state.lang === 'vi' ? 'tốt hơn' : 'better';
    const option = {
      ...baseOption(),
      legend: {
        bottom: 0, left: 0, itemWidth: 12, itemHeight: 12, textStyle: { color: css('--ink-2'), fontSize: 12 },
        data: series.map((s) => (s.type === 'line' ? { name: s.name, icon: 'path://M0,5 L24,5 L24,7 L0,7 Z' } : { name: s.name })),
      },
      grid: { left: 8, right: narrow ? 70 : 120, top: 28, bottom: narrow ? 84 : 64, containLabel: true },
      xAxis: {
        type: state.logX ? 'log' : 'value', scale: !state.logX, ...ax, splitLine: { show: false },
        name: `${label(xm)}${xm.unit ? ` (${xm.unit})` : ''}   ${xm.higher ? `${better} →` : `← ${better}`}`,
        nameLocation: 'middle', nameGap: 28, axisLabel: { ...ax.axisLabel, formatter: fmtAxis(xm) },
      },
      yAxis: {
        // Lower-is-better metrics are flipped so "up" always means better.
        type: 'value', scale: true, ...ax,
        name: `↑ ${label(ym)}${ym.unit ? ` (${ym.unit})` : ''}`, nameLocation: 'end', nameGap: 12,
        nameTextStyle: { ...ax.nameTextStyle, align: 'left' }, inverse: !ym.higher,
        axisLabel: { ...ax.axisLabel, formatter: fmtAxis(ym) },
      },
      tooltip: {
        ...baseOption().tooltip, trigger: 'item',
        formatter: (q) => {
          if (q.seriesType !== 'scatter') return '';
          const m = D.models.find((x) => x.id === q.data.mid);
          return tipBox(m.name, [
            { v: fmt(val(m, ym.id), ym), l: `${label(ym)}${m.values[ym.id].note ? ' · ' + m.values[ym.id].note : ''}`, c: color(m.group) },
            { v: fmt(val(m, xm.id), xm), l: `${label(xm)}${m.values[xm.id].note ? ' · ' + m.values[xm.id].note : ''}` },
            { v: groupName(m.group), l: m.vendor },
          ]);
        },
      },
      series,
    };
    chart($('#scatter')).setOption(option, true);
  }

  // ---------------------------------------------------------------- small multiples
  function renderPanels(gridSel, ids) {
    const grid = $(gridSel);
    grid.replaceChildren();
    const list = visible();
    // Build every panel first: charts measure their width on init, and the grid
    // only settles its column widths once all panels are in place.
    const jobs = [];
    for (const id of ids) {
      const m = METRIC[id];
      const rows = ranked(id, list);
      const missing = list.filter((x) => !rows.includes(x));
      const box = el('div', { class: 'chart' });
      grid.append(el('div', { class: 'panel' },
        el('h3', { text: `${label(m)}${m.unit ? ` (${m.unit})` : ''}` }),
        el('p', { class: 'desc', text: desc(m) }),
        box,
        el('p', { class: 'note', text: missing.length ? t('missing', { list: missing.map((x) => x.name).join(', ') }) : '' })));
      if (rows.length) {
        box.style.height = `${rows.length * 30 + 40}px`;
        jobs.push([id, m, rows, box]);
      }
    }
    for (const [id, m, rows, box] of jobs) {
      const ax = axisStyle();
      const isElo = m.unit === 'Elo';
      const data = rows.map((x) => ({
        value: isElo ? [val(x, id), x.name] : val(x, id), mid: x.id,
        itemStyle: { color: color(x.group), borderColor: css('--surface'), borderWidth: isElo ? 2 : 0 },
      }));
      const option = {
        ...baseOption(),
        grid: { left: 4, right: 70, top: 4, bottom: 4, containLabel: true },
        xAxis: { type: 'value', scale: isElo, splitNumber: 3, ...ax, axisLabel: { ...ax.axisLabel, formatter: fmtAxis(m), hideOverlap: true } },
        yAxis: {
          type: 'category', inverse: true, data: rows.map((x) => x.name), ...ax, splitLine: { show: false },
          axisLabel: {
            ...ax.axisLabel, color: css('--ink-2'),
            formatter: (name) => (name === ANCHOR.name ? `{a|${name}}` : name),
            rich: { a: { fontWeight: 'bold', color: css('--ink'), fontSize: 11 } },
          },
        },
        tooltip: {
          ...baseOption().tooltip, trigger: 'item',
          formatter: (q) => {
            const x = D.models.find((y) => y.id === q.data.mid);
            const cell = x.values[id];
            const rowsT = [{ v: fmt(cell.v, m), l: cell.note || '', c: color(x.group) }];
            if (cell.ci != null) rowsT.push({ v: t('tip_ci', { ci: cell.ci, votes: cell.votes != null ? cell.votes.toLocaleString('en-US') : '?' }) });
            const cheap = x.details.openrouter && x.details.openrouter.cheapest;
            if (m.group === 'price' && cheap && id !== 'aa_cost_per_task') {
              rowsT.push({ v: t('tip_cheapest', { p: cheap.provider, q: cheap.quantization || '?', i: cheap.input, o: cheap.output }) });
            }
            return tipBox(x.name, rowsT);
          },
        },
        series: [isElo ? {
          type: 'scatter', symbolSize: 12, data,
          label: { show: true, position: 'right', distance: 6, fontSize: 11, color: css('--ink-2'), formatter: (q) => fmt(q.value[0], m) },
        } : {
          type: 'bar', barMaxWidth: 14, data, itemStyle: { borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', fontSize: 11, color: css('--ink-2'), formatter: (q) => fmt(q.value, m) },
        }],
      };
      chart(box).setOption(option, true);
    }
  }

  // ---------------------------------------------------------------- overview table
  function renderMatrix() {
    const list = visible();
    const s = state.sort;
    const cols = D.metrics;
    let rows;
    if (s.id === 'name') rows = [...list].sort((a, b) => a.name.localeCompare(b.name) * (s.best ? 1 : -1));
    else {
      const r = ranked(s.id, list);
      rows = (s.best ? r : [...r].reverse()).concat(list.filter((x) => !r.includes(x)));
    }
    const sortBtn = (id, text, title) => {
      const th = el('th', { class: id === 'name' ? 'text' : '', title: title || '' }, el('button', {
        type: 'button', text,
        onclick: () => { state.sort = { id, best: state.sort.id === id ? !state.sort.best : true }; renderMatrix(); },
      }));
      if (s.id === id) th.setAttribute('aria-sort', s.best ? 'descending' : 'ascending');
      return th;
    };
    const head = el('tr', {},
      sortBtn('name', t('col_model')),
      el('th', { class: 'text', text: t('col_group') }),
      el('th', { class: 'text', text: t('col_open') }),
      el('th', { class: 'text', text: t('col_license') }),
      cols.map((m) => sortBtn(m.id, SHORT[m.id] || label(m), `${label(m)} — ${desc(m)}`)));
    const flip = css('--heat-ink-flip') === '1';
    const heat = css('--heat');
    const body = rows.map((x) => el('tr', { class: x.group === 'anchor' ? 'anchor' : '' },
      el('td', { text: x.name, title: x.vendor }),
      el('td', { class: 'text' }, swatch(x.group, 10), ' ', groupName(x.group)),
      el('td', { class: 'text', text: x.details.open_weights == null ? t('none') : (x.details.open_weights ? t('yes') : t('no')) }),
      el('td', { class: 'text', text: x.license || t('none') }),
      cols.map((m) => {
        const v = val(x, m.id);
        const g = goodness(m, v, list);
        const td = el('td', { text: fmt(v, m), title: v == null ? '' : (x.values[m.id].note || '') });
        if (g != null) {
          const a = 0.06 + 0.74 * g;
          td.style.background = `rgba(${heat}, ${a.toFixed(3)})`;
          if (flip && a > 0.5) td.style.color = '#ffffff';
        }
        return td;
      })));
    $('#matrix').replaceChildren(el('thead', {}, head), el('tbody', {}, body));
  }

  // ---------------------------------------------------------------- calculator + plans
  function cheapestPlan(modelId) {
    return D.plans.filter((p) => (p.models || []).includes(modelId)).sort((a, b) => a.price_month - b.price_month)[0];
  }
  function renderCalc() {
    const form = $('#calc-form');
    const fields = [['req', 'c_req', 1], ['inTok', 'c_in', 1000], ['outTok', 'c_out', 100], ['cache', 'c_cache', 5], ['days', 'c_days', 1]];
    form.replaceChildren(...fields.map(([k, key, step]) => el('label', {}, t(key), el('input', {
      type: 'number', min: '0', step: String(step), value: String(state.calc[k]),
      max: k === 'cache' ? '100' : (k === 'days' ? '31' : null),
      oninput: (e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) { state.calc[k] = v; drawCalc(); } },
    }))));
    $('#calc-presets').replaceChildren(...Object.keys(CALC_PRESETS).map((k) => {
      const b = el('button', { type: 'button', class: 'btn', onclick: () => { state.calc = { ...CALC_PRESETS[k] }; renderCalc(); } }, t(k));
      b.style.marginRight = '6px';
      return b;
    }));
    drawCalc();
    renderPlans();
  }
  function drawCalc() {
    const c = state.calc;
    const cache = Math.min(100, c.cache) / 100;
    const rows = visible().filter((m) => val(m, 'price_input') != null && val(m, 'price_output') != null).map((m) => {
      const pin = val(m, 'price_input'), pout = val(m, 'price_output'), pc = val(m, 'price_cache') ?? pin;
      const perReq = (c.inTok * (1 - cache) * pin + c.inTok * cache * pc + c.outTok * pout) / 1e6;
      return { m, perReq, month: perReq * c.req * c.days };
    }).sort((a, b) => a.month - b.month);
    const box = $('#calc-chart');
    box.style.height = `${rows.length * 30 + 50}px`;
    const ax = axisStyle();
    const money = { unit: '$', decimals: 2 };
    chart(box).setOption({
      ...baseOption(),
      grid: { left: 4, right: 80, top: 4, bottom: 28, containLabel: true },
      xAxis: { type: 'value', ...ax, name: t('c_axis'), nameLocation: 'middle', nameGap: 22, axisLabel: { ...ax.axisLabel, formatter: (v) => `$${num(v, 0, 0)}`, hideOverlap: true } },
      yAxis: {
        type: 'category', inverse: true, data: rows.map((r) => r.m.name), ...ax, splitLine: { show: false },
        axisLabel: { ...ax.axisLabel, formatter: (n) => (n === ANCHOR.name ? `{a|${n}}` : n), rich: { a: { fontWeight: 'bold', color: css('--ink'), fontSize: 11 } } },
      },
      tooltip: {
        ...baseOption().tooltip, trigger: 'item',
        formatter: (q) => {
          const r = rows[q.dataIndex];
          const plan = cheapestPlan(r.m.id);
          return tipBox(r.m.name, [
            { v: fmt(r.month, money), l: t('c_month'), c: color(r.m.group) },
            { v: fmt(r.perReq, { unit: '$', decimals: 4 }), l: t('c_per_req') },
            ...(plan ? [{ v: `${plan.plan} — $${plan.price_month}`, l: t('c_plan') }] : []),
          ]);
        },
      },
      series: [{
        type: 'bar', barMaxWidth: 14, itemStyle: { borderRadius: [0, 4, 4, 0] },
        data: rows.map((r) => ({ value: r.month, itemStyle: { color: color(r.m.group) } })),
        label: { show: true, position: 'right', fontSize: 11, color: css('--ink-2'), formatter: (q) => fmt(q.value, money) },
      }],
    }, true);

    const head = el('tr', {}, el('th', { class: 'text', text: t('col_model') }), el('th', { text: t('c_per_req') }), el('th', { text: t('c_month') }), el('th', { class: 'text', text: t('c_plan') }));
    const body = rows.map((r) => {
      const plan = cheapestPlan(r.m.id);
      return el('tr', { class: r.m.group === 'anchor' ? 'anchor' : '' },
        el('td', { text: r.m.name }),
        el('td', { text: fmt(r.perReq, { unit: '$', decimals: 4 }) }),
        el('td', { text: fmt(r.month, money) }),
        el('td', { class: 'text', text: plan ? `${plan.plan} — $${plan.price_month}` : t('none') }));
    });
    $('#calc-table').replaceChildren(el('thead', {}, head), el('tbody', {}, body));
  }
  function renderPlans() {
    const nameOf = Object.fromEntries(D.models.map((m) => [m.id, m.name]));
    const head = el('tr', {}, ...['p_provider', 'p_plan', 'p_month', 'p_year', 'p_usage', 'p_models', 'p_tools', 'p_src']
      .map((k) => el('th', { class: ['p_month', 'p_year'].includes(k) ? '' : 'text', text: t(k) })));
    const body = D.plans.map((p) => el('tr', {},
      el('td', { text: p.provider }),
      el('td', { class: 'text', text: p.plan }),
      el('td', { text: `$${num(p.price_month, 0, 2)}` }),
      el('td', { text: p.price_month_yearly != null ? `$${num(p.price_month_yearly, 0, 2)}` : t('none') }),
      el('td', { class: 'wrap-cell', text: state.lang === 'vi' ? p.usage_vi : p.usage_en }),
      el('td', { class: 'wrap-cell', text: (p.models || []).length ? p.models.map((id) => nameOf[id] || id).join(', ') : (state.lang === 'vi' ? p.model_note_vi : p.model_note_en) || t('none') }),
      el('td', { class: 'wrap-cell', text: p.tools || '' }),
      el('td', { class: 'text' }, el('a', { href: p.url, target: '_blank', rel: 'noopener', text: t('checked', { date: fmtDate(p.checked) }) }))));
    $('#plans').replaceChildren(el('thead', {}, head), el('tbody', {}, body));
  }

  // ---------------------------------------------------------------- sources
  function renderSources() {
    $('#sources').replaceChildren(...D.sources.map((s) => el('li', {},
      el('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.name }),
      ` — ${state.lang === 'vi' ? s.vi : s.en} (${t('fetched', { date: fmtDate(s.fetched_at) })}${s.page_updated ? '; ' + t('page_updated', { date: s.page_updated }) : ''})`)));
    $('#method').replaceChildren(...t('method').map((s) => el('li', { text: s })));
    const list = visible();
    const gaps = D.metrics.map((m) => [m, list.filter((x) => val(x, m.id) == null)]).filter(([, miss]) => miss.length);
    $('#gaps').replaceChildren(...(gaps.length
      ? gaps.map(([m, miss]) => el('li', { text: `${label(m)}: ${miss.map((x) => x.name).join(', ')}` }))
      : [el('li', { text: t('no_gaps') })]));
  }

  // ---------------------------------------------------------------- wiring
  function renderAll() {
    renderStatic();
    renderSummary();
    renderScatter();
    renderPanels('#bench-grid', BENCH);
    renderPanels('#price-grid', PRICE);
    renderPanels('#speed-grid', SPEED);
    renderMatrix();
    renderCalc();
    renderSources();
    // Drop chart instances whose DOM node was replaced.
    for (const [node, c] of charts) if (!node.isConnected) { c.dispose(); charts.delete(node); }
  }
  function applyTheme() {
    if (state.theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = state.theme;
  }

  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
    state.lang = b.dataset.lang; store.set('mc.lang', state.lang); renderAll();
  }));
  document.querySelectorAll('[data-theme-choice]').forEach((b) => b.addEventListener('click', () => {
    state.theme = b.dataset.themeChoice; store.set('mc.theme', state.theme); applyTheme(); renderAll();
  }));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.theme === 'auto') renderAll(); });
  $('#sel-x').addEventListener('change', (e) => {
    state.x = e.target.value;
    if (state.logX && ['perf'].includes(METRIC[state.x].group)) state.logX = false;
    renderScatter();
  });
  $('#sel-y').addEventListener('change', (e) => { state.y = e.target.value; renderScatter(); });
  $('#log-x').addEventListener('change', (e) => { state.logX = e.target.checked; renderScatter(); });
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { charts.forEach((c) => c.resize()); renderScatter(); }, 120);
  });

  applyTheme();
  renderAll();
})();
