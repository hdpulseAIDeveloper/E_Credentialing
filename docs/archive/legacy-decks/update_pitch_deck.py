"""
Build docs/pitch-deck-v2.pptx by appending NEW slides to the v1 pitch deck.

The v1 pitch deck (April 15) presented the platform as the PARCS replacement.
Since then we shipped 24 P0–P3 features that move the platform from "internal
PARCS replacement" to "competitive credentialing platform" — meeting NCQA 2026,
Joint Commission NPG 12, and CMS-0057-F. This update appends:

  - "What we shipped since v1" capabilities recap
  - Market landscape (vendors Essen leadership might consider)
  - Detailed feature comparison grid against 6 marketplace alternatives
  - Updated transformation / ROI numbers
  - Refreshed call-to-action

Run: python docs/update_pitch_deck.py
Output: docs/pitch-deck-v2.pptx
"""

from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from pptx import Presentation

from _deck_primitives import (
    AMBER, BLUE, GREEN, INK, INK_SOFT, LINE, NAVY, PALE, RED, TEAL, WHITE,
    PITCH_THEME,
    add_blank_slide, add_rect, add_text,
    card, comparison_table, section_divider, slide_footer, slide_header,
    stat_card,
)

INPUT = os.path.join(HERE, "pitch-deck.pptx")
OUTPUT = os.path.join(HERE, "pitch-deck-v2.pptx")

START_PAGE = 14  # original deck has 13 slides


# ── Slide builders ────────────────────────────────────────────────────────


def slide_v2_intro(pres, page):
    return section_divider(
        pres,
        kicker="Update — April 17, 2026",
        title="What's Changed Since v1",
        subtitle=(
            "From PARCS-replacement to competitive credentialing platform. "
            "24 features shipped • NCQA CVO-ready (11/11) • NPG 12 • "
            "CMS-0057-F • HITRUST/SOC 2 readiness."
        ),
        page_num=page,
        theme=PITCH_THEME,
    )


def slide_what_shipped(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Capabilities recap",
                 "Eight New Capability Areas Since v1",
                 "Each cluster represents 2–4 shipped features that close a "
                 "specific competitive or regulatory gap.",
                 theme=PITCH_THEME)

    items = [
        ("NCQA CVO completeness",
         "Education PSV (AMA, ECFMG, ACGME) closes the last 3 of 11 NCQA "
         "CVO-certifiable products. Essen now matches the full CVO scope.",
         BLUE),
        ("Continuous monitoring",
         "Sanctions every 30 days × every license state, SAM.gov webhook, "
         "FSMB PDC, NY OMIG, NPDB Continuous Query, nightly license diffs.",
         AMBER),
        ("AI: documents + agents",
         "Doc auto-classification (Azure AI + LLM), provider self-service "
         "RAG copilot, staff compliance coach, autonomous bot orchestrator "
         "with human-override queue.",
         TEAL),
        ("Quality (JC NPG 12)",
         "Auto-FPPE on privilege grant, semi-annual OPPE auto-scheduling, "
         "structured peer-review minutes — restricted to Manager/Quality.",
         GREEN),
        ("Standards & interop",
         "FHIR R4 Provider Directory (CMS-0057-F): Practitioner, "
         "PractitionerRole, Organization, Location, Endpoint, "
         "CapabilityStatement. Public REST API with token + scope auth.",
         BLUE),
        ("Behavioral health & DEI",
         "NUCC taxonomy at intake, supervision attestations for provisional "
         "licensees, BCBS fast-track, REL fields, non-discrimination disclosure.",
         TEAL),
        ("Audit & deliverability",
         "One-click Audit-Ready Packet ZIP per provider, tamper-evident "
         "audit log (hash-chained), 90/120-day NCQA SLA timers + breach metrics.",
         GREEN),
        ("Security & ops",
         "HITRUST CSF v11 r2 + SOC 2 Type II readiness tracker, AI governance "
         "with model cards, /api/metrics Prometheus endpoint, structured JSON "
         "access logs.",
         RED),
    ]
    cw, ch = 3.05, 2.20
    x0, y0 = 0.5, 1.95
    gx, gy = 0.07, 0.20
    for i, (title, body, accent) in enumerate(items):
        col, row = i % 4, i // 4
        x = x0 + col * (cw + gx)
        y = y0 + row * (ch + gy)
        card(s, x, y, cw, ch, title, body, accent=accent,
             title_size=12, body_size=9)

    add_text(s, 0.5, 6.55, 12.3, 0.45,
             "Detail: see commit c835aa2 'Credentialing Gap Analysis 2026 — "
             "P0 through P3'. 21 Prisma migrations, 11 new tRPC routers, 9 new "
             "BullMQ jobs, 2 new webhook receivers.",
             size=10, color=INK_SOFT)
    slide_footer(s, page, theme=PITCH_THEME)


