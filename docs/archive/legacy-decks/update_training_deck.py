"""
Build docs/user-training-v3.pptx by appending NEW slides to the v2 deck.

The v2 deck was authored on April 15, 2026 — before the Credentialing Gap
Analysis 2026 (commit c835aa2) shipped 24 prioritized features across NCQA
2026, Joint Commission NPG 12, CMS-0057-F, HITRUST/SOC 2, and behavioral
health. This script preserves every original slide and appends a "What's New"
section that trains existing users on those new modules.

Run: python docs/update_training_deck.py
Output: docs/user-training-v3.pptx
"""

from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from pptx import Presentation

from _deck_primitives import (
    AMBER, BLUE, GREEN, INK, INK_SOFT, LINE, NAVY_TRAIN, PALE, RED, TEAL, WHITE,
    TRAIN_THEME,
    add_blank_slide, add_rect, add_text,
    card, comparison_table, section_divider, slide_footer, slide_header,
    stat_card,
)

INPUT = os.path.join(HERE, "user-training-v2.pptx")
OUTPUT = os.path.join(HERE, "user-training-v3.pptx")

# Existing v2 deck has 24 slides; we start numbering new pages at 25.
START_PAGE = 25


def slide_section_divider_v3(pres, page):
    return section_divider(
        pres,
        kicker="Version 3.0 update",
        title="What's New Since v2",
        subtitle=(
            "24 new features shipped April 16 — NCQA 2026, Joint Commission "
            "NPG 12, FHIR R4, conversational AI, behavioral health, "
            "HITRUST/SOC 2 readiness."
        ),
        page_num=page,
        theme=TRAIN_THEME,
    )


def slide_overview_whats_new(pres, page):
    """Module map of the 24 new features grouped into themes."""
    s = add_blank_slide(pres)
    slide_header(s, "v3 module map",
                 "Where the New Features Live",
                 "Use the navigation below to find each new capability in the platform.",
                 theme=TRAIN_THEME)

    groups = [
        ("Verification (PSV) +",
         "Education bots (AMA, ECFMG, ACGME) • NPDB Continuous Query • "
         "Continuous license monitoring • Malpractice carrier verification",
         BLUE),
        ("Sanctions & Monitoring +",
         "30-day re-screen across every license state • SAM.gov webhook • "
         "FSMB PDC continuous monitoring • NY OMIG state Medicaid",
         AMBER),
        ("AI & Automation",
         "Document auto-classification • Conversational assistants "
         "(provider + staff) • Autonomous AI agent orchestrator • "
         "AI governance + model cards",
         TEAL),
        ("Quality & Compliance",
         "PSV SLA timers (NCQA 90/120 day) • Audit-ready packet ZIP • "
         "Auto-FPPE on privilege grant • Semi-annual OPPE • "
         "Peer-review minutes",
         GREEN),
        ("Standards & Interop",
         "FHIR R4 Provider Directory (CMS-0057-F) • CAQH ProView 2026 "
         "active-site • Real SFTP per-payer • Telehealth IMLC + platform certs",
         BLUE),
        ("Equity, Risk & Readiness",
         "Race / ethnicity / language fields • Non-discrimination disclosure • "
         "Behavioral-health supervision attestations • HITRUST CSF v11 r2 + "
         "SOC 2 Type II tracker",
         RED),
    ]
    # 3 cols x 2 rows
    cw, ch = 4.10, 2.40
    x0, y0 = 0.5, 1.95
    gx, gy = 0.10, 0.20
    for i, (title, body, accent) in enumerate(groups):
        col, row = i % 3, i // 3
        x = x0 + col * (cw + gx)
        y = y0 + row * (ch + gy)
        card(s, x, y, cw, ch, title, body, accent=accent,
             title_size=13, body_size=10)

    slide_footer(s, page, theme=TRAIN_THEME)


