// Seed script: generates compact Excalidraw flowchart elements for each workflow
// Run inside the web container: node prisma/seed-workflow-diagrams.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

let _id = 0;
const uid = () => `wf_${++_id}_${Math.random().toString(36).slice(2, 8)}`;
const rng = () => Math.floor(Math.random() * 2e9);

const C = {
  start:  { bg: "#b2f2bb", s: "#2b8a3e" },
  step:   { bg: "#a5d8ff", s: "#1971c2" },
  decide: { bg: "#ffec99", s: "#e67700" },
  end:    { bg: "#ffc9c9", s: "#c92a2a" },
  sys:    { bg: "#d0bfff", s: "#6741d9" },
  bot:    { bg: "#ffd8a8", s: "#e8590c" },
};

function base(x, y, w, h) {
  return {
    x, y, width: w, height: h, angle: 0, strokeWidth: 1, strokeStyle: "solid",
    roughness: 0, opacity: 100, groupIds: [], frameId: null,
    seed: rng(), version: 2, versionNonce: rng(),
    isDeleted: false, updated: Date.now(), link: null, locked: false, fillStyle: "solid",
  };
}

function mkText(cid, x, y, w, h, txt) {
  const tid = uid();
  return { id: tid, obj: {
    id: tid, type: "text", ...base(x + 4, y + 2, w - 8, h - 4),
    strokeColor: "#1e1e1e", backgroundColor: "transparent",
    roundness: null, boundElements: null,
    text: txt, fontSize: 11, fontFamily: 3, textAlign: "center",
    verticalAlign: "middle", containerId: cid, originalText: txt,
    autoResize: true, lineHeight: 1.2,
  }};
}

function mkRect(cx, cy, w, h, txt, color) {
  const nid = uid();
  const x = cx - w/2, y = cy - h/2;
  const t = mkText(nid, x, y, w, h, txt);
  return { nid, els: [
    { id: nid, type: "rectangle", ...base(x, y, w, h),
      strokeColor: color.s, backgroundColor: color.bg,
      roundness: { type: 3 }, boundElements: [{ id: t.id, type: "text" }] },
    t.obj,
  ]};
}

function mkDiamond(cx, cy, w, h, txt, color) {
  const nid = uid();
  const x = cx - w/2, y = cy - h/2;
  const t = mkText(nid, x, y, w, h, txt);
  return { nid, els: [
    { id: nid, type: "diamond", ...base(x, y, w, h),
      strokeColor: color.s, backgroundColor: color.bg,
      roundness: { type: 2 }, boundElements: [{ id: t.id, type: "text" }] },
    t.obj,
  ]};
}

function mkEllipse(cx, cy, w, h, txt, color) {
  const nid = uid();
  const x = cx - w/2, y = cy - h/2;
  const t = mkText(nid, x, y, w, h, txt);
  return { nid, els: [
    { id: nid, type: "ellipse", ...base(x, y, w, h),
      strokeColor: color.s, backgroundColor: color.bg,
      roundness: { type: 2 }, boundElements: [{ id: t.id, type: "text" }] },
    t.obj,
  ]};
}

function mkArrow(fromId, toId) {
  const aid = uid();
  return { id: aid, type: "arrow", ...base(0, 0, 0, 0),
    strokeColor: "#495057", backgroundColor: "transparent",
    roundness: { type: 2 }, points: [[0,0],[0,50]],
    startBinding: { elementId: fromId, focus: 0, gap: 4 },
    endBinding: { elementId: toId, focus: 0, gap: 4 },
    startArrowhead: null, endArrowhead: "arrow",
    lastCommittedPoint: null, boundElements: null,
  };
}

