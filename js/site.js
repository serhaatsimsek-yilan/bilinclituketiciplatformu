(function () {
  function shuffle(list) {
    const items = list.slice();
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = items[i];
      items[i] = items[j];
      items[j] = temp;
    }
    return items;
  }

  function bindTickerHover(root) {
    root.addEventListener("mouseenter", function () {
      root.classList.add("is-paused");
    });
    root.addEventListener("mouseleave", function () {
      root.classList.remove("is-paused");
      const focused = root.querySelector(":focus");
      if (focused) focused.blur();
    });
  }

  function syncTickerCardWidth(root) {
    const gap = 18;
    let visible;
    if (window.matchMedia("(min-width: 1100px)").matches) {
      visible = 4;
    } else if (window.matchMedia("(min-width: 981px)").matches) {
      visible = 3;
    } else if (window.matchMedia("(min-width: 641px)").matches) {
      visible = 1.15;
    } else {
      visible = 1.08;
    }
    const width = Math.max(200, (root.clientWidth - gap * (visible - 1)) / visible);
    root.style.setProperty("--ticker-card", width + "px");
    root.style.setProperty("--ticker-visible", String(visible));
  }

  function initTickerRoot(root) {
    if (!root) return;

    const track =
      root.querySelector(".article-ticker-track, .story-ticker-track") || root;
    const itemSelector = root.matches("[data-story-ticker]")
      ? ".story-card"
      : ".article";
    const dedupeKey = function (card) {
      if (root.matches("[data-story-ticker]")) {
        const text = card.querySelector("p");
        return (text && text.textContent) || "";
      }
      return card.getAttribute("href") || "";
    };

    if (root.dataset.ready !== "1") {
      const unique = [];
      const seen = {};
      Array.from(track.querySelectorAll(itemSelector)).forEach(function (card) {
        const key = dedupeKey(card);
        if (seen[key]) return;
        seen[key] = true;
        unique.push(card);
      });
      if (unique.length >= 2 && unique.length > 3) {
        const ordered = shuffle(unique);
        track.innerHTML = "";
        ordered.forEach(function (card) {
          track.appendChild(card);
        });
        ordered.forEach(function (card) {
          track.appendChild(card.cloneNode(true));
        });
      } else if (root.classList.contains("story-ticker-compact")) {
        root.classList.add("is-static");
      }
      root.dataset.ready = "1";
    }

    syncTickerCardWidth(root);

    if (root.dataset.resizeBound !== "1") {
      window.addEventListener("resize", function () {
        syncTickerCardWidth(root);
      });
      root.dataset.resizeBound = "1";
    }

    if (root.dataset.hoverBound !== "1") {
      bindTickerHover(root);
      root.dataset.hoverBound = "1";
    }
  }

  function initTickers() {
    document.querySelectorAll("[data-article-ticker]").forEach(initTickerRoot);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTickers);
  } else {
    initTickers();
  }
})();

(function () {
  document.querySelectorAll("[data-article-limit]").forEach(function (grid) {
    const limit = parseInt(grid.getAttribute("data-article-limit") || "3", 10);
    const items = Array.from(grid.querySelectorAll(":scope > .article"));
    items.forEach(function (item, index) {
      item.classList.toggle("article-extra", index >= limit);
    });
    if (items.length <= limit) return;

    if (grid.nextElementSibling && grid.nextElementSibling.classList.contains("see-all-wrap")) return;

    const wrap = document.createElement("div");
    wrap.className = "see-all-wrap";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "see-all";
    button.setAttribute("aria-expanded", "false");
    button.textContent = "Tümünü gör";
    wrap.appendChild(button);
    grid.insertAdjacentElement("afterend", wrap);

    button.addEventListener("click", function () {
      const open = grid.classList.toggle("is-expanded");
      items.forEach(function (item, index) {
        item.classList.toggle("article-extra", !open && index >= limit);
      });
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.textContent = open ? "Daha az göster" : "Tümünü gör";
    });
  });
})();

