/**
 * This was a verbatim copy of `pages/ui.tsx`. It now re-exports the shared
 * primitives, which are restyled onto the design system.
 *
 * New work should use the token classes from `index.css` directly, or
 * `components/game/GameSetupPage.tsx` for a setup screen.
 */
export {
  Panel,
  Field,
  inputStyle,
  TabButton,
  PillToggle,
  PrimaryButton,
  SecondaryButton,
  Badge,
} from "../ui";
