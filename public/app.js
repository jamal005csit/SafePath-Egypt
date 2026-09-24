// ============================================
// SafePath Egypt — Frontend logic
// ============================================

// ---- Incident taxonomy (source of truth, matches backend prompt) ----
const CATEGORIES = {
  harassment: {
    label: "مضايقة / تحرش رقمي",
    desc: "رسايل أو تعليقات متكررة بتضايقك أو بتهددك من حد.",
    danger: false,
  },
  threat: {
    label: "تهديد مباشر",
    desc: "تهديد صريح بإيذائك جسديًا أو نفسيًا.",
    danger: true,
  },
  cyberstalking: {
    label: "ملاحقة إلكترونية",
    desc: "حد بيراقب حركتك أونلاين أو بيتابعك بشكل مستمر ومقلق.",
    danger: false,
  },
  impersonation: {
    label: "انتحال شخصية",
    desc: "حد عمل حساب أو بيتصرف وكأنه إنتِ من غير إذنك.",
    danger: false,
  },
  doxxing: {
    label: "نشر بيانات شخصية (دوكسينج)",
    desc: "نشر بياناتك الشخصية زي العنوان أو رقم التليفون من غير موافقتك.",
    danger: false,
  },
  image_abuse: {
    label: "استغلال الصور / محتوى حساس",
    desc: "تهديد بنشر أو نشر فعلي لصور أو فيديوهات حساسة بتاعتك.",
    danger: true,
  },
  blackmail: {
    label: "ابتزاز",
    desc: "تهديد بفضح أو نشر حاجة عشان تجبروك تعملي حاجة معينة.",
    danger: true,
  },
  ai_manipulated: {
    label: "محتوى مزيف بالذكاء الاصطناعي",
    desc: "صور أو فيديوهات مزيفة اتعملت بيك أو بحد تعرفيه باستخدام AI.",
    danger: false,
  },
  unclear: {
    label: "محتاجين توضيح أكتر",
    desc: "مقدرناش نحدد نوع الموقف بدقة من الوصف ده. جربي تكتبي تفاصيل أكتر.",
    danger: false,
  },
};

// ---- Reporting pathways per category ----
const PATHWAYS = {
  default: [
    {
      name: "المجلس القومي للمرأة — خط نجدة المرأة",
      desc: "خط ساخن مجاني وسري لدعم النساء اللي بيتعرضوا لأي شكل من أشكال العنف.",
      phone: "15115",
    },
  ],
  threat: [
    {
      name: "الطوارئ",
      desc: "لو في خطر جسدي وشيك، اتصلي فورًا.",
      phone: "122",
    },
    {
      name: "المجلس القومي للمرأة — خط نجدة المرأة",
      desc: "خط ساخن مجاني وسري لدعم النساء.",
      phone: "15115",
    },
  ],
  image_abuse: [
    {
      name: "المجلس القومي للمرأة — خط نجدة المرأة",
      desc: "خط ساخن مجاني وسري، مؤهل للتعامل مع حالات الابتزاز والصور الحساسة.",
      phone: "15115",
    },
  ],
  blackmail: [
    {
      name: "المجلس القومي للمرأة — خط نجدة المرأة",
      desc: "خط ساخن مجاني وسري، مؤهل للتعامل مع حالات الابتزاز.",
      phone: "15115",
    },
  ],
};

const LEGAL_TEXT = {
  default: "قانون رقم ١٧٥ لسنة ٢٠١٨ (مكافحة جرائم تقنية المعلومات) بيجرّم أفعال زي الابتزاز الإلكتروني، انتحال الشخصية، ونشر البيانات الشخصية من غير إذن. قانون رقم ١٥١ لسنة ٢٠٢٠ بيحمي بياناتك الشخصية. تقدري تستخدمي البلاغ ده كأساس لبلاغ رسمي لو قررتِ كدة.",
};

const EVIDENCE_ITEMS = [
  "لقطة شاشة (screenshot) للمحادثة أو المنشور",
  "رابط الحساب أو المنشور (URL)",
  "اسم المستخدم أو اسم الحساب",
  "تاريخ ووقت حدوث الواقعة",
  "أي رسائل أو تعليقات ذات صلة",
];

// ---- PII redaction patterns (client-side, runs before anything leaves the browser) ----
const PII_PATTERNS = [
  { re: /(\+?\d{1,3}[\s-]?)?01[0125][\s-]?\d{4}[\s-]?\d{4}/g, label: "رقم هاتف" }, // EG mobile
  { re: /\b[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}\b/g, label: "بريد إلكتروني" },
  { re: /\b\d{14}\b/g, label: "رقم قومي" }, // EG national ID (14 digits)
  { re: /\b\d{9,13}\b/g, label: "رقم" }, // generic long number fallback
];

function redactPII(text) {
  let redacted = text;
  let count = 0;
  for (const { re, label } of PII_PATTERNS) {
    redacted = redacted.replace(re, () => {
      count++;
      return `[تم إخفاء ${label}]`;
    });
  }
  return { redacted, count };
}