// Node types: s=start, e=end, r=step, d=decision, y=system, b=bot
function buildScene(defs) {
  const elements = [];
  const ids = {};

  for (const n of defs) {
    const { k, cx, cy, label, t } = n;
    const w = n.w || (t === "d" ? 160 : 200);
    const h = n.h || (t === "d" ? 60 : (t === "s" || t === "e" ? 36 : 40));
    const color = t === "s" ? C.start : t === "e" ? C.end : t === "d" ? C.decide : t === "y" ? C.sys : t === "b" ? C.bot : C.step;
    const maker = t === "s" || t === "e" ? mkEllipse : t === "d" ? mkDiamond : mkRect;
    const { nid, els } = maker(cx, cy, w, h, label, color);
    ids[k] = nid;
    elements.push(...els);
  }

  for (const n of defs) {
    if (!n.to) continue;
    for (const tgt of n.to) {
      if (ids[n.k] && ids[tgt]) {
        const a = mkArrow(ids[n.k], ids[tgt]);
        // add arrow binding to source and target
        for (const el of elements) {
          if (el.id === ids[n.k] || el.id === ids[tgt]) {
            if (!el.boundElements) el.boundElements = [];
            el.boundElements.push({ id: a.id, type: "arrow" });
          }
        }
        elements.push(a);
      }
    }
  }

  return { elements, appState: { viewBackgroundColor: "#ffffff", gridSize: null }, files: {} };
}

// Layout helpers
const X = 300;       // center column
const L = 120;       // left offset
const R = 120;       // right offset
const G = 55;        // vertical gap between rows

const wfDefs = {

"Provider Onboarding (End-to-End)": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Provider Hired" , to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"d", label:"In iCIMS?", to:["c","d"] },
  { k:"c", cx:X-L, cy:G*2, t:"y", label:"Pull from iCIMS API", to:["e"] },
  { k:"d", cx:X+L, cy:G*2, t:"r", label:"Manually create record", to:["e"] },
  { k:"e", cx:X, cy:G*3, t:"y", label:"Create Provider record", to:["f"] },
  { k:"f", cx:X, cy:G*4, t:"r", label:"Send outreach email", to:["g"] },
  { k:"g", cx:X, cy:G*5, t:"d", label:"Clicks link?", to:["h"] },
  { k:"h", cx:X, cy:G*6, t:"d", label:"CAQH available?", to:["i","j"] },
  { k:"i", cx:X-L, cy:G*7, t:"y", label:"Ingest from CAQH", to:["k"] },
  { k:"j", cx:X+L, cy:G*7, t:"r", label:"Upload Photo ID + OCR", to:["k"] },
  { k:"k", cx:X, cy:G*8, t:"r", label:"Complete application", to:["l"] },
  { k:"l", cx:X, cy:G*9, t:"r", label:"Upload documents", to:["m"] },
  { k:"m", cx:X, cy:G*10, t:"y", label:"OCR + update checklist", to:["n"] },
  { k:"n", cx:X, cy:G*11, t:"r", label:"Attestation + e-sign", to:["o"] },
  { k:"o", cx:X, cy:G*12, t:"b", label:"Trigger PSV bot queue", to:["p"] },
  { k:"p", cx:X, cy:G*13, t:"d", label:"Bots clear?", to:["q"] },
  { k:"q", cx:X, cy:G*14, t:"y", label:"Move to Committee Queue", to:["r"] },
  { k:"r", cx:X, cy:G*15, t:"e", label:"Committee Ready" },
],

"PSV Bot Execution": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Bot triggered", to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"y", label:"Create BotRun (queued)", to:["c"] },
  { k:"c", cx:X, cy:G*2, t:"y", label:"Retrieve input data", to:["d"] },
  { k:"d", cx:X, cy:G*3, t:"d", label:"Data available?", to:["e","d1"] },
  { k:"d1", cx:X+L, cy:G*3, t:"e", label:"Failed: no data", w:140 },
  { k:"e", cx:X, cy:G*4, t:"y", label:"Get creds from Key Vault", to:["f"] },
  { k:"f", cx:X, cy:G*5, t:"b", label:"Execute Playwright", to:["g"] },
  { k:"g", cx:X, cy:G*6, t:"d", label:"Succeeds?", to:["h","g1"] },
  { k:"g1", cx:X+L, cy:G*6, t:"d", label:"Retries < 3?", to:["g1a","g1b"], w:130 },
  { k:"g1a", cx:X+L, cy:G*7, t:"y", label:"Backoff + retry", w:140 },
  { k:"g1b", cx:X+L*2, cy:G*6, t:"e", label:"Failed", w:100 },
  { k:"h", cx:X, cy:G*7, t:"b", label:"Screenshot / PDF", to:["i"] },
  { k:"i", cx:X, cy:G*8, t:"y", label:"Save to Azure Blob", to:["j"] },
  { k:"j", cx:X, cy:G*9, t:"y", label:"Create VerificationRecord", to:["k"] },
  { k:"k", cx:X, cy:G*10, t:"d", label:"Flagged?", to:["l","k1"] },
  { k:"k1", cx:X+L, cy:G*10, t:"r", label:"Alert Specialist", to:["l"], w:140 },
  { k:"l", cx:X, cy:G*11, t:"e", label:"BotRun completed" },
],