def slide_market_landscape(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Market landscape",
                 "Who Else Is in This Market",
                 "These are the vendors Essen leadership would realistically "
                 "consider — split into three buckets by go-to-market style.",
                 theme=PITCH_THEME)

    buckets = [
        ("Modern SaaS / API",
         "Built recently. Strong UX, strong API, often started as CVO + grew.",
         [
             "Medallion — full-service CVO + platform (YC-backed, ~2020)",
             "Verifiable — verification API + light platform",
             "Modio Health (OneView) — popular MSO/medical group SaaS",
         ],
         BLUE),
        ("Enterprise incumbents",
         "Long-standing market share at large hospitals and health systems.",
         [
             "symplr Cred / CredentialStream — enterprise leader, broad scope",
             "VerityStream (HealthStream Cactus) — enterprise CVO + platform",
             "MD-Staff (ASM) — established medical-staff office software",
         ],
         AMBER),
        ("Adjacent / partial",
         "Solve part of the problem; can't replace a full credentialing system.",
         [
             "CAQH ProView — provider data utility (input, not workflow)",
             "Salesforce Health Cloud + custom — flexible but heavy lift",
             "PARCS — Essen's legacy system (the baseline)",
         ],
         RED),
    ]
    cw, ch = 4.10, 4.35
    x0, y0 = 0.5, 2.0
    gx = 0.10
    for i, (title, sub, vendors, accent) in enumerate(buckets):
        x = x0 + i * (cw + gx)
        add_rect(s, x, y0, cw, ch, fill=PALE, line=LINE)
        add_rect(s, x, y0, cw, 0.10, fill=accent, rounded=False)
        add_text(s, x + 0.25, y0 + 0.20, cw - 0.50, 0.45,
                 title, size=14, bold=True, color=INK)
        add_text(s, x + 0.25, y0 + 0.75, cw - 0.50, 0.85,
                 sub, size=10, color=INK_SOFT)
        yy = y0 + 1.70
        for v in vendors:
            add_text(s, x + 0.25, yy, 0.30, 0.40, "•",
                     size=14, bold=True, color=accent)
            add_text(s, x + 0.55, yy, cw - 0.80, 0.85,
                     v, size=10, color=INK)
            yy += 0.85

    add_text(s, 0.5, 6.55, 12.3, 0.45,
             "Note: scope below compares ESSEN platform feature-for-feature "
             "against the leading vendor in each bucket.",
             size=10, color=INK_SOFT)
    slide_footer(s, page, theme=PITCH_THEME)


def _fg_row(label, vals):
    """Row helper for the feature comparison grid."""
    return [label] + vals


