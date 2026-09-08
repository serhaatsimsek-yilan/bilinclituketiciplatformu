(function () {
  const loginCard = document.getElementById("adminLoginCard");
  const loginForm = document.getElementById("adminLoginForm");
  const loginError = document.getElementById("adminLoginError");
  const panel = document.getElementById("adminPanel");
  const pendingList = document.getElementById("pendingList");
  const publishedList = document.getElementById("publishedList");
  const pendingEmpty = document.getElementById("pendingEmpty");
  const publishedEmpty = document.getElementById("publishedEmpty");
  const logoutBtn = document.getElementById("adminLogout");
  if (!loginForm || !panel) return;

  function api(action, payload) {
    const options = {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    };
    if (payload) {
      options.method = "POST";
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(Object.assign({ action: action }, payload));
    } else {
      options.method = "GET";
    }
    const url = payload
      ? "../api/stories-admin.php"
      : "../api/stories-admin.php?action=" + encodeURIComponent(action);
    return fetch(url, options).then(function (response) {
      return response.json().then(function (json) {
        json._http = response.status;
        return json;
      });
    });
  }

  function showError(node, message) {
    if (!node) return;
    node.textContent = message || "İşlem yapılamadı.";
    node.classList.add("is-visible");
  }

  function card(item, mode) {
    const el = document.createElement("article");
    el.className = "story-card";
    const meta = document.createElement("div");
    meta.className = "story-meta";
    const badge = document.createElement("span");
    badge.className = "story-badge";
    badge.textContent = item.topic || "";
    const name = document.createElement("strong");
    name.textContent = item.name || "Anonim";
    meta.appendChild(badge);
    meta.appendChild(name);
    if (item.city || item.created_label || item.meta) {
      const extra = document.createElement("span");
      extra.textContent = item.meta || [item.city, item.created_label].filter(Boolean).join(" · ");
      meta.appendChild(extra);
    }
    el.appendChild(meta);
    if (item.email) {
      const mail = document.createElement("p");
      mail.className = "admin-email";
      mail.textContent = item.email;
      el.appendChild(mail);
    }
    const text = document.createElement("p");
    text.className = "story-text";
    text.textContent = item.text || "";
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
    const actions = document.createElement("div");
    actions.className = "admin-actions";
    if (mode === "pending") {
      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "primary-btn";
      ok.textContent = "Onayla ve yayınla";
      ok.addEventListener("click", function () {
        api("approve", { id: item.id }).then(function (json) {
          if (!json.ok) throw new Error();
          return loadList();
        }).catch(function () {
          window.alert("Onaylanamadı.");
        });
      });
      const no = document.createElement("button");
      no.type = "button";
      no.className = "ghost-btn";
      no.textContent = "Reddet";
      no.addEventListener("click", function () {
        api("reject", { id: item.id }).then(function (json) {
          if (!json.ok) throw new Error();
          return loadList();
        }).catch(function () {
          window.alert("Silinemedi.");
        });
      });
      actions.appendChild(ok);
      actions.appendChild(no);
    } else {
      const replyWrap = document.createElement("div");
      replyWrap.className = "admin-reply-form";
      const replyLabel = document.createElement("label");
      replyLabel.textContent = "Platform yanıtı";
      replyLabel.setAttribute("for", "reply-" + item.id);
      const replyArea = document.createElement("textarea");
      replyArea.id = "reply-" + item.id;
      replyArea.rows = 4;
      replyArea.maxLength = 2000;
      replyArea.placeholder = "Yayındaki yoruma kısa bilgilendirme veya yönlendirme yazın.";
      replyArea.value = item.reply || "";
      const replyActions = document.createElement("div");
      replyActions.className = "admin-actions";
      const saveReply = document.createElement("button");
      saveReply.type = "button";
      saveReply.className = "primary-btn";
      saveReply.textContent = "Yanıtı kaydet";
      saveReply.addEventListener("click", function () {
        api("reply", { id: item.id, reply: replyArea.value.trim() }).then(function (json) {
          if (!json.ok) throw new Error();
          return loadList();
        }).catch(function () {
          window.alert("Yanıt kaydedilemedi.");
        });
      });
      const clearReply = document.createElement("button");
      clearReply.type = "button";
      clearReply.className = "ghost-btn";
      clearReply.textContent = "Yanıtı sil";
      clearReply.addEventListener("click", function () {
        if (!item.reply && !replyArea.value.trim()) return;
        if (!window.confirm("Platform yanıtı silinsin mi?")) return;
        api("reply", { id: item.id, reply: "" }).then(function (json) {
          if (!json.ok) throw new Error();
          return loadList();
        }).catch(function () {
          window.alert("Yanıt silinemedi.");
        });
      });
      replyActions.appendChild(saveReply);
      replyActions.appendChild(clearReply);
      replyWrap.appendChild(replyLabel);
      replyWrap.appendChild(replyArea);
      replyWrap.appendChild(replyActions);
      el.appendChild(replyWrap);

      const pull = document.createElement("button");
      pull.type = "button";
      pull.className = "ghost-btn";
      pull.textContent = "Yayından kaldır";
      pull.addEventListener("click", function () {
        api("unpublish", { id: item.id }).then(function (json) {
          if (!json.ok) throw new Error();
          return loadList();
        }).catch(function () {
          window.alert("Yayından alınamadı.");
        });
      });
      actions.appendChild(pull);
    }
    el.appendChild(actions);
    return el;
  }

  function render(list, target, emptyNode, mode) {
    target.innerHTML = "";
    if (!list || !list.length) {
      emptyNode.hidden = false;
      return;
    }
    emptyNode.hidden = true;
    list.forEach(function (item) {
      target.appendChild(card(item, mode));
    });
  }

  function showPanel() {
    loginCard.hidden = true;
    panel.hidden = false;
    return loadList();
  }

  function loadList() {
    return api("list", { action: "list" }).then(function (json) {
      if (json._http === 401) {
        loginCard.hidden = false;
        panel.hidden = true;
        return;
      }
      if (!json.ok) throw new Error(json.message || "");
      render(json.pending, pendingList, pendingEmpty, "pending");
      render(json.published, publishedList, publishedEmpty, "published");
    });
  }

  api("status").then(function (json) {
    if (!json.configured) {
      showError(loginError, "Önce api/lib/local-config.php içine STORIES_ADMIN_PASSWORD yazın.");
      return;
    }
    if (json.authed) showPanel();
  }).catch(function () {
    showError(loginError, "Onay paneli PHP ile çalışır. Yerelde php -S localhost:8080 kullanın.");
  });

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    loginError.classList.remove("is-visible");
    const password = document.getElementById("adminPassword").value;
    api("login", { password: password }).then(function (json) {
      if (!json.ok) {
        showError(loginError, json.message || "Şifre yanlış.");
        return;
      }
      loginForm.reset();
      showPanel();
    }).catch(function () {
      showError(loginError, "Giriş yapılamadı.");
    });
  });

  logoutBtn.addEventListener("click", function () {
    api("logout", { action: "logout" }).then(function () {
      panel.hidden = true;
      loginCard.hidden = false;
    });
  });
})();
