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