def slide_feature_grid_part1(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Feature comparison — 1 of 2",
                 "Capability Grid: ESSEN vs. Leading Alternatives",
                 "✓ = native, in production. ◐ = partial / add-on / professional services. "
                 "✗ = not available. Sources: vendor public docs, KLAS reviews 2025–26, customer references.",
                 theme=PITCH_THEME)

    headers = ["Capability", "ESSEN", "Medallion", "symplr Cred",
               "VerityStream", "Modio", "Verifiable", "PARCS"]
    rows = [
        _fg_row("Online provider self-service portal",
                ["✓", "✓", "✓", "✓", "✓", "◐", "✗"]),
        _fg_row("Document OCR auto-classification (AI)",
                ["✓", "◐", "◐", "◐", "◐", "✗", "✗"]),
        _fg_row("PSV bots — license + DEA (all 50)",
                ["✓", "✓", "◐", "✓", "◐", "✓", "✗"]),
        _fg_row("PSV bots — board (NCCPA, ABIM, ABFM)",
                ["✓", "✓", "◐", "✓", "◐", "✓", "✗"]),
        _fg_row("Education PSV (AMA, ECFMG, ACGME)",
                ["✓", "✓", "◐", "◐", "✗", "◐", "✗"]),
        _fg_row("Sanctions — OIG + SAM continuous (≤30d)",
                ["✓", "✓", "✓", "✓", "✓", "✓", "✗"]),
        _fg_row("State Medicaid sanctions (e.g. NY OMIG)",
                ["✓", "◐", "◐", "◐", "✗", "✗", "✗"]),
        _fg_row("NPDB Continuous Query (24h push)",
                ["✓", "✓", "✓", "✓", "◐", "✗", "✗"]),
        _fg_row("FSMB PDC continuous monitoring",
                ["✓", "◐", "✓", "✓", "◐", "✗", "✗"]),
        _fg_row("Auto-FPPE / OPPE workflow (JC NPG 12)",
                ["✓", "✗", "✓", "✓", "◐", "✗", "✗"]),
        _fg_row("Peer-review minutes (confidential)",
                ["✓", "✗", "✓", "✓", "◐", "✗", "✗"]),
        _fg_row("Committee session + auto agendas",
                ["✓", "✓", "✓", "✓", "✓", "✗", "◐"]),
    ]
    comparison_table(
        s, x_in=0.4, y_in=2.0, w_in=12.5, h_in=4.8,
        headers=headers, rows=rows,
        col_widths=[3.6, 0.95, 1.20, 1.30, 1.45, 1.05, 1.30, 1.65],
        header_fill=NAVY, font_size=9, row_height_in=0.34,
        header_height_in=0.55,
    )
    slide_footer(s, page, theme=PITCH_THEME)


def slide_feature_grid_part2(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Feature comparison — 2 of 2",
                 "Capability Grid (cont.) + Commercial",
                 "Continued from previous slide. Same legend.",
                 theme=PITCH_THEME)

    headers = ["Capability", "ESSEN", "Medallion", "symplr Cred",
               "VerityStream", "Modio", "Verifiable", "PARCS"]
    rows = [
        _fg_row("Payer enrollment workflow",
                ["✓", "✓", "✓", "✓", "✓", "✗", "◐"]),
        _fg_row("Real SFTP roster delivery + ACK polling",
                ["✓", "✓", "✓", "✓", "◐", "✗", "✗"]),
        _fg_row("CAQH ProView 2026 active-site sync",
                ["✓", "✓", "✓", "✓", "✓", "◐", "✗"]),
        _fg_row("Telehealth IMLC + platform certs",
                ["✓", "◐", "◐", "◐", "◐", "✗", "✗"]),
        _fg_row("Behavioral-health specialty path (NUCC)",
                ["✓", "◐", "◐", "✓", "✓", "✗", "✗"]),
        _fg_row("FHIR R4 Provider Directory (CMS-0057-F)",
                ["✓", "◐", "◐", "◐", "✗", "✗", "✗"]),
        _fg_row("Public REST API + scoped tokens",
                ["✓", "✓", "✓", "✓", "✓", "✓", "✗"]),
        _fg_row("Conversational AI — provider self-service",
                ["✓", "◐", "✗", "✗", "✗", "✗", "✗"]),
        _fg_row("Conversational AI — staff compliance coach",
                ["✓", "✗", "✗", "✗", "✗", "✗", "✗"]),
        _fg_row("AI governance: model cards + decision log",
                ["✓", "✗", "✗", "✗", "✗", "✗", "✗"]),
        _fg_row("One-click audit-ready packet ZIP",
                ["✓", "◐", "✓", "✓", "◐", "✗", "✗"]),
        _fg_row("Tamper-evident (hash-chained) audit log",
                ["✓", "✗", "◐", "◐", "✗", "✗", "✗"]),
        _fg_row("Hosting & data residency under Essen control",
                ["✓", "✗", "◐", "◐", "✗", "✗", "◐"]),
        _fg_row("Pricing model",
                ["Owned",
                 "Per-provider SaaS",
                 "Per-provider + impl",
                 "Per-provider + impl",
                 "Per-provider SaaS",
                 "Per-API call",
                 "Internal"]),
    ]
    comparison_table(
        s, x_in=0.4, y_in=2.0, w_in=12.5, h_in=5.0,
        headers=headers, rows=rows,
        col_widths=[3.6, 0.95, 1.20, 1.30, 1.45, 1.05, 1.30, 1.65],
        header_fill=NAVY, font_size=9, row_height_in=0.32,
        header_height_in=0.55,
    )
    slide_footer(s, page, theme=PITCH_THEME)


