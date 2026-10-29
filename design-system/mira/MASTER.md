# MIRA Design System Master Specification (MASTER.md)
*Linear / Raycast Developer Tool Aesthetic for AI Teammate & Cloud Sandbox Platform*

## 1. Philosophical Pillars & Aesthetic Direction (Anti-Generic AI)
- **No Neon Purple/Pink Blobs:** Explicitly reject generic AI purple/magenta glow gradients and pitch AMOLED `#000000` voids.
- **Precision Engineering Surfaces:** Warm graphite and layered zinc primitives (`#0d0f12` base canvas, `#13161b` panels/cards, `#1a1e24` elevated popovers/headers).
- **Crisp Alpha Dividers:** 1px hairline borders with alpha transparency (`rgba(255, 255, 255, 0.08)` to `0.12`).
- **Laser-Focused Accent:** Electric Cyan-Teal (`#06b6d4` / `#22d3ee`) for active states, live connection indicators, and focus rings, balanced with Warm Amber (`#f59e0b` / `#f97316`) for computational execution and pending operations.
- **Strict Information Hierarchy:**
  * Primary (`#f3f4f6`): High-contrast titles, active text, code tokens.
  * Secondary (`#9ca3af`): Metadata, labels, bot jobs, secondary actions.
  * Tertiary (`#6b7280`): Timestamps, tool arguments, keyboard shortcuts.

---

## 2. Three-Layer Token Architecture

### 2.1 Primitive Tokens
```css
/* Dark Surfaces (Graphite & Zinc) */
--color-surface-base: #0d0f12;         /* App background / Canvas */
--color-surface-panel: #13161b;        /* Sidebar, cards, stream container */
--color-surface-elevated: #1a1e24;     /* Headers, modals, tool headers */
--color-surface-hover: #21262e;        /* Interactive row hover */
--color-surface-active: #282f3a;       /* Active tab/button state */

/* Light Surfaces (Clean Paper & Zinc) */
--color-surface-base-light: #f8fafc;
--color-surface-panel-light: #ffffff;
--color-surface-elevated-light: #f1f5f9;
--color-surface-hover-light: #e2e8f0;

/* Borders (Alpha Transparency) */
--border-subtle: rgba(255, 255, 255, 0.08);
--border-strong: rgba(255, 255, 255, 0.14);
--border-focus: rgba(6, 182, 212, 0.6);

/* Text Hierarchy */
--text-primary: #f3f4f6;
--text-secondary: #9ca3af;
--text-muted: #6b7280;
--text-subtle: #4b5563;

/* Accents */
--accent-cyan: #06b6d4;
--accent-cyan-hover: #0891b2;
--accent-cyan-glow: rgba(6, 182, 212, 0.25);
--accent-amber: #f59e0b;
--accent-amber-glow: rgba(245, 158, 11, 0.25);
--accent-emerald: #10b981;             /* Live status */
--accent-rose: #f43f5e;                /* Destructive */
```

### 2.2 Semantic Tokens (Tailwind v4 / CSS Variables)
```css
:root {
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: #06b6d4;
  --primary-foreground: #042f2e;
  --secondary: #f1f5f9;
  --secondary-foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #f1f5f9;
  --accent-foreground: #0f172a;
  --destructive: #f43f5e;
  --border: #e2e8f0;
  --input: #e2e8f0;
  --ring: #06b6d4;
  --sidebar: #f8fafc;
  --sidebar-foreground: #0f172a;
  --sidebar-primary: #06b6d4;
  --sidebar-border: #e2e8f0;
  --radius: 0.625rem;
}

.dark {
  --background: #0d0f12;
  --foreground: #f3f4f6;
  --card: #13161b;
  --card-foreground: #f3f4f6;
  --popover: #1a1e24;
  --popover-foreground: #f3f4f6;
  --primary: #06b6d4;
  --primary-foreground: #042f2e;
  --secondary: #1a1e24;
  --secondary-foreground: #f3f4f6;
  --muted: #181c22;
  --muted-foreground: #9ca3af;
  --accent: #1f242c;
  --accent-foreground: #f3f4f6;
  --destructive: #f43f5e;
  --border: rgba(255, 255, 255, 0.08);
  --input: rgba(255, 255, 255, 0.12);
  --ring: #06b6d4;
  --sidebar: #101216;
  --sidebar-foreground: #f3f4f6;
  --sidebar-primary: #06b6d4;
  --sidebar-accent: #181c22;
  --sidebar-accent-foreground: #f3f4f6;
  --sidebar-border: rgba(255, 255, 255, 0.08);
  --sidebar-ring: #06b6d4;
}
```

### 2.3 Component Tokens
- **Message Bubble (Human):** Surface `#1a1e24`, border `rgba(255, 255, 255, 0.1)`, padding `1rem (p-4)`, radius `rounded-xl`, max-width `75%`.
- **Message Bubble (Agent):** Transparent / subtle graphite tint, text `#f3f4f6`, max-width `92%`.
- **Code Block:** Container `#0d0f12`, border `rgba(255, 255, 255, 0.09)`, header `#15191f`, language pill `#20252e`, 1-click copy with instant feedback.
- **Tool Card:** Surface `#14171d`, header `#1a1e26`, border `rgba(255, 255, 255, 0.08)`, subtle cyan pulse indicator when executing.
- **Handoff Badge:** Surface `#121e25`, border `rgba(6, 182, 212, 0.25)`, text `#22d3ee`, avatar cross-fade transition.
- **VNC Canvas Control Bar:** Surface `#151920`, border `rgba(255, 255, 255, 0.08)`, live green dot `#10b981`, resolution toggle, take-control toggle button.

---

## 3. Responsive Breakpoints & Viewport Rules

| Viewport | Range | Sidebar Behavior | VNC Desktop Panel Behavior | Composer Behavior |
|----------|-------|------------------|-----------------------------|-------------------|
| **Mobile** | `< 768px` | Sliding Sheet/Drawer with gesture dismiss (`useIsMobile`) | Hidden by default; opens via top header button as an edge-to-edge modal Sheet | Fixed above mobile keyboard, min 44px touch targets |
| **Tablet** | `768px - 1024px` | Default collapsed icon mode (`collapsed="icon"`) | Resizable 50/50 snap or toggleable split without horizontal scroll bleed | Pinned footer with clear responsive bot-role dropdown |
| **Desktop**| `> 1024px` | Fluid expandable sidebar with keyboard shortcut (`Cmd+B`) | Dual-pane resizable Daytona canvas (30% - 60%) with live control bar | Centered max-3xl composer with zero window scrollbar bleed |

---

## 4. Accessibility & Micro-Interactions
- **Contrast Ratios:** Pure `#f3f4f6` text on `#0d0f12` yields a 16.2:1 contrast ratio, far surpassing WCAG AAA (7:1).
- **Focus Rings:** Unbroken 2px focus ring with `ring-primary/60 ring-offset-2 ring-offset-background`.
- **Aria Labels:** All icon-only triggers (`Monitor`, `MoreVertical`, `Copy`, `RotateCw`, `Expand`) carry explicit `aria-label` and `title` attributes.
- **Motion:** Spring-based subtle micro-interactions with `motion` / CSS transitions (`duration-150 ease-out`).