"Committee Review": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Provider in queue", to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"y", label:"Generate Summary Sheet", to:["c"] },
  { k:"c", cx:X, cy:G*2, t:"r", label:"Create session + agenda", to:["d"] },
  { k:"d", cx:X, cy:G*3, t:"y", label:"Email agenda to members", to:["e"] },
  { k:"e", cx:X, cy:G*4, t:"r", label:"Committee reviews", to:["f"] },
  { k:"f", cx:X, cy:G*5, t:"r", label:"Record decisions", to:["g"] },
  { k:"g", cx:X, cy:G*6, t:"d", label:"Decision?", to:["h","i","j"] },
  { k:"h", cx:X-L, cy:G*7, t:"y", label:"Approved", to:["h1"] },
  { k:"h1", cx:X-L, cy:G*8, t:"e", label:"Begin enrollments" },
  { k:"i", cx:X, cy:G*7, t:"e", label:"Denied" },
  { k:"j", cx:X+L, cy:G*7, t:"r", label:"Deferred", w:140 },
],

"Enrollment Submission": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Provider Approved", to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"r", label:"Create enrollment record", to:["c"] },
  { k:"c", cx:X, cy:G*2, t:"d", label:"Method?", to:["d","e","f"] },
  { k:"d", cx:X-L, cy:G*3, t:"b", label:"Portal bot submit", to:["g"] },
  { k:"e", cx:X, cy:G*3, t:"y", label:"SFTP roster upload", to:["g"] },
  { k:"f", cx:X+L, cy:G*3, t:"r", label:"Email to payer", to:["g"] },
  { k:"g", cx:X, cy:G*4, t:"y", label:"Set follow-up due date", to:["h"] },
  { k:"h", cx:X, cy:G*5, t:"d", label:"Follow-up due?", to:["i"] },
  { k:"i", cx:X, cy:G*6, t:"r", label:"Contact payer", to:["j"] },
  { k:"j", cx:X, cy:G*7, t:"d", label:"Enrolled?", to:["k","j1"] },
  { k:"j1", cx:X+L, cy:G*7, t:"r", label:"Set next follow-up", w:150 },
  { k:"k", cx:X, cy:G*8, t:"e", label:"Enrollment Complete" },
],

"Expirables Tracking and Renewal": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Nightly scan job", to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"y", label:"Scan Expirable records", to:["c"] },
  { k:"c", cx:X, cy:G*2, t:"d", label:"Days to expiry?", to:["c1","c2","c3"] },
  { k:"c1", cx:X-L, cy:G*3, t:"y", label:"90/60d: Notify", w:130, to:["d"] },
  { k:"c2", cx:X, cy:G*3, t:"y", label:"30/14d: Urgent", w:130, to:["d"] },
  { k:"c3", cx:X+L, cy:G*3, t:"y", label:"7d: Critical", w:130, to:["d"] },
  { k:"d", cx:X, cy:G*4, t:"d", label:"Bot can verify?", to:["e","f"] },
  { k:"e", cx:X-L, cy:G*5, t:"b", label:"Run renewal bot", to:["e1"] },
  { k:"e1", cx:X-L, cy:G*6, t:"d", label:"Confirmed?", to:["g"] },
  { k:"f", cx:X+L, cy:G*5, t:"r", label:"Outreach to provider", to:["f1"] },
  { k:"f1", cx:X+L, cy:G*6, t:"r", label:"Provider submits doc", to:["g"] },
  { k:"g", cx:X, cy:G*7, t:"y", label:"Update expiration date", to:["h"] },
  { k:"h", cx:X, cy:G*8, t:"d", label:"PSV re-verify?", to:["h1","i"] },
  { k:"h1", cx:X-L, cy:G*8, t:"b", label:"Queue PSV bot", to:["i"], w:140 },
  { k:"i", cx:X, cy:G*9, t:"e", label:"Resolved" },
],