def slide_competitive_summary(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Where ESSEN wins",
                 "Three Categories of Competitive Advantage",
                 "Aggregating the grid — these are the categories where ESSEN's "
                 "platform is meaningfully ahead of the alternatives.",
                 theme=PITCH_THEME)

    cards_data = [
        ("Conversational AI is unique",
         "No marketplace credentialing platform ships a built-in provider "
         "self-service RAG copilot AND a staff compliance coach. Closest "
         "vendor (Medallion) offers limited chat; nothing in the enterprise "
         "tier offers either.",
         TEAL),
        ("AI governance is unique",
         "Model cards + tamper-evident decision log are HITRUST/SOC 2 "
         "differentiators that no marketplace vendor advertises. Required "
         "as auditors' AI scrutiny accelerates.",
         GREEN),
        ("Standards interop is ahead",
         "FHIR R4 Provider Directory (CMS-0057-F) is rare in this market — "
         "most vendors have a roadmap, ESSEN has it shipped. Public REST "
         "API + scoped tokens enable partner integrations without sales calls.",
         BLUE),
        ("Data ownership stays at Essen",
         "ESSEN is owned, not rented. PHI never leaves Essen's Azure tenant. "
         "Marketplace SaaS vendors require BAAs but co-mingle data in "
         "multi-tenant infrastructure.",
         AMBER),
        ("All-in cost advantage",
         "Marketplace SaaS pricing is $40–$120 per provider per month. "
         "ESSEN amortizes a one-time build over the provider population at "
         "10–15× lower TCO at Essen's scale.",
         RED),
        ("Behavioral-health specialty fit",
         "Most marketplace tools were built around physician credentialing. "
         "ESSEN's NUCC taxonomy + supervision attestations + BCBS fast-track "
         "match Essen's actual provider mix.",
         BLUE),
    ]
    cw, ch = 4.10, 2.10
    x0, y0 = 0.5, 2.0
    gx, gy = 0.10, 0.18
    for i, (title, body, accent) in enumerate(cards_data):
        col, row = i % 3, i // 3
        x = x0 + col * (cw + gx)
        y = y0 + row * (ch + gy)
        card(s, x, y, cw, ch, title, body, accent=accent,
             title_size=12, body_size=10)

    slide_footer(s, page, theme=PITCH_THEME)


def slide_competitive_caveats(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Honest assessment",
                 "Where the Market Has an Edge — and How We Close It",
                 "Three areas where well-funded vendors will be ahead of "
                 "us. Each has a planned response.",
                 theme=PITCH_THEME)

    rows = [
        ["Brand & vendor risk reputation",
         "Buy-side prefers a known logo on RFPs. Medallion / symplr have name recognition.",
         "Position ESSEN as an internal platform, not a vendor. SOC 2 Type II + HITRUST "
         "attestation, customer references, KLAS-style independent review."],
        ["Network effect across customers",
         "SaaS vendors learn from the union of their customers' data — fraud patterns, "
         "common errors, payer quirks.",
         "Federate de-identified telemetry across HD Pulse AI deployments. "
         "Lawful, privacy-preserving aggregation of bot success rates and payer ack patterns."],
        ["24×7 vendor support",
         "Enterprise vendors have follow-the-sun support teams.",
         "Already addressed: HD Pulse AI dev team owns the platform. Runbooks, "
         "alerting, and on-call rotation are in production."],
        ["Pre-built payer roster templates",
         "VerityStream and symplr ship hundreds of payer-specific roster formats.",
         "Each new payer onboarding adds a roster template. Library doubled in the "
         "last 60 days. Generic SFTP + per-payer config covers the long tail."],
        ["Mobile native app",
         "Modio has a native iOS app for on-the-go credential checks.",
         "ESSEN PWA already mobile-installable. Native iOS shell tracked for Q3 2026 "
         "if user research justifies it."],
    ]
    comparison_table(
        s, x_in=0.5, y_in=2.0, w_in=12.3, h_in=4.5,
        headers=["Where they're ahead", "Why it matters",
                 "How we respond"],
        rows=rows,
        col_widths=[3.4, 4.4, 4.5],
        header_fill=NAVY, font_size=10, row_height_in=0.85,
    )
    slide_footer(s, page, theme=PITCH_THEME)