def slide_education_psv(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "PSV: education verification",
                 "New Bots — AMA Masterfile · ECFMG · ACGME",
                 "Essen now covers all 11 of the 11 NCQA CVO-certifiable products. "
                 "Education verification is no longer a manual outreach task.",
                 theme=TRAIN_THEME)

    rows = [
        ["AMA Physician Masterfile",
         "Med-school graduation, residency, board status",
         "All US-trained MDs",
         "Auto on first PSV run"],
        ["ECFMG Certificate Verification",
         "Medical school + foreign-grad status",
         "Any IMG (international medical graduate)",
         "Auto on first PSV run"],
        ["ACGME GME Track",
         "Residency / fellowship dates and program",
         "All physicians with residency",
         "Auto on first PSV run"],
        ["AMA → CME (passive)",
         "Pulled from AMA on each PSV refresh",
         "All physicians",
         "Recorded on profile"],
    ]
    comparison_table(
        s, x_in=0.5, y_in=2.0, w_in=12.3, h_in=4.0,
        headers=["Education bot", "What it returns", "When it runs", "Trigger"],
        rows=rows,
        col_widths=[3.2, 4.2, 2.8, 2.1],
        header_fill=NAVY_TRAIN, font_size=11, row_height_in=0.55,
    )

    add_text(s, 0.5, 5.95, 12.3, 0.45,
             "Where to see results: Provider → Verifications tab. "
             "Education bots run automatically when you click 'Run All PSV', "
             "or individually from the bot panel.",
             size=11, color=INK_SOFT)
    add_text(s, 0.5, 6.40, 12.3, 0.45,
             "Why it matters: NCQA 2026 requires primary-source verification "
             "of highest level of education / training — this used to require "
             "letters and 4–6 week response cycles.",
             size=11, color=INK_SOFT)
    slide_footer(s, page, theme=TRAIN_THEME)


def slide_sanctions_continuous(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Continuous monitoring",
                 "Sanctions, Licenses & FSMB — Now Continuous",
                 "Monthly OIG/SAM checks were the v2 standard. v3 adds true "
                 "continuous monitoring across every license state and federal source.",
                 theme=TRAIN_THEME)

    cards = [
        ("OIG LEIE",
         "Nightly delta of the LEIE file. Any new exclusion that matches a "
         "provider opens a HIGH-severity Monitoring Alert."),
        ("SAM.gov webhook",
         "SAM.gov pushes us new debarment events the same business day. "
         "Replaces the old monthly poll."),
        ("State Medicaid (NY OMIG)",
         "OMIG exclusion list ingested nightly. Plug-in framework lets us add "
         "additional state lists without code changes."),
        ("State License Boards",
         "License-status diff every night for each license on file. Status "
         "drops, new disciplinary actions, or expirations create alerts."),
        ("FSMB PDC",
         "Federation of State Medical Boards Practitioner Direct continuous "
         "monitoring webhook + nightly safety poll."),
        ("NPDB Continuous Query",
         "NPDB pushes adverse-action reports within 24 hours of filing. "
         "Restricted to Manager/Admin per 45 CFR Part 60."),
    ]
    cw, ch = 4.10, 2.05
    x0, y0 = 0.5, 2.0
    gx, gy = 0.10, 0.20
    for i, (title, body) in enumerate(cards):
        col, row = i % 3, i // 3
        x = x0 + col * (cw + gx)
        y = y0 + row * (ch + gy)
        card(s, x, y, cw, ch, title, body, accent=AMBER,
             title_size=13, body_size=10)

    add_text(s, 0.5, 6.55, 12.3, 0.45,
             "Where alerts appear: Dashboard → Urgent Attention "
             "(severity-coded), and the new Monitoring → Alerts page. "
             "Each alert must be acknowledged with disposition (true positive / "
             "false positive / cleared).",
             size=10, color=INK_SOFT)
    slide_footer(s, page, theme=TRAIN_THEME)