(function () {
  const toggle = document.querySelector("[data-nav-toggle]");
  const drawer = document.querySelector("[data-nav-drawer]");
  if (!toggle || !drawer) return;

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    drawer.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
  }

  toggle.addEventListener("click", function () {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  drawer.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      setOpen(false);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });

  document.addEventListener("click", function (e) {
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    if (drawer.contains(e.target) || toggle.contains(e.target)) return;
    setOpen(false);
  });

  const headerCta = document.querySelector(".header-tools .nav-cta");
  if (headerCta && !drawer.querySelector(".nav-cta-mobile")) {
    const mobileCta = headerCta.cloneNode(true);
    mobileCta.classList.add("nav-cta-mobile");
    drawer.appendChild(mobileCta);
  }
})();

(function () {
  var FALLBACK_STORIES = [
    {
      name: "E.K.",
      topic_label: "Uçuş gecikmesi",
      meta: "İstanbul · Ağustos 2026",
      text: "Uçuşum dört saat rötar yaptı, havayolu net bir cevap vermedi. Platformda uçuşumu sorguladım; evrak listesi geldi, süreci site üzerinden tamamladım."
    },
    {
      name: "B.Ö.",
      topic_label: "Uçuş iptali",
      meta: "Konya · Ağustos 2026",
      text: "Seferim iptal edildi, bilet iadesi yerine kupon teklif ettiler. Uçuş tazminatı formunu doldurdum; dosyam incelendi, sonraki adımları platformdan aldım."
    },
    {
      name: "M.A.",
      topic_label: "Bagaj gecikmesi",
      meta: "İzmir · Temmuz 2026",
      text: "Aktarmada bagajım gecikmeli geldi, masraf talebim reddedildi. Siteye başvurup uçuş bilgilerimi paylaştım; yönlendirme sayesinde sorunumu çözdüm.",
      reply: "Bagaj gecikmesinde PIR tutanağı ve uçuş biletleri dosyanın temelidir. Uçuş bilgilerinizi platformda paylaşarak ön inceleme talep edebilirsiniz.",
      reply_meta: "Ağustos 2026"
    },
    {
      name: "S.Y.",
      topic_label: "Uçuş gecikmesi",
      meta: "Ankara · Ağustos 2026",
      text: "Dış hat dönüş uçuşumuz beş saat gecikti. THY yalnızca yemek kuponu verdi; varış saatini resmî kayıtla belgeledikten sonra platforma başvurdum."
    },
    {
      name: "D.K.",
      topic_label: "Uçağa alınmama",
      meta: "Antalya · Temmuz 2026",
      text: "Pegasus uçuşunda overbooking nedeniyle uçağa alınmadım. Kapıda imzalatılan belgeyi okumadan imza atmamak gerektiğini sonradan öğrendim.",
      reply: "Kabul edilmeme hallerinde check-in kaydı ve denied boarding formu kritiktir. Dosyanızı platforma ileterek ön değerlendirme alabilirsiniz.",
      reply_meta: "Ağustos 2026"
    },
    {
      name: "H.C.",
      topic_label: "Bagaj kaybı",
      meta: "İstanbul · Temmuz 2026",
      text: "Frankfurt aktarmalı uçuşta bagajım kayboldu. PIR tutanağı aldım; bir hafta sonra geldi ama acil ihtiyaç masrafları için ayrı yazılı talep gerekiyormuş."
    }
  ];

  function storyCard(item) {
    const el = document.createElement("article");
    el.className = "story-card";
    const meta = document.createElement("div");
    meta.className = "story-meta";
    const badge = document.createElement("span");
    badge.className = "story-badge";
    badge.textContent = item.topic_label || item.topic || "";
    const name = document.createElement("strong");
    name.textContent = item.name || "Anonim";
    meta.appendChild(badge);
    meta.appendChild(name);
    if (item.meta) {
      const extra = document.createElement("span");
      extra.textContent = item.meta;
      meta.appendChild(extra);
    }
    const text = document.createElement("p");
    text.className = "story-text";
    text.textContent = item.text || "";
    el.appendChild(meta);
    el.appendChild(text);
    if (item.reply) {
      const reply = document.createElement("div");
      reply.className = "story-reply";
      const label = document.createElement("p");
      label.className = "story-reply-label";
      label.textContent = "Platform yanıtı";
      const replyText = document.createElement("p");
      replyText.className = "story-reply-text";
      replyText.textContent = item.reply;
      reply.appendChild(label);
      reply.appendChild(replyText);
      if (item.reply_meta) {
        const replyMeta = document.createElement("p");
        replyMeta.className = "story-reply-meta";
        replyMeta.textContent = item.reply_meta;
        reply.appendChild(replyMeta);
      }
      el.appendChild(reply);
    }
    return el;
  }

  function fillStories(root, stories, limit) {
    const empty = root.querySelector("[data-stories-empty]");
    root.querySelectorAll(".story-card").forEach(function (card) {
      card.remove();
    });
    const list = Array.isArray(stories) ? stories.slice(0, limit || stories.length) : [];
    if (!list.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    list.forEach(function (item) {
      root.appendChild(storyCard(item));
    });
  }

  document.querySelectorAll("[data-stories-list]").forEach(function (root) {
    if (root.matches("[data-story-ticker]")) return;
    const limit = parseInt(root.getAttribute("data-stories-limit") || "0", 10);
    fetch("api/stories.php", { headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) throw new Error("api");
        return response.json();
      })
      .then(function (json) {
        fillStories(root, json && json.stories, limit > 0 ? limit : 0);
      })
      .catch(function () {
        var limit = parseInt(root.getAttribute("data-stories-limit") || "0", 10);
        fillStories(root, FALLBACK_STORIES, limit > 0 ? limit : 0);
      });
  });
})();