def slide_updated_roi(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Updated ROI",
                 "Numbers Refresh — What v3 Adds to the Business Case",
                 "v1 numbers stand. The shipped v3 features add the following "
                 "incremental impact on top.",
                 theme=PITCH_THEME)

    stats = [
        ("100%",  "NCQA CVO\nproduct coverage", TEAL),
        ("≤24h",  "NPDB adverse-action\ndetection (was 30+ days)", AMBER),
        ("11/11", "Marketplace gaps\nclosed by v3 (see grid)", BLUE),
        ("0",     "Vendor seat licenses\nrequired", GREEN),
    ]
    cw = 2.95
    for i, (big, lab, color) in enumerate(stats):
        x = 0.5 + i * (cw + 0.15)
        stat_card(s, x, 2.0, cw, 1.65, big, lab, big_color=color)

    rows = [
        ["NCQA reaccreditation prep cost",
         "Manual chart audits, $$$ consultant time",
         "1-click audit packet, ~$0 marginal cost"],
        ["Time to detect a sanction or NPDB report",
         "Up to 30 days (monthly recheck cycle)",
         "≤24 hours (continuous query + state continuous monitoring)"],
        ["Cost to add a new state Medicaid",
         "New custom integration project",
         "Plug-in framework — content-only addition"],
        ["AI/automation governance evidence",
         "Manual evidence binder, audit-by-audit",
         "Always-on model cards + decision log + hash-chained audit"],
        ["Cost to onboard a new payer roster format",
         "Per-format engineering, weeks each",
         "Per-payer config in admin — hours, not weeks"],
    ]
    comparison_table(
        s, x_in=0.5, y_in=3.85, w_in=12.3, h_in=2.6,
        headers=["Dimension", "Before v3", "After v3"],
        rows=rows,
        col_widths=[3.6, 4.4, 4.3],
        header_fill=NAVY, font_size=10, row_height_in=0.50,
    )
    slide_footer(s, page, theme=PITCH_THEME)


def slide_decision_recap(pres, page):
    s = add_blank_slide(pres)
    add_rect(s, 0, 0, 13.33, 7.5, fill=NAVY, rounded=False)

    add_text(s, 0.8, 0.7, 11.7, 0.40, "DECISION RECAP",
             size=12, bold=True, color=BLUE)
    add_text(s, 0.8, 1.05, 11.7, 1.0, "Build vs. Buy — Where We Land",
             size=36, bold=True, color=WHITE)
    add_text(s, 0.8, 2.10, 11.7, 0.5,
             "After 24 P0–P3 features and a fair feature-grid comparison, the "
             "verdict for Essen's scale and provider mix is clear.",
             size=14, color=PALE)

    cards = [
        ("Build / continue ESSEN", GREEN,
         "  ✓  Already shipped\n"
         "  ✓  Owned IP — no per-provider rent\n"
         "  ✓  Conversational AI + AI governance:\n     unique in market\n"
         "  ✓  Behavioral-health-aware specialty path\n"
         "  ✓  Data stays in Essen's Azure tenant\n"
         "  ✓  HITRUST/SOC 2 readiness on our timeline"),
        ("Buy a marketplace tool", AMBER,
         "  ◐  Faster brand-recognized RFP answer\n"
         "  ◐  Pre-built payer roster library\n"
         "  ✗  $40–$120 per provider per month\n"
         "  ✗  PHI co-mingled in multi-tenant SaaS\n"
         "  ✗  Roadmap dependence for AI features\n"
         "  ✗  Loses Essen-specific BTC / OMIG / etc."),
    ]
    cw = 5.85
    for i, (title, accent, body) in enumerate(cards):
        x = 0.8 + i * (cw + 0.30)
        add_rect(s, x, 2.85, cw, 3.7, fill=WHITE, line=LINE)
        add_rect(s, x, 2.85, cw, 0.10, fill=accent, rounded=False)
        add_text(s, x + 0.30, 3.05, cw - 0.6, 0.5, title,
                 size=18, bold=True, color=INK)
        add_text(s, x + 0.30, 3.65, cw - 0.6, 2.85, body,
                 size=12, color=INK_SOFT)

    add_text(s, 0.8, 6.85, 11.7, 0.40,
             "Recommendation: stay the course on ESSEN. Use the budget that "
             "would have gone to vendor licenses to staff training, partner "
             "API onboarding, and SOC 2 Type II audit prep.",
             size=11, bold=True, color=WHITE)
    add_text(s, 0.8, 7.20, 6.0, 0.30,
             "ESSEN Credentialing Platform",
             size=9, color=PALE)
    add_text(s, 11.0, 7.20, 1.7, 0.30, str(page),
             size=9, bold=True, color=BLUE,
             align=2)  # PP_ALIGN.RIGHT == 2