def slide_ai_doc_classify(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "AI: documents",
                 "Document Auto-Classification on Upload",
                 "When a provider drops a PDF into their portal, Azure Document "
                 "Intelligence + an LLM classifier route it to the correct checklist slot.",
                 theme=TRAIN_THEME)

    # Left: the steps
    add_rect(s, 0.5, 2.0, 6.10, 4.4, fill=PALE, line=LINE)
    add_rect(s, 0.5, 2.0, 6.10, 0.10, fill=TEAL, rounded=False)
    add_text(s, 0.75, 2.20, 5.60, 0.45,
             "How it works", size=14, bold=True, color=INK)
    steps = [
        ("1.", "Provider drags a file (or staff uploads on their behalf)."),
        ("2.", "Azure Document Intelligence extracts text, fields, and layout."),
        ("3.", "LLM classifier picks the document type from your checklist "
               "and pulls structured fields (license #, expiration, NPI…)."),
        ("4.", "Document is filed into the right slot. Checklist updates to "
               "✓ Received with a confidence badge."),
        ("5.", "If confidence is below threshold, the doc lands in a "
               "Needs Review queue for staff to confirm."),
    ]
    yy = 2.75
    for num, txt in steps:
        add_text(s, 0.75, yy, 0.40, 0.35, num,
                 size=12, bold=True, color=TEAL)
        add_text(s, 1.20, yy, 5.20, 0.65, txt,
                 size=11, color=INK_SOFT)
        yy += 0.70

    # Right: what changed for staff
    add_rect(s, 6.85, 2.0, 5.95, 4.4, fill=PALE, line=LINE)
    add_rect(s, 6.85, 2.0, 5.95, 0.10, fill=BLUE, rounded=False)
    add_text(s, 7.10, 2.20, 5.45, 0.45,
             "What changes for you", size=14, bold=True, color=INK)
    bullets = [
        "Most documents file themselves — no manual checklist clicks.",
        "OCR fields auto-populate Provider → Overview (NPI, license #, "
        "expirations) — review and confirm.",
        "Low-confidence docs appear under Documents → Needs Review with the "
        "AI's top 3 candidate types.",
        "Every classification decision is logged in the AI Decision Log "
        "(Admin → AI Governance) so you can audit any action.",
        "You can override any classification in one click — the override "
        "becomes training data for the model.",
    ]
    yy = 2.75
    for b in bullets:
        add_text(s, 7.05, yy, 0.30, 0.40, "•",
                 size=14, bold=True, color=BLUE)
        add_text(s, 7.35, yy, 5.20, 0.70, b,
                 size=11, color=INK_SOFT)
        yy += 0.70

    add_text(s, 0.5, 6.55, 12.3, 0.45,
             "Override + audit: every AI decision can be inspected in Admin → "
             "AI Governance → Decision Log. Model cards explain what each model "
             "was trained on and what its limits are.",
             size=10, color=INK_SOFT)
    slide_footer(s, page, theme=TRAIN_THEME)


def slide_conversational_ai(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "AI: conversational",
                 "Two New Assistants — Provider Copilot & Compliance Coach",
                 "Both assistants use retrieval-augmented generation (RAG) over the "
                 "provider's own record + Essen's policies — never trained on PHI.",
                 theme=TRAIN_THEME)

    # Card 1
    card(s, 0.5, 2.0, 6.15, 4.3,
         "Provider Self-Service Copilot",
         "Where: bottom-right chat icon on the provider portal.\n\n"
         "What it does:\n"
         "  • Answers 'where am I in the process?' and 'what do I still owe?'\n"
         "  • Explains rejected documents in plain language\n"
         "  • Walks providers through the attestation questions\n"
         "  • Hands off to a human staff member with one click\n\n"
         "Guardrails:\n"
         "  • Only sees the signed-in provider's own record\n"
         "  • Cannot trigger bots, change status, or edit data\n"
         "  • Every conversation logged for QA",
         accent=TEAL, title_size=14, body_size=11)

    # Card 2
    card(s, 6.70, 2.0, 6.10, 4.3,
         "Staff Compliance Coach",
         "Where: ⌘K command palette on every staff page.\n\n"
         "What it does:\n"
         "  • 'Is provider X NCQA-ready?' → checklist + missing items\n"
         "  • 'Which providers have an OPPE due in 30 days?'\n"
         "  • 'What documents do PAs need in NJ?'\n"
         "  • 'Summarize this provider's NPDB report' (Manager+)\n\n"
         "Guardrails:\n"
         "  • Answers grounded only in your data + Essen policy docs\n"
         "  • Always shows source records — click to navigate\n"
         "  • Refuses to invent data — prefers 'I don't know'",
         accent=BLUE, title_size=14, body_size=11)

    add_text(s, 0.5, 6.55, 12.3, 0.45,
             "Important: the assistants augment — they never decide. "
             "Approval, denial, override, and bot triggers still require an "
             "authorized human action with audit trail.",
             size=10, color=INK_SOFT)
    slide_footer(s, page, theme=TRAIN_THEME)


