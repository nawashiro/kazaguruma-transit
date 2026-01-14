# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

1. Be extraordinarily skeptical of your own correctness or stated assumptions. You aren't a cynic, you are a highly critical thinker and this is tempered by your self-doubt: you absolutely hate being wrong but you live in constant fear of it
2. When appropriate, broaden the scope of inquiry beyond the stated assumptions to think through unconvenitional opportunities, risks, and pattern-matching to widen the aperture of solutions
3. Before calling anything "done" or "working", take a second look at it ("red team" it) to critically analyze that you really are done or it really is working

## 会話

会話は日本語で行う。

## TDD

Follow TDD principles. First, write the tests. Avoid writing tests for things that don't exist in the specification (e.g., don't create a test for "the administrator role does not exist"). Ensure all tests pass. If something is known to work, you may remove overly complex tests that fail. Run tsc, lint, test, and build; fix errors until none remain.

## Project Overview

This is an unofficial web application for Chiyoda Ward's welfare transit "Kazaguruma" (風ぐるま). It provides route planning and timetable information for the local bus service.

## Key Commands

### Development

```bash
npm run dev          # Start development server with Turbopack
npm install          # Install dependencies
```

### Testing

```bash
npm test             # Run Jest tests
npm test:watch       # Run Jest in watch mode
npm run lint         # Run ESLint
npx tsc --noEmit     # TypeScript type checking
```

### Database & Build

```bash
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm run import-gtfs      # Import GTFS transit data
npm run build            # Full production build (includes GTFS import)
npm start                # Start production server
```

## Architecture

### Core Components

- **Next.js 15** with App Router and React 19
- **Prisma ORM** with SQLite for GTFS transit data
- **DaisyUI + Tailwind CSS** for UI components
- **Transit service layer** (`src/lib/transit/`) for route algorithms
- **Nostr integration** (`src/lib/nostr/`) for decentralized discussion features

### Database Schema

The app uses GTFS (General Transit Feed Specification) data stored in SQLite:

- `Stop`, `Route`, `Trip`, `StopTime` models for transit data
- `Calendar`, `CalendarDate` for schedule management
- `RateLimit` for API throttling

### Key Services

- **TransitService** (`src/lib/transit/transit-service.ts`): Main service class handling route search, stop finding, and timetable queries
- **TimeTableRouter** (`src/lib/transit/route-algorithm.ts`): Implements Dijkstra-based route finding algorithm
- **NostrService** (`src/lib/nostr/nostr-service.ts`): Handles Nostr protocol communications for discussions
- **EvaluationService** (`src/lib/evaluation/evaluation-service.ts`): Polis-based consensus analysis for discussion posts
- **Rate limiting middleware** for API protection

### API Structure

Main API endpoint: `/api/transit` handles:

- Route queries (type: "route")
- Stop searches (type: "stop")
- Timetable requests (type: "timetable")

### Route Finding Algorithm

Two search strategies:

1. **Conventional search**: Uses nearest stops to origin/destination
2. **Speed-prioritized search**: Considers multiple nearby stops for optimal routes
3. Supports direct routes and transfers (max 2 transfers, 3-hour time window)

### Component Architecture

- **Pages** (`src/app/`): Next.js App Router pages with nested layouts
- **Components** (`src/components/`): Organized by category
  - `features/`: Feature-specific components (route display, selectors, modals)
  - `layouts/`: Layout components (sidebar, analytics, structured data)
  - `ui/`: Reusable UI components (buttons, cards, inputs)
  - `discussion/`: Nostr-based discussion system components
- **Libraries** (`src/lib/`): Business logic and utilities
  - `transit/`: Route planning and transit data management
  - `nostr/`: Nostr protocol implementation and utilities
  - `discussion/`: Discussion permission system and user flows
  - `evaluation/`: Consensus analysis algorithms
  - `db/`: Database abstraction and Prisma integration
  - `maps/`: Google Maps integration

### State Management

- React hooks for local component state
- Singleton pattern for TransitService
- Independent data loading for audit logs vs main content
- Session-based authentication via iron-session

## Development Setup

1. Create `transit-config.json` in project root (see `transit-config.json.example`)
2. Set up environment variables in `.env.local`:
   - `GOOGLE_MAPS_API_KEY`
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID`
   - `NEXT_PUBLIC_DISCUSSIONS_ENABLED` (optional, for discussion features)
   - `NEXT_PUBLIC_ADMIN_PUBKEY` (optional, for discussion admin)
   - `NEXT_PUBLIC_NOSTR_RELAYS` (optional, for Nostr relays)
   - `NEXT_PUBLIC_DISCUSSION_LIST_NADDR` (required for discussion list page)
3. The app auto-generates Prisma client and imports GTFS data on build

## Testing

- Jest with React Testing Library
- Test files in `__tests__` directories or `.test.ts/.test.tsx` files
- Mocks for external dependencies in `__mocks__/` and `src/__mocks__/`

## File Structure Notes

- Components use TypeScript with strict typing
- Ruby text support for Japanese text rendering (`ruby-text` CSS class)
- PDF export functionality for route information
- Google Maps integration for location services
- Analytics with Google Analytics 4

## Important Patterns

### Component Design

- Singleton pattern for TransitService
- Error boundaries and loading states
- Accessible UI with ARIA labels
- Forward refs for reusable components (e.g., AuditLogSection)
- Separation of main content and audit log data flows

### Styling

- Tailwind + DaisyUI with custom button rounding: `rounded-full dark:rounded-sm`
- Images from external URLs use `<img>` instead of Next.js `<Image>`
- Japanese text rendered with `ruby-text` class for proper formatting

### Data Loading

- Independent audit log components with ref-based trigger functions
- Test mode support via `isTestMode()` checks
- Profile loading limited to creators and moderators only
- Conversation audit mode filtering for timeline displays

## Discussion Features

This app includes Nostr-based decentralized discussion functionality:

- **NIP-72 Compliance**: Supports moderated communities with kind:34550 (community definition) and kind:4550 (approval events)
- **NIP-25 Reactions**: Uses kind:7 events for post evaluations (content-based, not rating tags)
- **Consensus Analysis**: Implements Polis algorithm for analyzing group consensus on posts
- **Permission System**: Creator and moderator-based access control (no global admin for discussions)
- **Audit Log System**: Reusable AuditLogSection component with conversation/list mode support

### Key Protocols

- Posts use kind:1111 (community posts) with backward compatibility for kind:1
- Evaluations use kind:7 with content field ("-" for negative, anything else as positive)
- Approval system stores original post data in approval event content
- Discussion list management uses NADDR-based references for individual conversations

### Discussion Architecture

- **Individual Discussion Pages** (`/discussions/[naddr]`): Full discussion interface with posts, evaluations, and consensus analysis
- **Discussion List Page** (`/discussions`): Overview of all discussions with audit logs for cross-conversation activity
- **AuditLogSection Component**: Shared component handling audit timeline with support for both individual discussions and discussion list contexts
- **Profile Loading Strategy**: Collects profiles only for creators and moderators, not general post authors

## Active Technologies
- TypeScript 5 (strict mode) + Next.js 15 (App Router), React 19, DaisyUI 5, Tailwind CSS 4, nostr-tools (001-audit-page-refactor)
- N/A（Nostrリレーサーバーから直接取得） (001-audit-page-refactor)

## Recent Changes
- 001-audit-page-refactor: Added TypeScript 5 (strict mode) + Next.js 15 (App Router), React 19, DaisyUI 5, Tailwind CSS 4, nostr-tools
