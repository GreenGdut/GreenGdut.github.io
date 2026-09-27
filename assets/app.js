/* ============================================================
   tui_blog — 终端风格个人博客交互逻辑
   纯前端 · 无依赖
   ============================================================ */
(function () {
  "use strict";

  /* ---------- DOM ---------- */
  const $ = (s) => document.querySelector(s);
  const output = $("#output");
  const screenEl = $("#screen");
  const form = $("#form");
  const input = $("#cmd");
  const caret = $("#caret");
  const clockEl = $("#clock");

  /* ---------- 工具 ---------- */
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const scrollBottom = () => { screenEl.scrollTop = screenEl.scrollHeight; };

  function el(html, cls) {
    const d = document.createElement("div");
    d.className = cls || "line";
    d.innerHTML = html;
    output.appendChild(d);
    scrollBottom();
    return d;
  }
  const line = (t, cls) => el(esc(t), "line block " + (cls || ""));
  const raw = (h, cls) => el(h, "line block " + (cls || ""));
  const blank = () => el("&nbsp;", "line block");

  /* ---------- 打字机 ---------- */
  let busy = false;
  async function type(text, cls, delay) {
    delay = delay == null ? 10 : delay;
    const d = el("", "line block " + (cls || ""));
    for (let i = 0; i < text.length; i++) {
      d.textContent += text[i];
      if (i % 2 === 0) scrollBottom();
      await sleep(delay);
    }
    scrollBottom();
    return d;
  }

  /* ---------- 点阵 banner ---------- */
  const GLYPHS = {
    G: ["█████", "█    ", "█  ██", "█   █", "█████"],
    R: ["████ ", "█   █", "████ ", "█  █ ", "█   █"],
    E: ["█████", "█    ", "████ ", "█    ", "█████"],
    N: ["█   █", "██  █", "█ █ █", "█  ██", "█   █"],
    _: ["     ", "     ", "     ", "     ", "█████"],
    D: ["████ ", "█   █", "█   █", "█   █", "████ "],
    U: ["█   █", "█   █", "█   █", "█   █", "█████"],
    T: ["█████", "  █  ", "  █  ", "  █  ", "  █  "],
    " ": ["     ", "     ", "     ", "     ", "     "],
  };
  function bannerArt(text) {
    const rows = ["", "", "", "", ""];
    for (const ch of text.toUpperCase()) {
      const g = GLYPHS[ch] || GLYPHS[" "];
      for (let r = 0; r < 5; r++) rows[r] += g[r] + " ";
    }
    return rows.join("\n");
  }

  /* ---------- 数据 ---------- */
  const PROFILE = {
    handle: "green_gdut",
    name: "green_gdut",
    host: "openworld-dev",
    role: "开源世界爱好者",
    tags: ["Linux", "OpenHarmony", "Computer Vision", "C/C++"],
    intro: [
      "The best time for Linux",
      "关注操作系统底层、计算机视觉与嵌入式 AI 部署",
      "希望和各位佬一起学习 共同成长",
    ],
    email: "GreenGdut@gmail.com",
    github: "github.com/GreenGdut",
    location: "China · UTC+8",
  };

  // 把 PROFILE 同步到 HTML 里静态的标题栏 / 提示符，避免两处硬编码不一致
  function applyProfile() {
    const set = (sel, val) => document.querySelectorAll(sel).forEach((n) => (n.textContent = val));
    set(".tb-user, .p-user", PROFILE.handle);
    set(".tb-host, .p-host", PROFILE.host);
    set(".tb-path, .p-path", "~");
    document.title = PROFILE.handle + " :: ~/blog";
  }

  const SKILLS = [
    { name: "C / C++", pct: 88 },
    { name: "Linux", pct: 90 },
    { name: "Computer Vision", pct: 84 },
    { name: "OpenHarmony", pct: 78 },
    { name: "Python", pct: 80 },
    { name: "ROS", pct: 74 },
    { name: "Docker", pct: 72 },
    { name: "Shell", pct: 82 },
  ];

  const PROJECTS = [
    {
      title: "ROS YOLO Smart Interception",
      tags: ["ROS", "YOLO", "C++", "Docker"],
      desc: "[dev]基于 ROS Noetic 的双目视觉目标检测与智能拦截；Docker 化可复现开发环境。",
    },
    {
      title: "hi3519_yolo",
      tags: ["OpenHarmony", "NPU", "C++"],
      desc: "海思 Hi3519 嵌入式端 YOLO 推理部署，NPU 加速 + Kalman 目标跟踪。",
    },
    {
      title: "Desktop Pixel Pet",
      tags: ["Qt", "C++", "Graphics"],
      desc: "[感谢大佬开源]桌面像素宠物：透明无边框窗口、帧动画与交互状态机。",
    },
    {
      title: "my_knowledge",
      tags: ["Markdown", "Docs"],
      desc: "个人技术知识库，沉淀系统、视觉与工程实践笔记。",
    },
    {
      title: "tui_blog",
      tags: ["HTML", "CSS", "JS"],
      desc: "本页面：纯前端实现的终端风格个人博客，零依赖。",
    },
    {
      title: "其他有意思的小玩具",
      tags: ["none"],
      desc: "路由器ROOT Python小脚本 爆改老式主机etc.",
    },    
  ];

  /* ============================================================
     文章数据源 —— GitHub 笔记仓库（支持多级目录）
     通过 git/trees?recursive=1 一次拉取整棵目录树，列出所有 Markdown；
     正文按需懒加载（点开某篇才拉 raw），避免一次下载几十个文件。
     ============================================================ */
  const NOTES = {
    owner: "GreenGdut",
    repo: "my_openknowledge", // 只放愿意公开的笔记；私有笔记留在 my_knowledge
    branch: "main",
    dir: "", // 只取仓库下的某个子目录（空字符串 = 整仓递归）
    exts: [".md", ".markdown"],
    limit: 500, // 最多收录多少篇
    maxLines: 400, // 单篇最多渲染多少行（超出截断）
    posts: [], // [{ path, title, date, tags, lines }]
    assets: {}, // basename -> [path]（图片 / 笔记，供引用解析）
    loaded: false,
    truncated: false,
  };

  const notesConfigured = () => !!(NOTES.owner && NOTES.repo);
  const notesReady = () => NOTES.loaded && NOTES.posts.length > 0;

  let notesLoading = null;

  // 目录名 / 文件名过滤：隐藏目录、依赖目录、图片目录、README 等
  function isIgnored(p) {
    if (/(^|\/)[.!]/.test(p)) return true; // .git / .venv / !_tmp 等
    if (
      /(^|\/)(node_modules|venv|site-packages|__pycache__|images|img|assets|static|dist|build)(\/|$)/i.test(p)
    )
      return true;
    if (/(^|\/)(README|SUMMARY|LICENSE)\.(md|markdown)$/i.test(p)) return true;
    return false;
  }

  function topDir(p) {
    const i = p.indexOf("/");
    return i === -1 ? "(root)" : p.slice(0, i);
  }

  function titleFromPath(p) {
    const base = p.split("/").pop().replace(/\.(md|markdown)$/i, "");
    return base.replace(/^\d+[\s_\-.]+/, "").trim() || base;
  }

  function dateFromPath(p) {
    const m = /(\d{4}-\d{2}-\d{2})/.exec(p);
    return m ? m[1] : "";
  }

  function isImagePath(p) {
    return /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i.test(p);
  }

  const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");
  const rawUrl = (p) =>
    "https://raw.githubusercontent.com/" + NOTES.owner + "/" + NOTES.repo + "/" + NOTES.branch + "/" + encPath(p);
  const blobUrl = (p) =>
    "https://github.com/" + NOTES.owner + "/" + NOTES.repo + "/blob/" + NOTES.branch + "/" + encPath(p);

  function noteDirOf(p) {
    const i = p.lastIndexOf("/");
    return i === -1 ? "" : p.slice(0, i);
  }

  // 折叠 a/b/../c 这类相对路径
  function normalizeRel(dir, rel) {
    const segs = (dir ? dir.split("/") : []).filter(Boolean);
    rel.split("/").forEach((s) => {
      if (!s || s === ".") return;
      if (s === "..") segs.pop();
      else segs.push(s);
    });
    return segs.join("/");
  }

  // 把 markdown 里的引用解析成仓库内路径 / 外部 URL
  function resolveRef(ref, noteDir) {
    if (!ref) return null;
    const r0 = String(ref).trim().replace(/\\/g, "/");
    if (/^(https?:)?\/\//i.test(r0) || /^data:/i.test(r0)) return { url: r0 };
    if (r0.startsWith("#")) return { url: r0 };
    const rel = r0.replace(/^\.?\//, "");
    if (rel.includes("/")) {
      return { path: normalizeRel(noteDir || "", rel) };
    }
    const hits = NOTES.assets[rel.toLowerCase()];
    if (!hits || !hits.length) return null;
    const same = hits.find((p) => noteDirOf(p) === (noteDir || ""));
    return { path: same || hits[0] };
  }

  function imgFigure(ref, alt, noteDir) {
    const r = resolveRef(ref, noteDir);
    const label = esc((alt || ref || "图片").replace(/\\/g, "/"));
    if (!r) return '<span class="md-missing">[图片缺失: ' + label + "]</span>";
    const src = r.url || rawUrl(r.path);
    const open = r.url || blobUrl(r.path);
    return (
      '<figure class="md-figure"><a href="' +
      esc(open) +
      '" target="_blank" rel="noopener"><img class="md-img" loading="lazy" src="' +
      esc(src) +
      '" alt="' +
      esc(alt || "") +
      '"></a><figcaption>[img] ' +
      label +
      "</figcaption></figure>"
    );
  }

  function linkHtml(ref, text, noteDir) {
    const r = resolveRef(ref, noteDir);
    const t = esc(text || ref || "");
    if (!r) return '<span class="dim">' + t + "</span>";
    const href = r.url || blobUrl(r.path);
    return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + t + "</a>";
  }

  // 一次拉取整棵目录树，填充 NOTES.posts（不含正文）
  async function fetchNotes(force) {
    if (!notesConfigured()) return;
    if (force) notesReset();
    if (NOTES.loaded) return;
    if (notesLoading) return notesLoading;

    notesLoading = (async () => {
      const api =
        "https://api.github.com/repos/" +
        encodeURIComponent(NOTES.owner) +
        "/" +
        encodeURIComponent(NOTES.repo) +
        "/git/trees/" +
        encodeURIComponent(NOTES.branch) +
        "?recursive=1";

      const res = await fetch(api, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) {
        const hint =
          res.status === 404
            ? "（仓库/分支不存在，或仓库是私有的）"
            : res.status === 403 || res.status === 429
            ? "（触发 GitHub 匿名限流，稍后再试）"
            : "";
        throw new Error("GitHub API " + res.status + " " + res.statusText + " " + hint);
      }
      const data = await res.json();
      if (!data || !Array.isArray(data.tree)) throw new Error("返回格式异常：未取到目录树");

      const prefix = NOTES.dir ? NOTES.dir.replace(/^\/+|\/+$/g, "") + "/" : "";
      const inScope = (p) => !prefix || p.startsWith(prefix);

      // 资源索引：按 basename 建表，供图片 / wikilink 解析
      // （这里不套用 isIgnored，否则 images/ 目录下的图会被误排除）
      NOTES.assets = {};
      (data.tree || []).forEach((n) => {
        if (n.type !== "blob") return;
        if (/(^|\/)[.!]/.test(n.path)) return;
        if (/(^|\/)(node_modules|venv|site-packages|__pycache__)(\/|$)/i.test(n.path)) return;
        const base = n.path.split("/").pop();
        const add = (k) => {
          k = k.toLowerCase();
          (NOTES.assets[k] = NOTES.assets[k] || []).push(n.path);
        };
        add(base);
        if (isImagePath(n.path) || NOTES.exts.some((e) => n.path.toLowerCase().endsWith(e))) {
          add(base.replace(/\.[^.]+$/, ""));
        }
      });

      const posts = (data.tree || [])
        .filter((n) => n.type === "blob")
        .filter((n) => NOTES.exts.some((e) => n.path.toLowerCase().endsWith(e)))
        .filter((n) => inScope(n.path))
        .filter((n) => !isIgnored(n.path))
        .map((n) => ({
          path: n.path,
          dir: topDir(n.path),
          size: n.size || 0,
          title: titleFromPath(n.path),
          date: dateFromPath(n.path),
          tags: [],
          lines: null,
        }))
        .sort((a, b) => a.path.localeCompare(b.path));

      NOTES.posts = posts.slice(0, NOTES.limit);
      NOTES.truncated = !!data.truncated;
      NOTES.loaded = true;
    })();

    try {
      await notesLoading;
    } finally {
      notesLoading = null;
    }
  }

  // 按需拉取某一篇的正文并解析（带缓存）
  async function loadPost(i) {
    const p = NOTES.posts[i];
    if (!p) return null;
    if (p.lines) return p;
    const url =
      "https://raw.githubusercontent.com/" +
      encodeURIComponent(NOTES.owner) +
      "/" +
      encodeURIComponent(NOTES.repo) +
      "/" +
      encodeURIComponent(NOTES.branch) +
      "/" +
      p.path.split("/").map(encodeURIComponent).join("/");
    const r = await fetch(url);
    if (!r.ok) throw new Error("读取 " + p.path + " 失败：HTTP " + r.status);
    const parsed = parseNote(p.path.split("/").pop(), await r.text(), p.path);
    p.title = parsed.title || p.title;
    p.date = parsed.date || p.date;
    p.tags = parsed.tags || [];
    p.lines = parsed.lines;
    return p;
  }

  function notesReset() {
    NOTES.loaded = false;
    NOTES.posts = [];
    NOTES.assets = {};
    NOTES.truncated = false;
  }

  // 按目录聚合：{ dirName: [globalIndex, ...] }
  function notesByDir() {
    const map = {};
    NOTES.posts.forEach((p, i) => {
      (map[p.dir] = map[p.dir] || []).push(i);
    });
    return map;
  }

  /* ---------- Markdown -> 终端 ---------- */

  // 行内元素：先摘出图片/链接（避免被转义），转义后再套行内样式
  function mdInline(s, noteDir) {
    const stash = [];
    const keep = (html) => {
      stash.push(html);
      return "\u0000" + (stash.length - 1) + "\u0000";
    };

    // 原生 HTML <img src="...">
    s = s.replace(/<img\b[^>]*>/gi, (tag) => {
      const m = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
      if (!m) return tag;
      const a = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
      return keep(imgFigure(m[1] != null ? m[1] : m[2], a ? (a[1] != null ? a[1] : a[2]) : "", noteDir));
    });

    // ![alt](path "title")
    s = s.replace(/!\[([^\]]*)\]\(\s*([^)]+?)\s*\)/g, (_, alt, u) =>
      keep(imgFigure(u.replace(/\s+"[^"]*"$/, "").trim(), alt, noteDir))
    );

    // Obsidian 嵌入 ![[image.png]] / ![[image.png|300]]
    s = s.replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, name) => keep(imgFigure(name, "", noteDir)));

    // [text](url "title")
    s = s.replace(/\[([^\]]+)\]\(\s*([^)]+?)\s*\)/g, (_, text, u) =>
      keep(linkHtml(u.replace(/\s+"[^"]*"$/, "").trim(), text, noteDir))
    );

    // Obsidian 内链 [[note]] / [[note|别名]]
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) =>
      keep(linkHtml(target, alias || target, noteDir))
    );

    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<span class="cyan">$1</span>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<span class="bold">$1</span>');
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<span class=\"dim\">$2</span>");
    s = s.replace(/~~([^~]+)~~/g, "<s>$1</s>");
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[+i] || "");
  }

  // 块级元素 -> 一行行终端 HTML
  function mdToTerminal(md, noteDir) {
    const out = [];
    const lines = md.replace(/\r\n?/g, "\n").split("\n");
    let inCode = false;
    let codeBuf = [];
    let m;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];

      if (/^\s*```/.test(l)) {
        if (inCode) {
          out.push(
            '<div class="panel" style="margin:6px 0;"><pre style="margin:0;white-space:pre-wrap;color:var(--fg-dim)">' +
              esc(codeBuf.join("\n")) +
              "</pre></div>"
          );
          codeBuf = [];
          inCode = false;
        } else {
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        codeBuf.push(l);
        continue;
      }
      if (!l.trim()) {
        out.push("&nbsp;");
        continue;
      }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) {
        const lvl = m[1].length;
        const cls = lvl <= 2 ? "green bold glow" : "amber bold";
        out.push('<span class="' + cls + '">' + "#".repeat(lvl) + " " + mdInline(m[2], noteDir) + "</span>");
        continue;
      }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) {
        out.push('<span class="faint">' + "─".repeat(34) + "</span>");
        continue;
      }
      if ((m = /^\s*[-*+]\s+(.*)$/.exec(l))) {
        out.push('<span class="dim">  · </span>' + mdInline(m[1], noteDir));
        continue;
      }
      if ((m = /^\s*(\d+)\.\s+(.*)$/.exec(l))) {
        out.push('<span class="dim">  ' + m[1] + ". </span>" + mdInline(m[2], noteDir));
        continue;
      }
      if ((m = /^\s*>\s?(.*)$/.exec(l))) {
        out.push('<span class="faint">▌ </span><span class="dim">' + mdInline(m[1], noteDir) + "</span>");
        continue;
      }
      out.push(mdInline(l, noteDir));
    }
    if (inCode && codeBuf.length) {
      out.push(
        '<div class="panel" style="margin:6px 0;"><pre style="margin:0;white-space:pre-wrap;color:var(--fg-dim)">' +
          esc(codeBuf.join("\n")) +
          "</pre></div>"
      );
    }
    return out;
  }

  // 解析 --- front-matter --- （支持 title / date / tags）
  function parseFrontMatter(text) {
    const m = /^---\n([\s\S]*?)\n---\n?/.exec(text.replace(/\r\n?/g, "\n"));
    if (!m) return { meta: {}, body: text };
    const meta = {};
    m[1].split("\n").forEach((ln) => {
      const kv = /^([\w-]+):\s*(.*)$/.exec(ln);
      if (!kv) return;
      let v = kv[2].trim().replace(/^["']|["']$/g, "");
      if (/^\[.*\]$/.test(v)) {
        v = v.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      }
      meta[kv[1].toLowerCase()] = v;
    });
    return { meta, body: text.slice(m[0].length) };
  }

  // 摘要：正文里第一段非标题、非代码的文字
  function firstParagraph(md) {
    const lines = md.replace(/\r\n?/g, "\n").split("\n");
    let inCode = false;
    for (const l of lines) {
      if (/^\s*```/.test(l)) { inCode = !inCode; continue; }
      if (inCode) continue;
      const t = l.trim();
      if (!t || /^#{1,6}\s/.test(t) || /^[-*+]\s/.test(t) || /^\d+\.\s/.test(t) || /^[>|]/.test(t)) continue;
      const plain = t
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[`*_~]/g, "")
        .trim();
      if (plain) return plain.length > 90 ? plain.slice(0, 90) + " …" : plain;
    }
    return "";
  }

  function parseNote(filename, text, notePath) {
    const { meta, body } = parseFrontMatter(text);
    const noteDir = noteDirOf(notePath || filename);
    let title = typeof meta.title === "string" ? meta.title : "";
    if (!title) {
      const h = /^\s*#\s+(.+)$/m.exec(body);
      if (h) title = h[1].trim();
    }
    if (!title) title = filename.replace(/\.(md|markdown)$/i, "");

    let date = typeof meta.date === "string" ? meta.date : "";
    if (!date) {
      const d = /(\d{4}-\d{2}-\d{2})/.exec(filename);
      if (d) date = d[1];
    }
    date = String(date).slice(0, 10);

    let tags = meta.tags || meta.tag || [];
    if (typeof tags === "string") tags = tags.split(/[, ]+/).filter(Boolean);

    return { title, date, tags, desc: firstParagraph(body), lines: mdToTerminal(body, noteDir) };
  }

  /* ---------- 渲染片段 ---------- */
  function panel(title, inner) {
    return (
      '<div class="panel">' +
      (title ? '<div class="panel-title">' + title + "</div>" : "") +
      '<div class="panel-body">' + inner + "</div></div>"
    );
  }

  function skillList() {
    return SKILLS.map(
      (s) => '<span class="skill-item"><span class="tag">' + esc(s.name) + "</span></span>"
    ).join("");
  }

  function entries(list, kind) {
    return list
      .map((it, i) => {
        const idx = String(i + 1).padStart(2, "0");
        const tags = (it.tags || []).map((t) => '<span class="tag">' + esc(t) + "</span>").join("");
        const meta = it.date ? '<span class="meta"> ' + esc(it.date) + "</span>" : "";
        const body = it.desc ? '<div class="desc">' + esc(it.desc) + "</div>" : "";
        return (
          '<div class="entry" data-cmd="' +
          kind +
          " " +
          (i + 1) +
          '"><span class="idx">[' +
          idx +
          ']</span> <span class="title">' +
          esc(it.title) +
          "</span> " +
          tags +
          meta +
          body +
          "</div>"
        );
      })
      .join("");
  }

  const CHIPS = (arr) =>
    '<div class="line block">' +
    arr.map((c) => '<span class="chip" data-cmd="' + esc(c) + '">' + esc(c) + "</span>").join(" ") +
    "</div>";

  /* ---------- 命令实现 ---------- */
  const CMDS = {};

  CMDS.help = {
    desc: "显示可用命令",
    run() {
      raw('<span class="amber bold">可用命令</span> <span class="faint">(点击命令名或按 F1–F7 亦可)</span>');
      const rows = [
        ["whoami", "自我介绍"],
        ["skills", "技能栈"],
        ["projects [n]", "项目列表 / 查看第 n 个项目"],
        ["blog [分类]", "笔记分类 / 按分类或关键词列出"],
        ["post <n>", "阅读编号 n 的笔记"],
        ["refresh", "重新拉取 GitHub 笔记目录"],
        ["contact", "联系方式"],
        ["neofetch", "系统信息风格名片"],
        ["banner", "重新打印字符画"],
        ["ls", "列出虚拟文件"],
        ["cat <file>", "查看文件内容"],
        ["date", "当前时间"],
        ["echo <text>", "回显文本"],
        ["clear", "清屏"],
        ["exit", "退出（然并不会）"],
      ];
      raw(
        '<div class="kv">' +
          rows
            .map(
              (r) =>
                '<span class="k"><span class="link" data-cmd="' +
                esc(r[0]) +
                '">' +
                esc(r[0]) +
                "</span></span><span class=\"v faint\">" +
                esc(r[1]) +
                "</span>"
            )
            .join("") +
          "</div>"
      );
    },
  };

  CMDS.whoami = {
    desc: "自我介绍",
    run() {
      raw(bannerArt("GREEN") , "banner");
      raw('<span class="dim">Linux · OpenHarmony · Computer Vision · C++</span>');
      blank();
      raw(
        panel(
          '<span class="green">$</span> whoami',
          '<div class="green bold glow">' +
            esc(PROFILE.handle) +
            '</div><div class="faint">' +
            esc(PROFILE.role) +
            "</div>" +
            '<div class="dim" style="margin-top:6px;">' +
            PROFILE.intro.map(esc).join("<br>") +
            "</div>" +
            '<div style="margin-top:8px;">' +
            PROFILE.tags.map((t) => '<span class="tag">' + esc(t) + "</span>").join("") +
            "</div>"
        )
      );
      blank();
      raw('<span class="faint">下一步：</span>' + CHIPS(["skills", "projects", "blog", "contact"]));
    },
  };

  CMDS.skills = {
    desc: "技能栈",
    run() {
      raw('<span class="amber bold">── SKILLS ────────────────────────</span>');
      raw(skillList());
      blank();
      raw('<span class="faint">提示：</span>' + CHIPS(["projects", "neofetch"]));
    },
  };

  CMDS.projects = {
    desc: "项目列表",
    run(arg) {
      if (arg) return CMDS.projects.detail(arg);
      raw('<span class="amber bold">── PROJECTS ──────────────────────</span>');
      raw(entries(PROJECTS, "projects"));
      blank();
      raw('<span class="faint">查看详情：</span><span class="dim">projects &lt;n&gt;</span>');
    },
    detail(arg) {
      const i = parseInt(arg, 10) - 1;
      const p = PROJECTS[i];
      if (!p) return line("projects: 没有第 " + esc(arg) + " 个项目", "red");
      blank();
      raw('<span class="green bold">▌ ' + esc(p.title) + "</span>");
      raw('<span class="faint">  ' + p.tags.join(" · ") + "</span>");
      blank();
      raw('<span class="dim">' + esc(p.desc) + "</span>");
      blank();
    },
  };

  // 确保笔记已加载；未配置 / 失败时打印提示并返回 false
  async function ensureNotes() {
    if (!notesConfigured()) {
      notesPlaceholder();
      return false;
    }
    if (notesReady()) return true;
    line("正在从 GitHub 拉取目录树 ...", "dim");
    try {
      await fetchNotes();
    } catch (err) {
      notesError(err);
      return false;
    }
    if (!NOTES.posts.length) {
      notesEmpty();
      return false;
    }
    return true;
  }

  function noteUrl(p) {
    return (
      "https://github.com/" +
      NOTES.owner +
      "/" +
      NOTES.repo +
      "/blob/" +
      NOTES.branch +
      "/" +
      p.path.split("/").map(encodeURIComponent).join("/")
    );
  }

  function noteLine(i) {
    const p = NOTES.posts[i];
    const sub = p.path.split("/").slice(1).join("/") || p.path;
    return (
      '<div class="entry" data-cmd="post ' +
      (i + 1) +
      '"><span class="idx">[' +
      String(i + 1).padStart(3, "0") +
      ']</span> <span class="title">' +
      esc(p.title) +
      "</span>" +
      (p.date ? ' <span class="meta">' + esc(p.date) + "</span>" : "") +
      '<div class="meta">' +
      esc(sub) +
      "</div></div>"
    );
  }

  function listDirs() {
    const by = notesByDir();
    const dirs = Object.keys(by).sort();
    raw('<span class="faint">共 ' + NOTES.posts.length + " 篇 · " + dirs.length + " 个分类" +
      (NOTES.truncated ? '（仓库过大，结果被 GitHub 截断）' : "") + "</span>");
    blank();
    dirs.forEach((d, k) => {
      raw(
        '<div class="entry" data-cmd="blog ' +
          esc(d) +
          '"><span class="idx">[' +
          String(k + 1).padStart(2, "0") +
          ']</span> <span class="title">' +
          esc(d) +
          '</span> <span class="meta">' +
          by[d].length +
          " 篇</span></div>"
      );
    });
    blank();
    raw(
      '<span class="faint">进入分类：</span><span class="dim">blog &lt;分类名&gt;</span>  ' +
        '<span class="chip" data-cmd="blog all">blog all</span>  ' +
        '<span class="chip" data-cmd="refresh">refresh</span>'
    );
  }

  function listNotes(filter) {
    const f = String(filter || "").toLowerCase();
    const hits = [];
    NOTES.posts.forEach((p, i) => {
      if (
        p.dir.toLowerCase() === f ||
        p.path.toLowerCase().includes(f) ||
        p.title.toLowerCase().includes(f)
      )
        hits.push(i);
    });
    if (!hits.length) {
      line("没有匹配「" + filter + "」的笔记。", "red");
      return raw(CHIPS(["blog", "refresh"]));
    }
    raw('<span class="faint">匹配「' + esc(filter) + "」· " + hits.length + " 篇</span>");
    hits.forEach((i) => raw(noteLine(i)));
    blank();
    raw(
      '<span class="faint">阅读：</span><span class="dim">post &lt;编号&gt;</span>  ' +
        '<span class="chip" data-cmd="blog">blog</span>  ' +
        '<span class="chip" data-cmd="refresh">refresh</span>'
    );
  }

  CMDS.blog = {
    desc: "笔记分类 / 列表",
    run: async (arg) => {
      raw('<span class="amber bold">── NOTES ─────────────────────────</span>');
      if (!(await ensureNotes())) return;
      const a = (arg || "").trim();
      if (!a) return listDirs();

      if (a === "all" || a === "*") {
        raw('<span class="faint">全部 ' + NOTES.posts.length + " 篇</span>");
        NOTES.posts.forEach((_, i) => raw(noteLine(i)));
        blank();
        return raw(
          '<span class="faint">阅读：</span><span class="dim">post &lt;编号&gt;</span>  ' +
            '<span class="chip" data-cmd="blog">blog</span>'
        );
      }

      // 允许用分类序号代替名字
      const num = parseInt(a, 10);
      const dirs = Object.keys(notesByDir()).sort();
      const dirArg = !isNaN(num) && String(num) === a && dirs[num - 1] ? dirs[num - 1] : a;
      listNotes(dirArg);
      blank();
      raw('<span class="faint">返回分类：</span><span class="chip" data-cmd="blog">blog</span>');
    },
  };

  CMDS.post = {
    desc: "阅读笔记",
    run: async (arg) => {
      if (!(await ensureNotes())) return;
      const i = parseInt(arg, 10) - 1;
      const p = NOTES.posts[i];
      if (!p) {
        return line(
          "post: 没有编号 " + esc(arg || "?") + "（共 " + NOTES.posts.length + " 篇，先 blog 看目录）",
          "red"
        );
      }
      line("正在拉取 " + p.path + " ...", "dim");
      try {
        await loadPost(i);
      } catch (err) {
        notesError(err);
        return;
      }
      blank();
      raw('<span class="green bold"># ' + esc(p.title) + "</span>");
      raw(
        '<span class="faint">  ' +
          esc(p.path) +
          (p.date ? "  ·  " + esc(p.date) : "") +
          ((p.tags || []).length ? "  ·  " + p.tags.map(esc).join(", ") : "") +
          "</span>"
      );
      raw('<span class="faint">' + "─".repeat(42) + "</span>");

      let lines = p.lines || [];
      const cut = lines.length > NOTES.maxLines;
      if (cut) lines = lines.slice(0, NOTES.maxLines);
      lines.forEach((h) => raw(h));

      if (cut) {
        blank();
        raw('<span class="amber">… 已截断（原文 ' + p.lines.length + " 行）。完整内容：</span>");
        raw('<a href="' + noteUrl(p) + '" target="_blank" rel="noopener">' + esc(p.path) + "</a>");
      }
      blank();
      raw(
        '<span class="faint">返回：</span>' +
          CHIPS(["blog", "refresh"]) +
          '  <span class="faint">翻页：</span>' +
          '<span class="chip" data-cmd="post ' + Math.max(1, i) + '">&lt;</span> ' +
          '<span class="chip" data-cmd="post ' + Math.min(NOTES.posts.length, i + 2) + '">&gt;</span>'
      );
    },
  };

  CMDS.refresh = {
    desc: "重新拉取笔记目录",
    run: async () => {
      if (!notesConfigured()) {
        notesPlaceholder();
        return;
      }
      line("正在重新拉取目录树 ...", "dim");
      try {
        await fetchNotes(true);
      } catch (err) {
        notesError(err);
        return;
      }
      line("已收录 " + NOTES.posts.length + " 篇，输入 blog 查看分类。", "green");
    },
  };

  function notesPlaceholder() {
    blank();
    raw('<span class="dim">尚未配置 GitHub 笔记仓库。</span>');
    blank();
    raw(
      panel(
        "配置方法",
        '<div class="dim">编辑 <span class="cyan">assets/app.js</span> 顶部的 NOTES：</div>' +
          '<div class="faint" style="margin-top:6px;">const NOTES = {</div>' +
          '<div class="dim">  owner:  "GreenGdut",</div>' +
          '<div class="dim">  repo:   "my_openknowledge",</div>' +
          '<div class="dim">  branch: "main",  dir: "",  // dir 留空=整仓递归</div>' +
          '<div class="faint">};</div>' +
          '<div class="dim" style="margin-top:6px;">支持多级目录；自动收录所有 *.md，' +
          "忽略隐藏目录 / 依赖目录 / README。</div>"
      )
    );
    blank();
    raw('<span class="faint">先看看别的：</span>' + CHIPS(["projects", "skills", "whoami"]));
    blank();
  }

  function notesError(err) {
    blank();
    line("拉取笔记失败：" + (err && err.message ? err.message : err), "red");
    line("请检查 NOTES 的 owner / repo / branch / dir，以及网络是否可达。", "faint");
    blank();
    raw(CHIPS(["refresh", "projects"]));
    blank();
  }

  function notesEmpty() {
    line("仓库里没有找到可用的 Markdown 文件。", "dim");
    blank();
    raw(
      '<span class="faint">检查 NOTES.dir（当前：' +
        (NOTES.dir || "整仓递归") +
        "）或忽略规则。</span>" +
        CHIPS(["refresh"])
    );
    blank();
  }

  CMDS.contact = {
    desc: "联系方式",
    run() {
      raw('<span class="amber bold">── CONTACT ───────────────────────</span>');
      raw(
        '<div class="kv">' +
          '<span class="k">email</span><span class="v"><span class="link">' + esc(PROFILE.email) + "</span></span>" +
          '<span class="k">github</span><span class="v"><span class="link">' + esc(PROFILE.github) + "</span></span>" +
          '<span class="k">location</span><span class="v">' + esc(PROFILE.location) + "</span>" +
          '<span class="k">focus</span><span class="v">' + PROFILE.tags.map(esc).join(" / ") + "</span>" +
          "</div>"
      );
      blank();
      raw(CHIPS(["whoami", "blog"]));
    },
  };

  CMDS.neofetch = {
    desc: "系统信息风格名片",
    run() {
      const logo = [
        "   .--.      ",
        "  |o_o |     ",
        "  |:_/ |     ",
        " //   \\ \\    ",
        "(|     | )   ",
        "/'\\_   _/`\\  ",
        "\\___)=(___/  ",
      ].join("\n");
      const info = [
        ["OS", "TUI-Blog Linux x86_64"],
        ["Host", PROFILE.host],
        ["Kernel", "6.x-generic"],
        ["Shell", "tui-blog-sh 1.0"],
        ["Role", PROFILE.role],
        ["Lang", "Linux / OpenHarmony / CV / C/C++"],
        ["Editor", "vim / neovim"],
        ["Uptime", Math.floor(performance.now() / 1000) + "s"],
      ]
        .map(
          (r) =>
            '<span class="k" style="color:var(--cyan)">' + r[0] + "</span>" +
            '<span class="v">: ' + esc(r[1]) + "</span>"
        )
        .join("<br>");
      raw(
        '<div class="panel"><div style="display:flex;gap:26px;flex-wrap:wrap;align-items:flex-start;">' +
          '<pre class="green" style="margin:0;text-shadow:0 0 10px var(--green-glow)">' +
          esc(logo) +
          '</pre><div style="flex:1;min-width:240px;">' +
          '<div class="green bold glow">' + esc(PROFILE.handle) + "@" + esc(PROFILE.host) + "</div>" +
          '<span class="faint">' + "─".repeat(28) + "</span><br>" +
          info +
          "</div></div></div>"
      );
    },
  };

  CMDS.banner = {
    desc: "打印字符画",
    run() {
      raw(bannerArt("GREEN_GDUT"), "banner glow");
      raw('<span class="dim">   Linux · OpenHarmony · Computer Vision · C++</span>');
    },
  };

  const FILES = {
    "readme.md": [
      "# green_gdut 的终端博客",
      "",
      "一个用纯 HTML/CSS/JS 写的 TUI 风格个人主页。",
      "",
      "主题：Linux / OpenHarmony / 计算机视觉 / C/C++。",
    ],
    "about.txt": PROFILE.intro,
    "skills.cfg": SKILLS.map((s) => s.name + " = " + s.pct + "%"),
    "links.txt": ["email: " + PROFILE.email, "github: " + PROFILE.github],
  };

  CMDS.ls = {
    desc: "列出文件",
    run() {
      const names = Object.keys(FILES);
      raw('<span class="faint">total ' + names.length + "</span>");
      raw(
        names
          .map((n) => '<span class="link" data-cmd="cat ' + esc(n) + '">' + esc(n) + "</span>")
          .join("   ")
      );
      blank();
      raw(CHIPS(["cat readme.md", "cat skills.cfg"]));
    },
  };

  CMDS.cat = {
    desc: "查看文件",
    run(arg) {
      if (!arg) return line("cat: 缺少文件名，试试 ls", "red");
      const f = FILES[arg];
      if (!f) return line("cat: " + esc(arg) + ": 没有那个文件或目录", "red");
      raw('<span class="faint">── ' + esc(arg) + " ──</span>");
      f.forEach((l) => line(l, l.startsWith("#") ? "green bold" : "dim"));
    },
  };

  CMDS.date = {
    desc: "当前时间",
    run() {
      line(new Date().toString());
    },
  };

  CMDS.echo = {
    desc: "回显",
    run(arg) {
      line(arg || "");
    },
  };

  CMDS.clear = {
    desc: "清屏",
    run() {
      output.innerHTML = "";
    },
  };

  CMDS.pwd = { desc: "当前路径", run() { line("/home/" + PROFILE.handle + "/blog"); } };

  CMDS.sudo = {
    desc: "提权（不会成功）",
    run() {
      line("[sudo] password for " + PROFILE.handle + ": ***********", "dim");
      line("green_gdut is not in the sudoers file. This incident has been reported.", "red");
    },
  };

  CMDS.man = { desc: "手册", run(a) { CMDS.help.run(); } };

  CMDS.exit = {
    desc: "退出",
    run() {
      line("logout", "dim");
      line("Connection to tui_blog closed.", "faint");
      setTimeout(() => {
        output.innerHTML = "";
        type("(再玩一会嘛)", "dim", 40);
      }, 500);
    },
  };

  CMDS["rm"] = {
    desc: "危险操作",
    run(arg) {
      if (/-\w*rf\w*/.test(arg) && /\/|\*/.test(arg)) {
        line("rm: 拒绝执行：删除根目录属于 bad idea", "red");
        line("提示：本页面是只读的，放心 :)", "faint");
      } else {
        line("rm: 没有那个文件或目录", "red");
      }
    },
  };

  CMDS.tree = {
    desc: "目录树",
    run() {
      const t = [
        "~/blog",
        "├── index.html",
        "├── assets/",
        "│   ├── style.css",
        "│   └── app.js",
        "└── readme.md",
      ];
      raw(
        '<pre class="dim" style="margin:0;font:inherit;">' + esc(t.join("\n")) + "</pre>"
      );
    },
  };

  /* ---------- 命令分发 ---------- */
  const ALIASES = { "?": "help", h: "help", ls: "ls", dir: "ls", info: "neofetch", posts: "blog", resume: "projects", reload: "refresh" };

  async function exec(rawCmd) {
    const cmd = rawCmd.trim();
    // 回显
    raw(
      '<span class="p-user">' + esc(PROFILE.handle) + '</span>' +
        '<span class="p-at">@</span><span class="p-host">' + esc(PROFILE.host) + "</span>" +
        '<span class="p-colon">:</span><span class="p-path">~</span>' +
        '<span class="p-sym">$</span> <span class="echo-cmd">' + esc(cmd) + "</span>"
    );
    if (!cmd) return;

    const m = cmd.match(/^(\S+)\s*(.*)$/);
    let name = m[1].toLowerCase();
    const arg = m[2];
    name = ALIASES[name] || name;

    const c = CMDS[name];
    if (!c) {
      blank();
      line("tui-blog: command not found: " + m[1], "red");
      line("试试 help 查看全部命令。", "faint");
      return;
    }
    blank();
    await c.run(arg);
    blank();
  }

  /* ---------- 输入交互 ---------- */
  let histIdx = -1;
  let inputHistory = [];

  function syncCaret() {
    const w = Math.max(1, input.value.length + 1);
    input.style.width = w + "ch";
    caret.classList.toggle("hidden", false);
  }

  input.addEventListener("input", syncCaret);

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!inputHistory.length) return;
      if (histIdx === -1) histIdx = inputHistory.length;
      histIdx = Math.max(0, histIdx - 1);
      input.value = inputHistory[histIdx];
      syncCaret();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === -1) return;
      histIdx = Math.min(inputHistory.length, histIdx + 1);
      input.value = histIdx === inputHistory.length ? "" : inputHistory[histIdx];
      syncCaret();
    } else if (e.key === "Tab") {
      e.preventDefault();
      const v = input.value;
      const names = Object.keys(CMDS);
      const hit = names.filter((n) => n.startsWith(v.toLowerCase()));
      if (hit.length === 1) {
        input.value = hit[0] + " ";
        syncCaret();
      } else if (hit.length > 1 && v) {
        line(hit.join("   "), "faint");
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      CMDS.clear.run();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const v = input.value;
    input.value = "";
    syncCaret();
    if (v.trim()) {
      inputHistory.push(v);
      histIdx = -1;
    }
    busy = true;
    await exec(v);
    busy = false;
    input.focus();
    scrollBottom();
  });

  /* 点击委托：命令 chip / 条目 / 链接 */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-cmd]");
    if (t) {
      e.preventDefault();
      const c = t.getAttribute("data-cmd");
      input.value = c;
      syncCaret();
      input.focus();
      // 直接执行，模拟回车
      inputHistory.push(c);
      (async () => {
        busy = true;
        await exec(c);
        busy = false;
        input.value = "";
        syncCaret();
        input.focus();
        scrollBottom();
      })();
      return;
    }
    if (e.target.closest("#terminal")) input.focus();
  });

  /* 图片加载失败时降级为文本提示 */
  document.addEventListener(
    "error",
    (e) => {
      const t = e.target;
      if (!t || t.tagName !== "IMG") return;
      const src = t.getAttribute("src") || "";
      const span = document.createElement("span");
      span.className = "md-missing";
      span.textContent = "[图片加载失败] " + src;
      const fig = t.closest(".md-figure");
      (fig || t).replaceWith(span);
    },
    true
  );

  /* F1–F7 快捷键 */
  const FKEYS = ["help", "whoami", "projects", "blog", "contact", "neofetch", "clear"];
  window.addEventListener("keydown", (e) => {
    const m = /^F([1-7])$/.exec(e.key);
    if (m) {
      e.preventDefault();
      const c = FKEYS[+m[1] - 1];
      input.value = c;
      syncCaret();
      if (c === "clear") { CMDS.clear.run(); input.value = ""; syncCaret(); return; }
      inputHistory.push(c);
      (async () => {
        busy = true;
        await exec(c);
        busy = false;
        input.value = "";
        syncCaret();
        input.focus();
      })();
    }
  });

  /* 时钟 */
  function tick() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    clockEl.textContent = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }
  setInterval(tick, 1000);
  tick();

  /* ---------- 启动序列 ---------- */
  async function boot() {
    const P = ' <span class="faint">::</span> ';
    const ok = '<span class="green bold">[  OK  ]</span>';
    const seq = [
      '<span class="faint">tui-blog bootloader v1.0 — initializing ...</span>',
      '[ <span class="cyan">0.000000</span> ] ' + ok + " " + P + "Reached target Local File Systems.",
      '[ <span class="cyan">0.041207</span> ] ' + ok + " " + P + "Mounted /home/" + esc(PROFILE.handle) + "/blog.",
      '[ <span class="cyan">0.118340</span> ] ' + ok + " " + P + "Started Computer Vision service.",
      '[ <span class="cyan">0.202915</span> ] ' + ok + " " + P + "Loaded modules: linux openharmony cpp cv.",
      '[ <span class="cyan">0.266001</span> ] ' + ok + " " + P + "Reached target TUI Blog.",
    ];
    for (const s of seq) {
      await sleep(160);
      raw(s);
    }
    await sleep(220);
    blank();
    raw(bannerArt("GREEN_GDUT"), "banner glow");
    await type("   Linux · OpenHarmony · Computer Vision · C++", "dim", 14);
    blank();
    await type("Welcome, visitor. 输入 help 查看命令，或直接点击下方提示。", "green", 12);
    blank();
    raw('<span class="faint">可用：</span>' + CHIPS(["whoami", "skills", "projects", "blog", "contact", "neofetch"]));
    blank();
    input.focus();
  }

  /* 旧浏览器兜底 */
  applyProfile();
  syncCaret();
  boot();
})();