def slide_psv_sla_timers(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "NCQA timing",
                 "PSV SLA Timers — 90 / 120-Day Compliance",
                 "NCQA 2026 requires PSV elements to be no older than 90 days "
                 "(180 for some) at the time of committee approval. The platform now tracks "
                 "this for you with deadline-coded badges and breach metrics.",
                 theme=TRAIN_THEME)

    rows = [
        ["State License",       "120 days",  "90 days",   "60 days",  "Expired"],
        ["DEA",                 "120 days",  "90 days",   "60 days",  "Expired"],
        ["Board Certification", "180 days",  "150 days",  "120 days", "Expired"],
        ["NPDB",                "180 days",  "150 days",  "120 days", "Expired"],
        ["OIG Sanctions",       "60 days",   "45 days",   "30 days",  "Expired"],
        ["SAM.gov Sanctions",   "60 days",   "45 days",   "30 days",  "Expired"],
        ["Education (AMA / ECFMG)", "Lifetime once cleared", "—", "—", "—"],
    ]
    comparison_table(
        s, x_in=0.5, y_in=2.0, w_in=12.3, h_in=4.0,
        headers=["PSV element", "Fresh (green)", "Aging (amber)", "Stale (red)", "Breached"],
        rows=rows,
        col_widths=[3.2, 2.4, 2.3, 2.2, 2.2],
        header_fill=NAVY_TRAIN, font_size=11, row_height_in=0.50,
    )

    add_text(s, 0.5, 6.20, 12.3, 0.40,
             "Where: Provider → Verifications now shows a colored age badge on "
             "every PSV element. Committee Queue blocks providers with any "
             "RED element until re-verified.",
             size=11, color=INK_SOFT)
    add_text(s, 0.5, 6.65, 12.3, 0.40,
             "Metrics: Admin → Reports → SLA shows breach counts by element "
             "type, and breaches are exported to Prometheus (ecred_psv_sla_breaches).",
             size=11, color=INK_SOFT)
    slide_footer(s, page, theme=TRAIN_THEME)


def slide_audit_packet(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "One-click audit",
                 "Audit-Ready Credentialing Packet — One Click",
                 "Generate a single, complete ZIP per provider for NCQA, Joint "
                 "Commission, payer audits, and legal discovery requests.",
                 theme=TRAIN_THEME)

    # Left: what's in it
    add_rect(s, 0.5, 2.0, 6.10, 4.4, fill=PALE, line=LINE)
    add_rect(s, 0.5, 2.0, 6.10, 0.10, fill=GREEN, rounded=False)
    add_text(s, 0.75, 2.20, 5.60, 0.45,
             "Contents of the ZIP", size=14, bold=True, color=INK)
    items = [
        "Provider summary sheet (PDF) at packet generation time",
        "Every PSV result PDF, time-stamped at original capture",
        "Every uploaded credential document (originals)",
        "Application form + electronic attestation + e-signature",
        "Sanctions check history (OIG, SAM, OMIG, FSMB) with timestamps",
        "NPDB query results (Manager-only)",
        "Committee minutes excerpt for this provider's vote",
        "Audit trail CSV — every change with actor + timestamp",
        "Manifest.json — file list with SHA-256 hashes",
    ]
    yy = 2.75
    for it in items:
        add_text(s, 0.75, yy, 0.30, 0.35, "•",
                 size=14, bold=True, color=GREEN)
        add_text(s, 1.05, yy, 5.30, 0.40, it,
                 size=11, color=INK_SOFT)
        yy += 0.40

    # Right: how to generate
    add_rect(s, 6.85, 2.0, 5.95, 4.4, fill=PALE, line=LINE)
    add_rect(s, 6.85, 2.0, 5.95, 0.10, fill=BLUE, rounded=False)
    add_text(s, 7.10, 2.20, 5.45, 0.45,
             "How to generate", size=14, bold=True, color=INK)
    steps = [
        ("1.", "Open the provider's detail page."),
        ("2.", "Top-right menu → 'Generate Audit Packet'."),
        ("3.", "Choose timeframe (default: full lifecycle) and "
               "audience (NCQA / JC / Payer / Legal)."),
        ("4.", "Click Generate. Job runs in the background — typical "
               "size 20-80 MB depending on PDF count."),
        ("5.", "When ready, you get a link in the in-app notification "
               "bell. Link is valid for 7 days, single-use, audit-logged."),
        ("6.", "Re-generate at any time. Each packet is immutable and "
               "stored in Azure Blob with retention."),
    ]
    yy = 2.75
    for num, t in steps:
        add_text(s, 7.10, yy, 0.40, 0.40, num,
                 size=12, bold=True, color=BLUE)
        add_text(s, 7.55, yy, 5.20, 0.65, t,
                 size=11, color=INK_SOFT)
        yy += 0.55

    add_text(s, 0.5, 6.55, 12.3, 0.45,
             "Permissions: Specialists can generate packets for their assigned "
             "providers. Managers/Admins can generate any. NPDB pages are "
             "redacted unless the recipient role can see NPDB.",
             size=10, color=INK_SOFT)
    slide_footer(s, page, theme=TRAIN_THEME)