"Sanctions Checking": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Provider enters pipeline", to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"b", label:"Query OIG + SAM.gov", to:["c"] },
  { k:"c", cx:X, cy:G*2, t:"d", label:"Exclusion found?", to:["d","e"] },
  { k:"d", cx:X-L, cy:G*3, t:"y", label:"Clear: save PDF", to:["d1"] },
  { k:"d1", cx:X-L, cy:G*4, t:"e", label:"Proceed" },
  { k:"e", cx:X+L, cy:G*3, t:"y", label:"HARD STOP + alert Mgr", to:["f"] },
  { k:"f", cx:X+L, cy:G*4, t:"r", label:"Manager reviews", to:["g"] },
  { k:"g", cx:X+L, cy:G*5, t:"d", label:"Confirmed?", to:["g1","g2"] },
  { k:"g1", cx:X, cy:G*6, t:"r", label:"False positive: clear", w:160 },
  { k:"g2", cx:X+L*2, cy:G*6, t:"e", label:"Deny provider", w:130 },
  { k:"h", cx:X-L, cy:G*5, t:"y", label:"Monthly rechecks", w:160 },
],

"NY Medicaid ETIN Enrollment": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Medicaid enrollment", to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"d", label:"In eMedNY?", to:["c","f"] },
  { k:"c", cx:X-L, cy:G*2, t:"d", label:"In Maint File?", to:["d","f"] },
  { k:"d", cx:X-L, cy:G*3, t:"b", label:"Update ETIN affiliation", to:["e"] },
  { k:"e", cx:X-L, cy:G*4, t:"e", label:"ETIN Updated" },
  { k:"f", cx:X+L, cy:G*2, t:"y", label:"New ETIN process", to:["g"] },
  { k:"g", cx:X, cy:G*3.5, t:"y", label:"Populate application", to:["h"] },
  { k:"h", cx:X, cy:G*4.5, t:"d", label:"Signature needed?", to:["i","k"] },
  { k:"i", cx:X-L, cy:G*5.5, t:"r", label:"Mail for signature", to:["j"] },
  { k:"j", cx:X-L, cy:G*6.5, t:"r", label:"Upload signed doc", to:["k"] },
  { k:"k", cx:X, cy:G*7, t:"b", label:"Submit to eMedNY", to:["l"] },
  { k:"l", cx:X, cy:G*8, t:"d", label:"Successful?", to:["m"] },
  { k:"m", cx:X, cy:G*9, t:"y", label:"ETIN assigned, enrolled", to:["n"] },
  { k:"n", cx:X, cy:G*10, t:"y", label:"Add to Expirables tracking", to:["o"] },
  { k:"o", cx:X, cy:G*11, t:"e", label:"Complete" },
],

"NPDB Query": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Provider enters PSV", to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"b", label:"Submit query to NPDB", to:["c"] },
  { k:"c", cx:X, cy:G*2, t:"d", label:"Reports found?", to:["d","e"] },
  { k:"d", cx:X-L, cy:G*3, t:"y", label:"No reports: save PDF", to:["d1"] },
  { k:"d1", cx:X-L, cy:G*4, t:"y", label:"Enroll Continuous Query", to:["d2"] },
  { k:"d2", cx:X-L, cy:G*5, t:"e", label:"NPDB Clear" },
  { k:"e", cx:X+L, cy:G*3, t:"y", label:"Reports: save + flag", to:["f"] },
  { k:"f", cx:X+L, cy:G*4, t:"y", label:"Alert Mgr, block committee", to:["g"] },
  { k:"g", cx:X+L, cy:G*5, t:"r", label:"Manager reviews", to:["h"] },
  { k:"h", cx:X+L, cy:G*6, t:"d", label:"Material?", to:["h1","h2"] },
  { k:"h1", cx:X, cy:G*7, t:"r", label:"Acknowledge + proceed", w:170 },
  { k:"h2", cx:X+L*2, cy:G*7, t:"e", label:"Deny/defer", w:120 },
],

