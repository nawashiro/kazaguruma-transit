# Specification Quality Checklist: 場所データページのJavaScript削減

**Purpose**: Issue #79のうち、場所データ・カテゴリナビゲーション・場所詳細ページのJavaScript削減要求を確認する
**Created**: 2026-09-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) beyond the explicitly requested page/data boundary
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic where the user-visible outcome permits
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded; route-form work is explicitly deferred
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary location-data flows
- [x] Feature meets measurable outcomes defined in Success Criteria now that Q1–Q14 are resolved
- [x] No unrequested implementation details leak into the specification

## Notes

- Q1 was resolved on 2026-09-06: use `/locations/location-detail/[id]` as the only canonical detail URL and do not add a compatibility redirect from `/location-detail/[id]`.
- Q2 was revised on 2026-09-06: SSG is optional; fail the build on data failure only when SSG is selected, and render a Japanese error state when SSR is selected.
- Q3 was resolved on 2026-09-06: use the existing `category:en` value URL-encoded as `[category-id]`; do not add a separate slug mapping.
- Q4 was resolved on 2026-09-06: JavaScript reduction is the goal; SSR/SSG is an implementation choice, and necessary interaction JavaScript is not removed indiscriminately.
- Q5 was revised on 2026-09-06: keep nearby-location display as a GPS-only operation with two display controls; remove name/address search, Google Maps/geocoding dependency, and its dedicated address-search rate-limit flow.
- Q6 was resolved on 2026-09-06: make category tabs a shared-layout URL navigation and use `/discussions` management navigation as the reference implementation.
- Q7 was resolved on 2026-09-06: resolve `/locations` to the first category's canonical URL and mark the first navigation item active; the current first category is `city_office_and_branch_offices` / `区役所・出張所`.
- Q8 was resolved on 2026-09-06: add `origin=<latitude>,<longitude>` to the current category URL and use the existing latitude/longitude order; place the GPS operation below the category navigation.
- Q9 was resolved on 2026-09-06: keep `origin` in the current category URL, preserve it across category navigation, and remove it for detail/other links and the default「町字で並べる」operation; do not persist it.
- Q10 was resolved on 2026-09-06: provide「町字で並べる」and「近い順に並べる」below the category navigation, with the former clearing `origin` and the latter obtaining GPS and setting it.
- Q11 was resolved on 2026-09-06: missing `origin` uses「町字で並べる」; numeric coordinates outside Chiyoda are accepted; unparseable values show a Japanese error while keeping the normal town-grouped list, and invalid `origin` is not propagated to category links.
- Q12 was resolved on 2026-09-06: retain an unparseable `origin` in the current URL while showing the error and town-grouped list; remove it only when「町字で並べる」is explicitly selected.
- Q13 was resolved on 2026-09-06: preserve an existing valid `origin` and distance-sorted list when GPS re-acquisition fails, and show only the re-acquisition error.
- Q14 was resolved on 2026-09-06: return the standard 404 for nonexistent or malformed category/detail URLs; keep data-load, duplicate-ID, and malformed-data failures as separate data-error states.
- The home route-search form remains a separate feature and must not be added to this specification.