def slide_jc_npg12(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Joint Commission NPG 12",
                 "FPPE, OPPE & Peer-Review Workflow",
                 "New Quality module aligns with The Joint Commission's "
                 "Medical Staff Standards (NPG 12). Most of this is automated.",
                 theme=TRAIN_THEME)

    cards_data = [
        ("Auto-FPPE on privilege grant",
         "Whenever the committee approves a new privilege, the system "
         "automatically opens a Focused Professional Practice Evaluation "
         "(FPPE) record with the right metrics for that privilege.",
         GREEN),
        ("Semi-annual OPPE",
         "Ongoing Professional Practice Evaluation reports are auto-scheduled "
         "every 6 months, populated with quality data feeds, and routed to "
         "the section chief.",
         BLUE),
        ("Peer-review minutes",
         "Structured minutes capture for every peer-review meeting — outcomes, "
         "voting record, follow-up actions — with built-in confidentiality "
         "(Manager-only access).",
         AMBER),
        ("Practitioner Direct (FSMB)",
         "Continuous adverse-action monitoring via FSMB PDC. Webhook + nightly "
         "safety poll. New events open Monitoring Alerts.",
         RED),
    ]
    cw, ch = 6.10, 2.05
    x0, y0 = 0.5, 2.0
    gx, gy = 0.10, 0.20
    for i, (title, body, accent) in enumerate(cards_data):
        col, row = i % 2, i // 2
        x = x0 + col * (cw + gx)
        y = y0 + row * (ch + gy)
        card(s, x, y, cw, ch, title, body, accent=accent,
             title_size=13, body_size=11)

    add_text(s, 0.5, 6.55, 12.3, 0.45,
             "Where to find these: new Quality section in the sidebar — "
             "FPPE Queue, OPPE Schedule, Peer Review. Manager and Quality "
             "roles only.",
             size=10, color=INK_SOFT)
    slide_footer(s, page, theme=TRAIN_THEME)