"Provider Status Lifecycle": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"New Provider", to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"r", label:"INVITED", to:["c"] },
  { k:"c", cx:X, cy:G*2, t:"r", label:"ONBOARDING", to:["d","e"] },
  { k:"d", cx:X-L, cy:G*3, t:"r", label:"DOCS PENDING", w:150, to:["e"] },
  { k:"e", cx:X, cy:G*4, t:"y", label:"VERIFICATION", to:["f"] },
  { k:"f", cx:X, cy:G*5, t:"r", label:"COMMITTEE READY", to:["g"] },
  { k:"g", cx:X, cy:G*6, t:"r", label:"IN REVIEW", to:["h","i","j"] },
  { k:"h", cx:X-L, cy:G*7, t:"e", label:"APPROVED", w:130 },
  { k:"i", cx:X, cy:G*7, t:"e", label:"DENIED", w:130 },
  { k:"j", cx:X+L, cy:G*7, t:"r", label:"DEFERRED", w:130 },
],

"Staff Notification and Escalation": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Alert event occurs", to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"y", label:"Notify Specialist (app+email)", to:["c"] },
  { k:"c", cx:X, cy:G*2, t:"d", label:"Action in SLA?", to:["d","e"] },
  { k:"d", cx:X-L, cy:G*3, t:"e", label:"Resolved" },
  { k:"e", cx:X+L, cy:G*3, t:"y", label:"Escalate to Manager", to:["f"] },
  { k:"f", cx:X+L, cy:G*4, t:"d", label:"Mgr acts?", to:["f1","f2"] },
  { k:"f1", cx:X, cy:G*5, t:"e", label:"Resolved" },
  { k:"f2", cx:X+L*2, cy:G*5, t:"y", label:"Log + daily report", w:150 },
  { k:"s1", cx:X-L*1.2, cy:G*7, t:"r", label:"Bot fail: 4h", w:120 },
  { k:"s2", cx:X-L*0.3, cy:G*7, t:"r", label:"Expirable: 48h", w:120 },
  { k:"s3", cx:X+L*0.6, cy:G*7, t:"r", label:"Enrollment: 24h", w:120 },
  { k:"s4", cx:X+L*1.5, cy:G*7, t:"r", label:"Sanctions: 2h", w:120 },
],

"Recredentialing Cycle": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Daily scan: 33 months elapsed", w:220, to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"y", label:"Create RecredentialingCycle (PENDING)", w:240, to:["c"] },
  { k:"c", cx:X, cy:G*2, t:"r", label:"Send application to provider", to:["d"] },
  { k:"d", cx:X, cy:G*3, t:"y", label:"cycle = APPLICATION_SENT", to:["e"] },
  { k:"e", cx:X, cy:G*4, t:"d", label:"Returned + attested?", to:["f","e1"] },
  { k:"e1", cx:X+L, cy:G*4, t:"r", label:"14d: reminder + follow-up", w:170, to:["e"] },
  { k:"f", cx:X, cy:G*5, t:"y", label:"cycle = IN_PROGRESS", to:["g"] },
  { k:"g", cx:X, cy:G*6, t:"b", label:"Queue full PSV bot set", to:["h"] },
  { k:"h", cx:X, cy:G*7, t:"d", label:"PSV clean?", to:["i","h1"] },
  { k:"h1", cx:X+L, cy:G*7, t:"r", label:"Specialist reviews flags", w:160, to:["h"] },
  { k:"i", cx:X, cy:G*8, t:"y", label:"cycle = COMMITTEE_READY", to:["j"] },
  { k:"j", cx:X, cy:G*9, t:"r", label:"Committee review", to:["k"] },
  { k:"k", cx:X, cy:G*10, t:"d", label:"Decision?", to:["l","m","n"] },
  { k:"l", cx:X-L, cy:G*11, t:"y", label:"COMPLETED, next cycle +36m", w:200 },
  { k:"m", cx:X, cy:G*11, t:"e", label:"DENIED: end enrollments" },
  { k:"n", cx:X+L, cy:G*11, t:"r", label:"Deferred: stays open", w:150 },
  { k:"o", cx:X+L*2, cy:G*5, t:"y", label:"dueDate passed → OVERDUE", w:200 },
],

