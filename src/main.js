(function () {
  "use strict";

  // If index.html is double-clicked (file://) talk to the backend directly.
  var API = (location.protocol === "file:" ? "http://localhost:5000" : "") + "/api/news";

  var ICONS = {
    World: "🌍", Politics: "🏛️", Business: "📈", Technology: "💻",
    Sports: "🏆", Health: "🩺", Entertainment: "🎬", General: "📰",
  };

  var $ = function (id) { return document.getElementById(id); };
  var state = { articles: [], category: "All", search: "", offline: false };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) { return /^https?:\/\/\S+$/i.test(u || "") ? u : ""; }
  function catClass(c) {
    var k = String(c || "General").toLowerCase().replace(/[^a-z]/g, "");
    return "cat-" + (ICONS[c] ? k : "general");
  }
  function icon(c) { return ICONS[c] || "📰"; }
  function timeAgo(iso) {
    var s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    if (s < 86400 * 7) return Math.floor(s / 86400) + " d ago";
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  function fullDate(iso) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
  }
  function excerpt(t, n) {
    t = String(t || "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t;
  }
  function paragraphs(t) {
    return String(t || "").split(/\n{2,}|\r\n\r\n/).map(function (p) {
      return "<p>" + esc(p.trim()).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }
  var toastTimer;
  function toast(msg, bad) {
    var el = $("toast");
    el.textContent = msg;
    el.className = "toast" + (bad ? " bad" : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
  }

  // ---------- API ----------
  function api(url, opt) {
    return fetch(url, Object.assign({ headers: { "Content-Type": "application/json" } }, opt || {}))
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error(data.message || "Request failed");
          return data;
        });
      });
  }

  function load() {
    return api(API).then(function (items) {
      state.articles = items; state.offline = false;
    }).catch(function () {
      state.articles = (window.FALLBACK_NEWS || []).slice().sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      state.offline = true;
    }).then(render);
  }

  // ---------- rendering ----------
  function filtered() {
    var q = state.search.toLowerCase();
    return state.articles.filter(function (n) {
      if (state.category !== "All" && n.category !== state.category) return false;
      if (!q) return true;
      return [n.title, n.author, n.category, n.content, n.source].some(function (f) {
        return String(f || "").toLowerCase().indexOf(q) !== -1;
      });
    });
  }

  function banner(n, cls) {
    var img = safeUrl(n.imageUrl);
    return '<div class="banner ' + catClass(n.category) + " " + (cls || "") + '">' +
      (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.remove()">' : "") +
      '<span class="banner-icon">' + icon(n.category) + "</span></div>";
  }

  function renderTicker() {
    var heads = state.articles.slice(0, 8).map(function (n) { return esc(n.title); });
    var line = heads.map(function (h) { return "<span>" + h + "</span>"; }).join("");
    $("ticker").innerHTML = line + line;
  }

  function renderHero() {
    var n = state.articles[0];
    if (!n || state.category !== "All" || state.search) { $("hero").innerHTML = ""; return; }
    $("hero").innerHTML =
      '<article class="hero ' + catClass(n.category) + '" data-open="' + n.id + '">' +
        (safeUrl(n.imageUrl) ? '<img class="hero-img" src="' + esc(safeUrl(n.imageUrl)) + '" alt="" onerror="this.remove()">' : "") +
        '<div class="hero-shade"></div>' +
        '<div class="hero-body">' +
          '<span class="chip">' + icon(n.category) + " " + esc(n.category) + " · Top story</span>" +
          "<h1>" + esc(n.title) + "</h1>" +
          "<p>" + esc(excerpt(n.content, 220)) + "</p>" +
          '<div class="hero-meta">' + esc(n.author) + " · " + timeAgo(n.createdAt) + "</div>" +
          '<button class="btn light" data-open="' + n.id + '">Read story →</button>' +
        "</div>" +
      "</article>";
  }

  function renderPills() {
    var counts = { All: state.articles.length };
    state.articles.forEach(function (n) { counts[n.category] = (counts[n.category] || 0) + 1; });
    var cats = ["All"].concat(Object.keys(counts).filter(function (c) { return c !== "All"; }).sort());
    $("pills").innerHTML = cats.map(function (c) {
      return '<button class="pill' + (c === state.category ? " on" : "") + '" data-cat="' + esc(c) + '">' +
        (c === "All" ? "🔥" : icon(c)) + " " + esc(c) + " <em>" + counts[c] + "</em></button>";
    }).join("");
  }

  function renderGrid() {
    var list = filtered();
    $("count").textContent = list.length + (list.length === 1 ? " story" : " stories");
    if (!list.length) {
      $("grid").innerHTML = '<div class="empty">😶 No stories found.<br><small>Try another category or search.</small></div>';
      return;
    }
    $("grid").innerHTML = list.map(function (n) {
      return '<article class="card">' +
        '<div class="card-click" data-open="' + n.id + '">' + banner(n) +
        '<div class="card-body">' +
          '<div class="meta"><span class="tag ' + catClass(n.category) + '">' + esc(n.category) + "</span>" +
          "<span>" + timeAgo(n.createdAt) + (n.updatedAt !== n.createdAt ? " · edited" : "") + "</span></div>" +
          "<h3>" + esc(n.title) + "</h3>" +
          "<p>" + esc(excerpt(n.content, 150)) + "</p>" +
        "</div></div>" +
        '<div class="card-foot"><span class="by">' + esc(n.author) + "</span>" +
          '<span class="card-actions">' +
            '<button class="icon-btn" title="Edit" data-edit="' + n.id + '">✏️</button>' +
            '<button class="icon-btn" title="Delete" data-delete="' + n.id + '">🗑️</button>' +
          "</span></div>" +
      "</article>";
    }).join("");
  }

  function render() {
    var off = $("offline");
    if (state.offline) {
      off.hidden = false;
      off.innerHTML = "⚠️ <b>Backend is not running</b> — showing a saved copy (read-only). " +
        "Open a terminal in the <code>backend</code> folder and run <code>npm start</code>, then refresh this page.";
    } else { off.hidden = true; }
    renderTicker(); renderHero(); renderPills(); renderGrid();
  }

  // ---------- reader ----------
  function openReader(id) {
    var n = state.articles.find(function (a) { return a.id === Number(id); });
    if (!n) return;
    var link = safeUrl(n.sourceUrl);
    $("reader").innerHTML =
      '<button class="close" data-close="reader" aria-label="Close">✕</button>' +
      banner(n, "tall") +
      '<div class="reader-body">' +
        '<div class="meta"><span class="tag ' + catClass(n.category) + '">' + esc(n.category) + "</span>" +
        "<span>" + esc(fullDate(n.createdAt)) + "</span></div>" +
        "<h2>" + esc(n.title) + "</h2>" +
        '<div class="byline">By <b>' + esc(n.author) + "</b>" + (n.source ? " · Source: " + esc(n.source) : "") + "</div>" +
        '<div class="story">' + paragraphs(n.content) + "</div>" +
        '<div class="actions">' +
          (link ? '<a class="btn glow" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Read the original ↗</a>' : "") +
          '<button class="btn ghost" data-edit="' + n.id + '">Edit</button>' +
          '<button class="btn ghost" data-close="reader">Close</button>' +
        "</div>" +
      "</div>";
    $("reader-overlay").hidden = false;
    document.body.classList.add("noscroll");
  }

  function closeAll() {
    $("reader-overlay").hidden = true;
    $("form-overlay").hidden = true;
    document.body.classList.remove("noscroll");
  }

  // ---------- form ----------
  var FIELDS = ["title", "author", "category", "content", "source", "sourceUrl", "imageUrl"];
  var NAMES = { title: "Headline", author: "Author", category: "Category", content: "Story",
                source: "Source name", sourceUrl: "Source link", imageUrl: "Image link" };
  var touched = {};

  function showError(m) { $("form-error").textContent = m; $("form-error").hidden = !m; }

  function validUrl(v) {
    try {
      var u = new URL(v);
      return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.indexOf(".") !== -1;
    } catch (e) { return false; }
  }

  // Returns an error message for one field, or "" if it is fine.
  // Adding a NEW article: every field is required. Editing: only headline, author, story.
  function checkField(name, v, isNew) {
    v = String(v || "").trim();
    if (name === "title") {
      if (!v) return "Headline is required.";
      if (isNew && v.length < 10) return "Headline must be at least 10 characters.";
    }
    if (name === "author") {
      if (!v) return "Author is required.";
      if (isNew && v.length < 2) return "Author must be at least 2 characters.";
    }
    if (name === "category" && isNew && !v) return "Please choose a category.";
    if (name === "content") {
      if (!v) return "Story is required.";
      if (isNew && v.length < 50) return "Story must be at least 50 characters (" + v.length + "/50).";
    }
    if (name === "source" && isNew && !v) return "Source name is required.";
    if (name === "sourceUrl" || name === "imageUrl") {
      if (!v) return isNew ? NAMES[name] + " is required." : "";
      if (!validUrl(v)) return NAMES[name] + " must be a valid http:// or https:// link.";
    }
    return "";
  }

  function setFieldState(name, msg, show) {
    var el = $("f-" + name);
    var out = document.querySelector('.field-error[data-for="f-' + name + '"]');
    el.classList.toggle("invalid", !!(show && msg));
    el.classList.toggle("valid", !!(show && !msg && String(el.value).trim()));
    if (out) out.textContent = show ? msg : "";
  }

  // Check the whole form. showAll = show errors on every field (used on submit).
  function validateForm(showAll) {
    var isNew = !$("f-id").value;
    var bad = [];
    FIELDS.forEach(function (f) {
      var msg = checkField(f, $("f-" + f).value, isNew);
      if (msg) bad.push(f);
      setFieldState(f, msg, showAll || touched[f]);
    });
    $("f-submit").disabled = isNew && bad.length > 0;
    return bad;
  }

  function openForm(id) {
    if (state.offline) { toast("Start the backend first (npm start) to add or edit news.", true); return; }
    var n = id ? state.articles.find(function (a) { return a.id === Number(id); }) : null;
    $("reader-overlay").hidden = true;
    $("news-form").reset();
    showError("");
    touched = {};
    $("form-title").textContent = n ? "Edit article" : "New article";
    $("f-submit").textContent = n ? "Save changes" : "Publish";
    $("f-id").value = n ? n.id : "";
    document.querySelector(".req-note").hidden = !!n;
    if (n) {
      $("f-title").value = n.title; $("f-author").value = n.author; $("f-category").value = n.category;
      $("f-content").value = n.content; $("f-source").value = n.source || "";
      $("f-sourceUrl").value = n.sourceUrl || ""; $("f-imageUrl").value = n.imageUrl || "";
    }
    validateForm(false);
    $("form-overlay").hidden = false;
    document.body.classList.add("noscroll");
    setTimeout(function () { $("f-title").focus(); }, 50);
  }

  // live verification while typing / leaving a field
  FIELDS.forEach(function (f) {
    var el = $("f-" + f);
    el.addEventListener("input", function () { touched[f] = true; validateForm(false); });
    el.addEventListener("change", function () { touched[f] = true; validateForm(false); });
    el.addEventListener("blur", function () { touched[f] = true; validateForm(false); });
  });

  $("news-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var bad = validateForm(true);
    if (bad.length) {
      showError("Please complete every required field: " + bad.map(function (f) { return NAMES[f]; }).join(", ") + ".");
      $("f-" + bad[0]).focus();
      return;
    }
    showError("");
    var body = {};
    FIELDS.forEach(function (f) { body[f] = $("f-" + f).value.trim(); });
    var id = $("f-id").value;
    $("f-submit").disabled = true;
    var req = id ? api(API + "/" + id, { method: "PUT", body: JSON.stringify(body) })
                 : api(API, { method: "POST", body: JSON.stringify(body) });
    req.then(function () {
      closeAll(); toast(id ? "Article updated ✔" : "Article published ✔"); return load();
    }).catch(function (err) { showError(err.message); validateForm(true); });
  });

  // ---------- events ----------
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-open],[data-edit],[data-delete],[data-cat],[data-close]");
    if (t) {
      if (t.dataset.edit) return openForm(t.dataset.edit);
      if (t.dataset.delete) {
        if (state.offline) return toast("Start the backend first (npm start).", true);
        if (confirm("Delete this article?")) {
          api(API + "/" + t.dataset.delete, { method: "DELETE" })
            .then(function () { toast("Article deleted 🗑️"); return load(); })
            .catch(function (err) { toast(err.message, true); });
        }
        return;
      }
      if (t.dataset.cat) { state.category = t.dataset.cat; return render(); }
      if (t.dataset.close) return closeAll();
      if (t.dataset.open) return openReader(t.dataset.open);
    }
    if (e.target.classList && e.target.classList.contains("overlay")) closeAll();
  });

  $("btn-new").addEventListener("click", function () { openForm(); });
  $("form-close").addEventListener("click", closeAll);
  $("f-cancel").addEventListener("click", closeAll);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });
  $("search").addEventListener("input", function (e) { state.search = e.target.value.trim(); renderHero(); renderGrid(); });

  $("today").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  load();
})();