def slide_behavioral_health(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Behavioral health specialty path",
                 "Tailored Workflow for LCSW, LMHC, LMFT, Psy.D and Psychiatry",
                 "Behavioral-health credentialing has its own taxonomy, supervision "
                 "rules, and payer fast-tracks. The platform now handles them natively.",
                 theme=TRAIN_THEME)

    cards_data = [
        ("NUCC taxonomy at intake",
         "Pick from the NUCC Health Care Provider Taxonomy on the application; "
         "downstream payer enrollments use the right codes automatically."),
        ("Supervision attestations",
         "Provisional licensees (e.g. LMSW, LCSW pre-R) link to a supervisor; "
         "the system tracks supervision hours and renews attestations on a "
         "configurable cadence."),
        ("BCBS fast-track",
         "Behavioral-health providers eligible for BCBS fast-track enrollment "
         "are flagged on the provider list and routed to the abbreviated "
         "submission flow."),
        ("Race / ethnicity / language",
         "REL (race / ethnicity / language) fields collected at intake (HHS-OMB "
         "categories), with non-discrimination disclosure shown to providers."),
    ]
    cw, ch = 6.10, 2.05
    x0, y0 = 0.5, 2.0
    gx, gy = 0.10, 0.20
    for i, (title, body) in enumerate(cards_data):
        col, row = i % 2, i // 2
        x = x0 + col * (cw + gx)
        y = y0 + row * (ch + gy)
        card(s, x, y, cw, ch, title, body, accent=TEAL,
             title_size=13, body_size=11)

    add_text(s, 0.5, 6.55, 12.3, 0.45,
             "Reporting: Admin → Reports → DEI shows REL distribution across "
             "the provider population and panel match against patient census.",
             size=10, color=INK_SOFT)
    slide_footer(s, page, theme=TRAIN_THEME)


def slide_telehealth(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Telehealth deepening",
                 "IMLC, Platform Certifications & Coverage Gap Alerts",
                 "Cross-state telehealth is now a first-class concept on each "
                 "provider record.",
                 theme=TRAIN_THEME)

    cards_data = [
        ("IMLC tracking",
         "Interstate Medical Licensure Compact registrations tracked alongside "
         "individual state licenses. Renewal cadence configured per state.",
         BLUE),
        ("Platform certifications",
         "Doxy.me, Teladoc, Amwell platform credentials and BAA dates tracked "
         "as expirables, with alerts on expiration."),
        ("Coverage-gap alerts",
         "If the patient's state isn't covered by any active license, IMLC, "
         "or compact registration on the assigned provider, the scheduler "
         "raises a coverage-gap alert.",
         AMBER),
        ("State-by-state policy library",
         "Per-state telehealth policy summary surfaces in the application "
         "and at scheduling time — kept current via a quarterly content job.",
         BLUE),
    ]
    cw, ch = 6.10, 2.05
    x0, y0 = 0.5, 2.0
    gx, gy = 0.10, 0.20
    for i, item in enumerate(cards_data):
        title, body, *rest = item + (BLUE,)
        accent = rest[0]
        col, row = i % 2, i // 2
        x = x0 + col * (cw + gx)
        y = y0 + row * (ch + gy)
        card(s, x, y, cw, ch, title, body, accent=accent,
             title_size=13, body_size=11)

    add_text(s, 0.5, 6.55, 12.3, 0.45,
             "Where: Provider → Telehealth tab. Coverage-gap alerts appear on "
             "the Dashboard's Urgent Attention panel.",
             size=10, color=INK_SOFT)
    slide_footer(s, page, theme=TRAIN_THEME)


def slide_fhir_api(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Standards & interop",
                 "FHIR R4 Provider Directory + Public REST API",
                 "Essen now publishes provider data the way payers and HIE "
                 "partners ask for it — without us building per-partner exports.",
                 theme=TRAIN_THEME)

    cards_data = [
        ("CMS-0057-F FHIR R4",
         "/api/fhir/R4 exposes Practitioner, PractitionerRole, Organization, "
         "Location, Endpoint, and a CapabilityStatement. Compliant with "
         "CMS Interoperability and Prior Authorization (0057-F) requirements "
         "for provider directories.",
         BLUE),
        ("Public REST API",
         "/api/v1 — token-authenticated REST for partners that don't speak "
         "FHIR. CRUD endpoints for providers, enrollments, expirables, "
         "and PSV results. Rate-limited and audited.",
         TEAL),
        ("API key management",
         "Admin → API Keys creates partner keys with a scope, an expiration, "
         "and an IP allow-list. Keys are shown once — store them safely.",
         AMBER),
        ("Webhook subscriptions",
         "Subscribe partners to events (provider.statusChanged, "
         "expirable.warning, sanction.alert) — delivered with HMAC signature "
         "and retry policy.",
         GREEN),
    ]
    cw, ch = 6.10, 2.05
    x0, y0 = 0.5, 2.0
    gx, gy = 0.10, 0.20
    for i, (title, body, accent) in enumerate(cards_data):
        col, row = i % 2, i // 2
        x = x0 + col * (cw + gx)
        y = y0 + row * (ch + gy)
        card(s, x, y, cw, ch, title, body, accent=accent,
             title_size=13, body_size=11)

    add_text(s, 0.5, 6.55, 12.3, 0.45,
             "Documentation: docs/api/README.md (REST) and "
             "docs/api/fhir-capability.md (FHIR). Admin/Dev role only.",
             size=10, color=INK_SOFT)
    slide_footer(s, page, theme=TRAIN_THEME)