"Reference & Work-History Verification": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Specialist creates request", w:200, to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"y", label:"Generate responseToken (PENDING)", w:220, to:["c"] },
  { k:"c", cx:X, cy:G*2, t:"r", label:"Send email with magic link", to:["d"] },
  { k:"d", cx:X, cy:G*3, t:"y", label:"status = SENT", to:["e"] },
  { k:"e", cx:X, cy:G*4, t:"d", label:"Clicked within 7d?", to:["f","e1"] },
  { k:"e1", cx:X+L, cy:G*4, t:"y", label:"Reminder at 7d, 14d", w:150, to:["e"] },
  { k:"f", cx:X, cy:G*5, t:"d", label:"Token valid?", to:["g","f1"] },
  { k:"f1", cx:X+L, cy:G*5, t:"e", label:"EXPIRED / DECLINED", w:160 },
  { k:"g", cx:X, cy:G*6, t:"r", label:"External fills public form", w:200, to:["h"] },
  { k:"h", cx:X, cy:G*7, t:"y", label:"Save response, status=RECEIVED", w:220, to:["i"] },
  { k:"i", cx:X, cy:G*8, t:"y", label:"Notify Specialist + update checklist", w:230, to:["j"] },
  { k:"j", cx:X, cy:G*9, t:"d", label:"All required received?", to:["k","j1"] },
  { k:"j1", cx:X+L, cy:G*9, t:"r", label:"Continue outreach", w:150 },
  { k:"k", cx:X, cy:G*10, t:"e", label:"Verifications complete" },
],

"Roster Generation & Submission": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Specialist selects payer", to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"d", label:"Template configured?", to:["c","b1"] },
  { k:"b1", cx:X+L, cy:G*1, t:"r", label:"Manager creates template", w:180, to:["b"] },
  { k:"c", cx:X, cy:G*2, t:"r", label:"Click Generate", to:["d"] },
  { k:"d", cx:X, cy:G*3, t:"y", label:"Render CSV, status=DRAFT", w:200, to:["e"] },
  { k:"e", cx:X, cy:G*4, t:"y", label:"Auto-validate rows", to:["f"] },
  { k:"f", cx:X, cy:G*5, t:"d", label:"Validation OK?", to:["g","f1"] },
  { k:"f1", cx:X+L, cy:G*5, t:"e", label:"status=ERROR (fix upstream)", w:200 },
  { k:"g", cx:X, cy:G*6, t:"y", label:"status = VALIDATED", to:["h"] },
  { k:"h", cx:X, cy:G*7, t:"d", label:"Submission method?", to:["i","j","k"] },
  { k:"i", cx:X-L, cy:G*8, t:"r", label:"Portal upload (manual)", w:170, to:["l"] },
  { k:"j", cx:X, cy:G*8, t:"b", label:"SFTP to payer", to:["l"] },
  { k:"k", cx:X+L, cy:G*8, t:"r", label:"Email CSV to payer", w:170, to:["l"] },
  { k:"l", cx:X, cy:G*9, t:"y", label:"status = SUBMITTED", to:["m"] },
  { k:"m", cx:X, cy:G*10, t:"d", label:"Ack in 7d?", to:["n","m1"] },
  { k:"m1", cx:X+L, cy:G*10, t:"r", label:"Follow up with payer", w:170, to:["m"] },
  { k:"n", cx:X, cy:G*11, t:"e", label:"ACKNOWLEDGED" },
],

"OPPE / FPPE Evaluation Lifecycle": [
  { k:"a", cx:X-L, cy:G*0, t:"s", label:"OPPE: 6-month trigger", w:180, to:["c"] },
  { k:"b", cx:X+L, cy:G*0, t:"s", label:"FPPE: privilege/event trigger", w:220, to:["c"] },
  { k:"c", cx:X, cy:G*1, t:"y", label:"Create PracticeEvaluation (SCHEDULED)", w:260, to:["d"] },
  { k:"d", cx:X, cy:G*2, t:"y", label:"Assign evaluator + notify", w:200, to:["e"] },
  { k:"e", cx:X, cy:G*3, t:"d", label:"Started by dueDate?", to:["f","e1"] },
  { k:"e1", cx:X+L, cy:G*3, t:"y", label:"OVERDUE → alert Manager", w:190, to:["e"] },
  { k:"f", cx:X, cy:G*4, t:"r", label:"IN_PROGRESS: review charts", w:200, to:["g"] },
  { k:"g", cx:X, cy:G*5, t:"r", label:"Record indicators + findings", w:210, to:["h"] },
  { k:"h", cx:X, cy:G*6, t:"d", label:"Recommendation?", to:["i","j","k"] },
  { k:"i", cx:X-L, cy:G*7, t:"y", label:"Satisfactory: COMPLETED", w:190 },
  { k:"j", cx:X, cy:G*7, t:"r", label:"Concerns: follow-up FPPE", w:200 },
  { k:"k", cx:X+L, cy:G*7, t:"e", label:"Fail: suspend privilege", w:190 },
  { k:"l", cx:X-L, cy:G*8, t:"y", label:"Clear requires_fppe flag", w:200 },
],