// ---- Screen routing ----
const screens = document.querySelectorAll(".screen");
function goto(name) {
  screens.forEach((s) => {
    const active = s.dataset.screen === name;
    s.setAttribute("aria-hidden", active ? "false" : "true");
  });
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

document.querySelectorAll("[data-goto]").forEach((el) => {
  el.addEventListener("click", (e) => {
    const target = el.dataset.goto;
    // analyze button has its own async handler; don't double-navigate
    if (el.id === "analyzeBtn") return;
    goto(target);
  });
});

// ---- Quick Exit ----
document.getElementById("quickExit").addEventListener("click", () => {
  try {
    sessionStorage.clear();
    localStorage.removeItem("safepath_draft");
  } catch (e) {}
  window.location.replace("https://www.google.com");
});

// ---- State ----
let lastResult = { category: "unclear", redactedText: "", piiCount: 0, danger: false };

// ---- Analyze flow ----
const analyzeBtn = document.getElementById("analyzeBtn");
const incidentTextEl = document.getElementById("incidentText");

analyzeBtn.addEventListener("click", async () => {
  const raw = incidentTextEl.value.trim();
  if (raw.length < 4) {
    incidentTextEl.focus();
    return;
  }

  const { redacted, count } = redactPII(raw);

  setLoading(true);
  try {
    const category = await classifyIncident(redacted);
    lastResult = { category, redactedText: redacted, piiCount: count };
    renderAnalysis(lastResult);
    goto("analysis");
  } catch (err) {
    console.error(err);
    lastResult = { category: "unclear", redactedText: redacted, piiCount: count };
    renderAnalysis(lastResult);
    goto("analysis");
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  analyzeBtn.disabled = isLoading;
  analyzeBtn.querySelector(".btn__label").textContent = isLoading ? "بنحلل بأمان..." : "تحليل آمن";
  analyzeBtn.querySelector(".btn__spinner").hidden = !isLoading;
}

async function classifyIncident(text) {
  const res = await fetch("/api/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("classification failed");
  const data = await res.json();
  return CATEGORIES[data.category] ? data.category : "unclear";
}

// ---- Render analysis screen ----
function renderAnalysis({ category, redactedText, piiCount }) {
  const cat = CATEGORIES[category] || CATEGORIES.unclear;

  document.getElementById("categoryLabel").textContent = cat.label;
  document.getElementById("categoryDesc").textContent = cat.desc;

  const dangerBanner = document.getElementById("dangerAlert");
  dangerBanner.hidden = !cat.danger;

  // highlight redacted spans
  const escaped = redactedText.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const highlighted = escaped.replace(/\[تم إخفاء[^\]]+\]/g, (m) => `<mark>${m}</mark>`);
  document.getElementById("redactedText").innerHTML = highlighted || "—";

  const note = document.getElementById("redactionNote");
  if (piiCount > 0) {
    note.hidden = false;
    note.textContent = `تم إخفاء ${piiCount} من بياناتك الشخصية قبل أي تحليل.`;
  } else {
    note.hidden = true;
  }

  renderActionPlan(category, cat.danger);
}

// ---- Render action plan screen ----
function renderActionPlan(category, danger) {
  const checklistEl = document.getElementById("evidenceChecklist");
  checklistEl.innerHTML = "";
  EVIDENCE_ITEMS.forEach((item, i) => {
    const li = document.createElement("li");
    const id = `ev-${i}`;
    li.innerHTML = `<input type="checkbox" id="${id}"><label for="${id}">${item}</label>`;
    checklistEl.appendChild(li);
  });
  checklistEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      const label = cb.nextElementSibling;
      label.classList.toggle("checked", cb.checked);
    });
  });

  const pathways = PATHWAYS[category] || PATHWAYS.default;
  const pathwaysEl = document.getElementById("pathwaysList");
  pathwaysEl.innerHTML = pathways
    .map(
      (p) => `
    <div class="pathway">
      <div class="pathway__name">${p.name}</div>
      <div class="pathway__desc">${p.desc}</div>
      <a class="pathway__call" href="tel:${p.phone}">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        اتصلي: ${p.phone}
      </a>
    </div>`
    )
    .join("");

  document.getElementById("legalText").textContent = LEGAL_TEXT.default;

  // reset accordions: first open, rest closed
  document.querySelectorAll(".acc-card").forEach((card, i) => {
    card.dataset.open = i === 0 ? "true" : "false";
  });

  document.getElementById("reportConfirm").hidden = true;
  document.getElementById("submitReportBtn").disabled = false;
}

// ---- Accordion toggle ----
document.querySelectorAll(".acc-card__head").forEach((head) => {
  head.addEventListener("click", () => {
    const card = head.closest(".acc-card");
    const isOpen = card.dataset.open === "true";
    card.dataset.open = isOpen ? "false" : "true";
  });
});

// ---- Submit report (no PII, just category + timestamp, gets a reference code) ----
document.getElementById("submitReportBtn").addEventListener("click", async () => {
  const btn = document.getElementById("submitReportBtn");
  btn.disabled = true;
  try {
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: lastResult.category,
        redactedText: lastResult.redactedText,
      }),
    });
    const data = await res.json();
    const confirm = document.getElementById("reportConfirm");
    confirm.hidden = false;
    confirm.textContent = `تم التسجيل. الرقم المرجعي: ${data.referenceId}`;
  } catch (e) {
    const confirm = document.getElementById("reportConfirm");
    confirm.hidden = false;
    confirm.textContent = "حصل خطأ في التسجيل. جربي تاني.";
    btn.disabled = false;
  }
});

// init
goto("entry");