def slide_admin_compliance(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Admin & ops: compliance",
                 "HITRUST / SOC 2 Tracker, AI Governance, Metrics",
                 "Three new admin surfaces. Required reading for System Admins "
                 "and Compliance Officers.",
                 theme=TRAIN_THEME)

    rows = [
        ["HITRUST CSF v11 r2 + SOC 2 Type II tracker",
         "Admin → Compliance",
         "Control catalog, evidence binders, gap log, audit-period management, "
         "weighted scoring."],
        ["AI Governance — model cards",
         "Admin → AI Governance → Models",
         "Description, training data, intended use, known limits, owner, "
         "review date for every AI model in use."],
        ["AI Governance — decision log",
         "Admin → AI Governance → Decisions",
         "Every AI suggestion recorded — input, output, human verdict, "
         "override reason. Filterable; exportable to CSV."],
        ["Tamper-evident audit log",
         "Admin → Audit",
         "Hash-chained audit log; verification utility detects any tampering "
         "and reports the broken row."],
        ["Prometheus metrics",
         "GET /api/metrics (bearer token)",
         "Scrape endpoint for ops dashboards: queue depth, open alerts, SLA "
         "breaches, bot runs, audit volume, AI decisions."],
        ["Structured JSON access logs",
         "stdout (Docker logs)",
         "Every HTTP request emits a pino-shaped JSON line — feed to "
         "Loki / Datadog / CloudWatch with no transformation."],
    ]
    comparison_table(
        s, x_in=0.5, y_in=2.0, w_in=12.3, h_in=4.5,
        headers=["Surface", "Where to find it", "What it gives you"],
        rows=rows,
        col_widths=[4.0, 3.5, 4.8],
        header_fill=NAVY_TRAIN, font_size=10, row_height_in=0.65,
    )

    add_text(s, 0.5, 6.65, 12.3, 0.40,
             "All five surfaces live behind the System Admin role. Compliance "
             "Officers can be granted read-only access via Admin → Users.",
             size=10, color=INK_SOFT)
    slide_footer(s, page, theme=TRAIN_THEME)


def slide_glossary_v3(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Glossary additions",
                 "New Terms in v3",
                 "These terms appear throughout the new modules. Skim before "
                 "your first live session.",
                 theme=TRAIN_THEME)

    rows = [
        ["NCQA CVO", "Credential Verification Organization — third-party PSV. "
                     "Essen now meets all 11 of the 11 NCQA CVO products."],
        ["FPPE",     "Focused Professional Practice Evaluation — short-term "
                     "review of a newly-privileged provider's actual performance."],
        ["OPPE",     "Ongoing Professional Practice Evaluation — semi-annual "
                     "performance review required by The Joint Commission NPG 12."],
        ["FHIR R4",  "HL7 Fast Healthcare Interoperability Resources, R4 — the "
                     "data format CMS-0057-F requires for provider directories."],
        ["CMS-0057-F","CMS Interoperability and Prior Authorization Final Rule. "
                     "Requires payers (and exposes precedent for providers) to "
                     "publish a FHIR R4 provider directory."],
        ["NUCC",     "National Uniform Claim Committee — publishes the Health "
                     "Care Provider Taxonomy used by behavioral-health enrollments."],
        ["IMLC",     "Interstate Medical Licensure Compact — expedited "
                     "multistate physician licensure."],
        ["FSMB PDC", "FSMB Practitioner Direct Continuous Monitoring — "
                     "real-time adverse-action notifications across state boards."],
        ["NPDB CQ",  "NPDB Continuous Query — NPDB pushes new adverse-action "
                     "reports within 24 hours of filing."],
        ["HITRUST CSF v11 r2",
                     "HITRUST Common Security Framework — healthcare-specific "
                     "security/privacy control catalog. v11 r2 is the 2026 release."],
        ["SOC 2 Type II",
                     "SSAE-18 attestation that operational controls are designed "
                     "AND operating effectively over a defined audit period."],
        ["RAG",      "Retrieval-Augmented Generation — what powers the "
                     "conversational assistants. The model retrieves your data, "
                     "then generates an answer grounded in it."],
        ["REL",      "Race / Ethnicity / Language — demographic fields collected "
                     "for equity and CMS reporting."],
        ["OMIG",     "NY Office of the Medicaid Inspector General — state-level "
                     "Medicaid exclusion list."],
    ]
    comparison_table(
        s, x_in=0.5, y_in=2.0, w_in=12.3, h_in=4.6,
        headers=["Term", "Definition"],
        rows=rows,
        col_widths=[2.6, 9.7],
        header_fill=NAVY_TRAIN, font_size=10, row_height_in=0.32,
    )
    slide_footer(s, page, theme=TRAIN_THEME)


