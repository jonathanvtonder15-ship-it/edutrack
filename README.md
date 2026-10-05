# Custom UI Next.js Base

A [Next.js](https://nextjs.org) project template with a comprehensive UI component library built on [shadcn/ui](https://ui.shadcn.com/) and [Radix UI](https://www.radix-ui.com/) primitives.

## Tech Stack

- **Framework:** Next.js 16.1 with App Router
- **Language:** TypeScript 5
- **UI Library:** React 19
- **Styling:** Tailwind CSS 4 with CSS variables
- **Components:** shadcn/ui (new-york style) + Radix UI primitives
- **Icons:** Lucide React
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts
- **Animations:** tw-animate-css

## Project Structure

```
├── app/                    # Next.js App Router directory
│   ├── favicon.ico         # Site favicon
│   ├── globals.css         # Global styles & Tailwind CSS configuration
│   ├── layout.tsx          # Root layout (Geist fonts, metadata)
│   └── page.tsx            # Home page component
│
├── components/             # React components
│   └── ui/                 # shadcn/ui component library
│       ├── accordion.tsx       # Expandable content sections
│       ├── alert-dialog.tsx    # Modal confirmation dialogs
│       ├── alert.tsx           # Inline alert messages
│       ├── aspect-ratio.tsx    # Responsive aspect ratio container
│       ├── avatar.tsx          # User avatar with fallback
│       ├── badge.tsx           # Status/label badges
│       ├── breadcrumb.tsx      # Navigation breadcrumbs
│       ├── button-group.tsx    # Grouped button actions
│       ├── button.tsx          # Button with variants
│       ├── calendar.tsx        # Date picker calendar (react-day-picker)
│       ├── card.tsx            # Card container component
│       ├── carousel.tsx        # Image/content carousel (embla)
│       ├── chart.tsx           # Chart components (recharts)
│       ├── checkbox.tsx        # Checkbox input
│       ├── collapsible.tsx     # Collapsible content panel
│       ├── command.tsx         # Command palette (cmdk)
│       ├── context-menu.tsx    # Right-click context menu
│       ├── dialog.tsx          # Modal dialog
│       ├── drawer.tsx          # Slide-out drawer (vaul)
│       ├── dropdown-menu.tsx   # Dropdown menu
│       ├── empty.tsx           # Empty state placeholder
│       ├── field.tsx           # Form field wrapper
│       ├── form.tsx            # Form components (react-hook-form)
│       ├── hover-card.tsx      # Hover-triggered card
│       ├── input-group.tsx     # Input with addons
│       ├── input-otp.tsx       # OTP input field
│       ├── input.tsx           # Text input
│       ├── item.tsx            # List item component
│       ├── kbd.tsx             # Keyboard shortcut display
│       ├── label.tsx           # Form label
│       ├── menubar.tsx         # Application menubar
│       ├── navigation-menu.tsx # Navigation menu with dropdowns
│       ├── pagination.tsx      # Page navigation
│       ├── popover.tsx         # Popover overlay
│       ├── progress.tsx        # Progress bar
│       ├── radio-group.tsx     # Radio button group
│       ├── resizable.tsx       # Resizable panels
│       ├── scroll-area.tsx     # Custom scrollbar container
│       ├── select.tsx          # Select dropdown
│       ├── separator.tsx       # Visual divider
│       ├── sheet.tsx           # Side sheet overlay
│       ├── sidebar.tsx         # Sidebar navigation
│       ├── skeleton.tsx        # Loading skeleton
│       ├── slider.tsx          # Range slider
│       ├── sonner.tsx          # Toast notifications (sonner)
│       ├── spinner.tsx         # Loading spinner
│       ├── switch.tsx          # Toggle switch
│       ├── table.tsx           # Data table
│       ├── tabs.tsx            # Tabbed interface
│       ├── textarea.tsx        # Multi-line text input
│       ├── toggle-group.tsx    # Toggle button group
│       ├── toggle.tsx          # Toggle button
│       └── tooltip.tsx         # Hover tooltip
│
├── hooks/                  # Custom React hooks
│   └── use-mobile.ts       # Mobile breakpoint detection hook
│
├── lib/                    # Utility functions
│   └── utils.ts            # cn() helper for className merging (clsx + tailwind-merge)
│
├── public/                 # Static assets
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
├── components.json         # shadcn/ui configuration
├── eslint.config.mjs       # ESLint configuration
├── next.config.ts          # Next.js configuration
├── package.json            # Dependencies and scripts
├── postcss.config.mjs      # PostCSS configuration
└── tsconfig.json           # TypeScript configuration
```

## Key Directories

### `/app`
The Next.js App Router directory containing pages and layouts. Uses file-based routing where each folder represents a route segment.

- `layout.tsx` - Root layout wrapping all pages, configures Geist fonts (sans & mono)
- `page.tsx` - Home page at the root route (`/`)
- `globals.css` - Global styles including Tailwind CSS base, components, and utilities

### `/components/ui`
A comprehensive library of 50+ pre-built UI components based on shadcn/ui. All components are:
- Fully typed with TypeScript
- Styled with Tailwind CSS using CSS variables for theming
- Built on accessible Radix UI primitives
- Customizable and composable

### `/hooks`
Custom React hooks for shared functionality:
- `useIsMobile()` - Detects mobile viewport (< 768px breakpoint)

### `/lib`
Utility functions and helpers:
- `cn()` - Merges Tailwind CSS classes with proper precedence handling

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Adding Components

This project uses shadcn/ui. To add new components:

```bash
npx shadcn@latest add [component-name]
```

Components will be added to `components/ui/` and can be customized directly.

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs) - Next.js features and API
- [shadcn/ui Documentation](https://ui.shadcn.com/) - Component library docs
- [Radix UI](https://www.radix-ui.com/) - Accessible component primitives
- [Tailwind CSS](https://tailwindcss.com/docs) - Utility-first CSS framework
- [React Hook Form](https://react-hook-form.com/) - Form handling
- [Zod](https://zod.dev/) - Schema validation

## License

This project is private.
## EduTrack configuration and checks

Copy `.env.example` to `.env.local` and configure your Supabase URL, public anon key,
server service role key, and a private `SESSION_SECRET` of at least 32 characters.
Set `NEXT_PUBLIC_APP_URL` to the deployed site URL. Service role keys must never be
committed or exposed through `NEXT_PUBLIC_` variables. Rotate the service role key
previously committed to this repository in Supabase before deploying this patch.
Existing users must sign in again to obtain the new HTTP-only session cookie.

Before deployment, apply `database/attendance-unique.sql` in your database. If it
fails because duplicate register entries exist, reconcile those records first;
the migration deliberately does not delete school data. Attendance saves now use
an atomic upsert and retain offline records when synchronization fails.

The repository does not contain the database schema or RLS policies. Verify them
in a separate test project before production use. Most dashboard data operations
still use the public Supabase client; the custom application session is **not** a
Supabase Auth identity. The database must restrict anonymous access to school data
and especially the `users` table/password hashes. Complete authorization for these
operations requires a Supabase Auth/RLS migration or authenticated server APIs;
server-side user-management checks alone do not secure direct database access.

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm audit`.
Regression tests use synthetic fixtures and do not contact a school database.
The remaining audit advisory affects `braces` through Next.js's lint tooling;
there is no compatible patched release in the registry used for this check.
Do not apply the suggested downgrade to Next.js 14 lint configuration.

The API regression suite is opt-in: run `EDUTRACK_TEST_URL=http://localhost:3000 npm test`
against an app configured with `tests/support/database-fixture.ts`. Start that
fixture with `npx tsx -e "import { startDatabaseFixture } from './tests/support/database-fixture'; startDatabaseFixture(54321)"`.
For this local test app, set `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`,
use synthetic nonempty anon/service keys, and generate a separate session secret.
The fixture login is `fixture-admin` / `fixture-password`. Never configure this
fixture for a deployed app. It intentionally implements only the HTTP contracts
needed for these tests and does not enforce Supabase database permissions.

Timetable AI parsing connects directly to OpenAI using the optional server-only
`OPENAI_API_KEY`. Without it, the app remains usable and AI parsing returns a
configuration error. Social preview images and the site icon are generated locally
with EduTrack branding.