"CME Tracking & Attestation": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Provider logs CME activity", w:200, to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"d", label:"Upload certificate?", to:["c","d"] },
  { k:"c", cx:X-L, cy:G*2, t:"y", label:"OCR cert, save with doc", w:190, to:["e"] },
  { k:"d", cx:X+L, cy:G*2, t:"y", label:"Self-report (audit flag)", w:190, to:["e"] },
  { k:"e", cx:X, cy:G*3, t:"y", label:"Recalc cycle totals", w:190, to:["f"] },
  { k:"f", cx:X, cy:G*4, t:"d", label:"Credits ≥ required?", to:["g","h"] },
  { k:"g", cx:X-L, cy:G*5, t:"y", label:"requirementMet=true, rebuild CV", w:230 },
  { k:"h", cx:X+L, cy:G*5, t:"d", label:"Days to cycle end?", to:["i","j"] },
  { k:"i", cx:X, cy:G*6, t:"r", label:">60d: keep tracking", w:180 },
  { k:"j", cx:X+L, cy:G*6, t:"y", label:"≤60d: shortfall alert + outreach", w:240, to:["k"] },
  { k:"k", cx:X+L, cy:G*7, t:"d", label:"Logged more by cycle end?", w:220, to:["e","l"] },
  { k:"l", cx:X+L*2, cy:G*7, t:"e", label:"INCOMPLETE → Manager", w:200 },
  { k:"m", cx:X, cy:G*8, t:"y", label:"Cycle end: archive + reset", w:220 },
],

"Public REST API & FHIR Access": [
  { k:"a", cx:X, cy:G*0, t:"s", label:"Partner requests API access", w:220, to:["b"] },
  { k:"b", cx:X, cy:G*1, t:"r", label:"Manager creates ApiKey", w:200, to:["c"] },
  { k:"c", cx:X, cy:G*2, t:"y", label:"Generate + SHA-256 hash key", w:220, to:["d"] },
  { k:"d", cx:X, cy:G*3, t:"r", label:"Deliver plaintext (shown once)", w:230, to:["e"] },
  { k:"e", cx:X, cy:G*4, t:"s", label:"Partner sends API request", w:220, to:["f"] },
  { k:"f", cx:X, cy:G*5, t:"d", label:"Key valid + active?", to:["g","f1"] },
  { k:"f1", cx:X+L, cy:G*5, t:"e", label:"401 Unauthorized", w:160 },
  { k:"g", cx:X, cy:G*6, t:"d", label:"Permission covers route?", w:200, to:["h","g1"] },
  { k:"g1", cx:X+L, cy:G*6, t:"e", label:"403 Forbidden", w:160 },
  { k:"h", cx:X, cy:G*7, t:"d", label:"Rate limit OK?", to:["i","h1"] },
  { k:"h1", cx:X+L, cy:G*7, t:"e", label:"429 Too Many Requests", w:200 },
  { k:"i", cx:X, cy:G*8, t:"d", label:"Endpoint?", to:["j","k"] },
  { k:"j", cx:X-L, cy:G*9, t:"y", label:"/v1 REST: JSON + PHI redact", w:230 },
  { k:"k", cx:X+L, cy:G*9, t:"y", label:"/fhir Practitioner (R4)", w:210 },
  { k:"l", cx:X, cy:G*10, t:"y", label:"Write audit log (HMAC-chained)", w:240 },
  { k:"m", cx:X, cy:G*11, t:"e", label:"Response sent" },
],

};

async function main() {
  const all = await prisma.workflow.findMany();
  console.log(`Found ${all.length} workflows`);

  for (const wf of all) {
    const defs = wfDefs[wf.name];
    if (!defs) { console.log(`  SKIP: "${wf.name}"`); continue; }
    _id = 0;
    const scene = buildScene(defs);
    await prisma.workflow.update({ where: { id: wf.id }, data: { sceneData: scene } });
    console.log(`  OK: "${wf.name}" (${scene.elements.length} els)`);
  }
  console.log("Done.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