def slide_recap_closing(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Recap",
                 "What Changed Since the v2 Training",
                 "If you took the v2 training, here is the short list of new "
                 "skills and surfaces you now own.",
                 theme=TRAIN_THEME)

    stats = [
        ("24",  "New features\nshipped in v3"),
        ("11/11", "NCQA CVO\nproducts covered"),
        ("0",   "Manual NPDB\noutreach (continuous query)"),
        ("3",   "New AI surfaces\n(classifier + 2 assistants)"),
    ]
    cw = 2.95
    for i, (big, lab) in enumerate(stats):
        x = 0.5 + i * (cw + 0.15)
        stat_card(s, x, 2.0, cw, 1.65, big, lab,
                  big_color=TRAIN_THEME.accent)

    # Action items list
    add_rect(s, 0.5, 3.85, 12.3, 2.65, fill=PALE, line=LINE)
    add_rect(s, 0.5, 3.85, 12.3, 0.10, fill=TRAIN_THEME.accent, rounded=False)
    add_text(s, 0.75, 4.05, 11.8, 0.45,
             "Your action items in the first week", size=14, bold=True, color=INK)
    items = [
        "Run a PSV on one provider end-to-end and confirm Education bots fire.",
        "Generate an Audit Packet for one approved provider; review the manifest.",
        "Try the Compliance Coach in the ⌘K palette: 'Which providers have OPPE due?'",
        "Visit Admin → AI Governance and look at the model card for the document classifier.",
        "Check the new colored age badges on every PSV element in your queue.",
    ]
    yy = 4.55
    for it in items:
        add_text(s, 0.75, yy, 0.30, 0.40, "□",
                 size=14, bold=True, color=TRAIN_THEME.accent)
        add_text(s, 1.05, yy, 11.5, 0.40, it,
                 size=11, color=INK_SOFT)
        yy += 0.40

    slide_footer(s, page, theme=TRAIN_THEME)


def main():
    pres = Presentation(INPUT)

    # Append new slides in order, numbering from page 25.
    page = START_PAGE
    builders = [
        slide_section_divider_v3,
        slide_overview_whats_new,
        slide_education_psv,
        slide_sanctions_continuous,
        slide_ai_doc_classify,
        slide_conversational_ai,
        slide_psv_sla_timers,
        slide_audit_packet,
        slide_jc_npg12,
        slide_behavioral_health,
        slide_telehealth,
        slide_fhir_api,
        slide_admin_compliance,
        slide_glossary_v3,
        slide_recap_closing,
    ]
    for fn in builders:
        fn(pres, page)
        page += 1

    pres.save(OUTPUT)
    new_count = len(pres.slides)
    print(f"OK: wrote {OUTPUT}")
    print(f"   slides: {new_count} (was 24 + {new_count - 24} new)")


if __name__ == "__main__":
    main()
