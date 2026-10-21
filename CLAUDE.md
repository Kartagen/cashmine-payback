@AGENTS.md

## Design rules
- Aesthetic: calm, editorial, utilitarian. Reference: Things 3 / Linear mobile.
- Colors: near-black text (#1A1A1A) on warm off-white (#FAF8F5). ONE accent (#D9480F), used only for primary actions.
- No gradients. No glassmorphism. No colored shadows.
- Prefer hairline dividers and whitespace over cards. Only use a card when content is genuinely a separate object.
- Typography: "Söhne" for UI, tabular numbers for data. Use the type scale in theme.ts only.
- Icons: Phosphor, regular weight, never inside colored circles. No emoji in UI.
- Left-align content. Don't center things unless it's an empty state.
- Copy: short, specific, no exclamation marks, no "Welcome back!" greetings.
- Follow platform conventions: iOS large titles and native stack, Android Material back behavior.
- Söhne is a paid license and is not bundled: the stack is Söhne → Inter (bundled) → system-ui.
- Errors may use one danger red (`color.danger` in theme.ts), for error text only. It is not an accent.