(function () {
  const form = document.getElementById("storyForm");
  if (!form) return;
  const success = document.getElementById("storySuccess");
  const error = document.getElementById("storyError");
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (error) {
      error.classList.remove("is-visible");
      error.textContent = "Gönderilemedi. Lütfen tekrar deneyin veya e-posta ile yazın.";
    }
    if (button) button.disabled = true;

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" }
    })
      .then(function (response) {
        return response.json().then(function (json) {
          if (!response.ok || !json.ok) {
            const err = new Error((json && json.message) || "form");
            throw err;
          }
        });
      })
      .then(function () {
        form.hidden = true;
        if (success) success.hidden = false;
      })
      .catch(function (err) {
        if (error) {
          if (err && err.message && err.message !== "form") error.textContent = err.message;
          error.classList.add("is-visible");
        }
        if (button) button.disabled = false;
      });
  });
})();

(function initConsentBanner() {
  if (window.location.pathname.indexOf("/admin/") !== -1) return;

  var STORAGE_KEY = "btp-consent-v1";
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
  } catch (err) {
    return;
  }

  var banner = document.createElement("aside");
  banner.className = "consent-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-modal", "false");
  banner.setAttribute("aria-labelledby", "consent-title");
  banner.setAttribute("aria-describedby", "consent-text");
  banner.innerHTML =
    '<div class="consent-banner-card">' +
    '<div class="consent-banner-main">' +
    '<p class="consent-banner-eyebrow">Çerezler ve KVKK</p>' +
    '<p id="consent-title" class="consent-banner-title">Kişisel verileriniz ve çerezler</p>' +
    '<p id="consent-text" class="consent-banner-text">Zorunlu çerezler site işlevleri için kullanılır. Form verileriniz KVKK kapsamında yalnızca başvuru ve iletişim için işlenir. <a href="kvkk.html">KVKK</a> · <a href="gizlilik.html">Gizlilik</a></p>' +
    "</div>" +
    '<button type="button" class="primary-btn consent-banner-accept" data-consent-accept>Kabul ediyorum</button>' +
    "</div>";

  function closeBanner() {
    banner.classList.add("is-closing");
    window.setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 220);
  }

  document.body.appendChild(banner);

  banner.querySelector("[data-consent-accept]").addEventListener("click", function () {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch (err) {
      /* ignore */
    }
    closeBanner();
  });
})();
