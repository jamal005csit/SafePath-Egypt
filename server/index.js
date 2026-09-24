// ============================================
// SafePath Egypt — Backend
// Stateless classification proxy to Gemini + minimal report ref generator.
// No raw incident text is ever persisted to disk or a database.
// ============================================

require('dotenv').config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "PLACEHOLDER_ADD_YOUR_KEY";
const GEMINI_MODEL = "gemini-3.8-flash";

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

const CATEGORY_KEYS = [
  "harassment",
  "threat",
  "cyberstalking",
  "impersonation",
  "doxxing",
  "image_abuse",
  "blackmail",
  "ai_manipulated",
  "unclear",
];

const SYSTEM_PROMPT = `أنت مصنّف نصوص متخصص في تصنيف بلاغات العنف الرقمي المُوجَّه ضد النساء في مصر.

هتستقبل وصف قصير مكتوب بالعامية المصرية أو الفصحى لواقعة تعرضتلها مستخدمة. مهمتك الوحيدة إنك تصنفي الواقعة تحت فئة واحدة من الفئات دي بالظبط:

- harassment: مضايقة أو تحرش رقمي متكرر (رسايل أو تعليقات مزعجة)
- threat: تهديد مباشر بإيذاء جسدي أو نفسي
- cyberstalking: ملاحقة أو مراقبة مستمرة أونلاين
- impersonation: انتحال شخصية (عمل حساب مزيف باسمها)
- doxxing: نشر بيانات شخصية (عنوان، رقم تليفون) من غير إذن
- image_abuse: تهديد بنشر أو نشر فعلي لصور/فيديوهات حساسة
- blackmail: ابتزاز (تهديد بفضح حاجة عشان إجبارها تعمل حاجة)
- ai_manipulated: محتوى مزيف اتعمل بالذكاء الاصطناعي (deepfake)
- unclear: مقدرتش تحددي بدقة، أو النص مش كافي، أو مش متعلق بعنف رقمي أصلًا

قواعد صارمة:
1. رد بكلمة واحدة بس من القايمة اللي فوق (بالإنجليزي، حروف صغيرة، underscore زي ما هي مكتوبة). ماتضيفيش أي شرح أو علامات ترقيم.
2. لو الواقعة فيها أكتر من عنصر (زي تهديد + ابتزاز)، اختاري الأخطر (blackmail أو threat أو image_abuse بيسبقوا harassment).
3. لو مش متأكدة، اختاري unclear. ماتخمنيش.`;

// ---- Classification endpoint ----
app.post("/api/classify", async (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string" || text.trim().length < 2) {
    return res.status(400).json({ error: "invalid_text" });
  }
  // hard cap to keep payload small and prevent abuse
  const clipped = text.slice(0, 2000);

  try {
    const category = await callGemini(clipped);
    return res.json({ category });
  } catch (err) {
    console.error("Gemini classification error:", err.message);
    return res.status(200).json({ category: "unclear" }); // fail safe, never block the user
  }
});

async function callGemini(userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userText }],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 10,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || "";
  const cleaned = raw.replace(/[^a-z_]/g, "");

  return CATEGORY_KEYS.includes(cleaned) ? cleaned : "unclear";
}

// ---- Report endpoint (category + redacted text only, in-memory, no PII, no persistence to disk) ----
// For a hackathon demo: in-memory array, cleared on restart. Swap for a DB later if needed —
// but note the privacy design intentionally avoids storing anything identifying.
const reports = [];

app.post("/api/report", (req, res) => {
  const { category, redactedText } = req.body || {};
  const referenceId = "SP-" + crypto.randomBytes(3).toString("hex").toUpperCase();

  reports.push({
    referenceId,
    category: CATEGORY_KEYS.includes(category) ? category : "unclear",
    textLength: typeof redactedText === "string" ? redactedText.length : 0,
    createdAt: new Date().toISOString(),
  });

  res.json({ referenceId });
});

app.listen(PORT, () => {
  console.log(`SafePath Egypt server running on http://localhost:${PORT}`);
  if (GEMINI_API_KEY === "PLACEHOLDER_ADD_YOUR_KEY") {
    console.warn("⚠️  GEMINI_API_KEY not set — classification will fail until you set it as an env var.");
  }
});