def slide_next_steps(pres, page):
    s = add_blank_slide(pres)
    slide_header(s, "Next 90 days",
                 "Where We Take ESSEN From Here",
                 "The build is in production. The next phase is adoption + "
                 "external positioning + audit readiness.",
                 theme=PITCH_THEME)

    rows = [
        ["Now → 30 days",
         "Activate + train",
         "Complete production rollout, train credentialing team on v3 features, "
         "wire prod SENDGRID_WEBHOOK_PUBLIC_KEY + METRICS_BEARER_TOKEN, onboard "
         "first FHIR partner."],
        ["30 → 60 days",
         "Audit readiness",
         "Publish SOC 2 Type II audit period start, begin HITRUST CSF v11 r2 "
         "control evidence collection, run first NCQA mock audit using the "
         "1-click packet."],
        ["60 → 90 days",
         "External proof points",
         "Ship 2–3 customer references / KLAS-style writeups, present at HFMA "
         "or NAMSS regional, evaluate offering ESSEN to a partner site as the "
         "first external deployment."],
    ]
    comparison_table(
        s, x_in=0.5, y_in=2.0, w_in=12.3, h_in=3.5,
        headers=["Window", "Theme", "Specifics"],
        rows=rows,
        col_widths=[2.0, 2.5, 7.8],
        header_fill=NAVY, font_size=11, row_height_in=1.10,
    )

    add_rect(s, 0.5, 5.85, 12.3, 1.0, fill=PALE, line=LINE)
    add_rect(s, 0.5, 5.85, 12.3, 0.10, fill=BLUE, rounded=False)
    add_text(s, 0.75, 6.05, 11.8, 0.45,
             "What we need from leadership", size=14, bold=True, color=INK)
    add_text(s, 0.75, 6.45, 11.8, 0.40,
             "1) Sign-off on the build-vs-buy recap   "
             "2) Authorization to begin SOC 2 Type II audit period   "
             "3) Approval to publish ESSEN externally as a HD Pulse AI offering",
             size=11, color=INK_SOFT)

    slide_footer(s, page, theme=PITCH_THEME)


def main():
    pres = Presentation(INPUT)

    page = START_PAGE
    builders = [
        slide_v2_intro,
        slide_what_shipped,
        slide_market_landscape,
        slide_feature_grid_part1,
        slide_feature_grid_part2,
        slide_competitive_summary,
        slide_competitive_caveats,
        slide_updated_roi,
        slide_decision_recap,
        slide_next_steps,
    ]
    for fn in builders:
        fn(pres, page)
        page += 1

    pres.save(OUTPUT)
    n = len(pres.slides)
    print(f"OK: wrote {OUTPUT}")
    print(f"   slides: {n} (was 13 + {n - 13} new)")


if __name__ == "__main__":
    main()
