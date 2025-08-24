# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

### Database Schema

The app uses GTFS (General Transit Feed Specification) data stored in SQLite:

- `Stop`, `Route`, `Trip`, `StopTime` models for transit data
- `Calendar`, `CalendarDate` for schedule management
- `RateLimit` for API throttling

### Key Services

- **TransitService** (`src/lib/transit/transit-service.ts`): Main service class handling route search, stop finding, and timetable queries
- **TimeTableRouter** (`src/lib/transit/route-algorithm.ts`): Implements Dijkstra-based route finding algorithm
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

## Development Setup

1. Create `transit-config.json` in project root (see `transit-config.json.example`)
2. Set up environment variables in `.env.local`:
   - `GOOGLE_MAPS_API_KEY`
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID`
3. The app auto-generates Prisma client and imports GTFS data on build

## Testing

- Jest with React Testing Library
- Test files in `__tests__` directories or `.test.ts/.test.tsx` files
- Mocks for external dependencies in `__mocks__/` and `src/__mocks__/`

## File Structure Notes

- Components use TypeScript with strict typing
- Ruby text support for Japanese text rendering
- PDF export functionality for route information
- Google Maps integration for location services
- Analytics with Google Analytics 4

## Important Patterns

- Singleton pattern for TransitService
- Error boundaries and loading states
- Accessible UI with ARIA labels
- Rate limiting on API endpoints
- Structured data for SEO

The codebase follows Japanese naming conventions and includes extensive Japanese comments and UI text.

## UI

The UI uses Tailwind + DaisyUI5.

## img

Images may be loaded from an external URL. In this case, Image cannot be used and img is used.

## btn

Rounding by cupcake in daisyui may not work so `rounded-full dark:rounded-sm` is used.

## TDD

Follow TDD principles. First, write the tests. Avoid writing tests for things that don't exist in the specification (e.g., don't create a test for "the administrator role does not exist"). Ensure all tests pass. If something is known to work, you may remove overly complex tests that fail. Run syntax check, lint, test, and build; fix errors until none remain.

## 会話

会話は日本語で行う。
