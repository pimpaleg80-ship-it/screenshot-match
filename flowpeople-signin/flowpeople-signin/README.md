# Flowpeople sign-in page (React + TypeScript + Tailwind)

## Folder

```
flowpeople-signin/
├── tailwind.config.ts          colours, font, gradient (merge into your config)
└── src/
    ├── index.css               Inter font + Tailwind layers
    ├── assets/
    │   └── logo.png            your Flowpeople logo
    ├── pages/
    │   └── SignInPage.tsx      puts everything together, add your login code here
    └── components/
        ├── index.ts
        ├── BrandLogo.tsx       logo + "Flowpeople BY FLUXORA" (light or dark)
        ├── WavesBackground.tsx soft waves on the left panel
        ├── HeroPanel.tsx       left panel
        ├── SignInPanel.tsx     right panel, form centered, footer at bottom
        ├── SignInForm.tsx      email, password, button, loading and error
        ├── UnderlineField.tsx  minimal input with underline
        ├── PasswordField.tsx   password input with show / hide
        ├── FooterLinks.tsx     Privacy, Terms, contact
        └── icons.tsx           eye icons
```

## How to use

1. Copy `src/components`, `src/pages/SignInPage.tsx` and `src/assets/logo.png` into your project.
2. Merge the `extend` block from `tailwind.config.ts` into your own Tailwind config.
3. Make sure `src/index.css` (or your main CSS file) has the Inter font import and the Tailwind layers.
4. Add the page to your router, for example:

```tsx
import SignInPage from "./pages/SignInPage";

<Route path="/login" element={<SignInPage />} />
```

5. Open `SignInPage.tsx` and put your real login code inside `handleSignIn`
   (a Supabase example is in the comment). If it throws an `Error`, the message
   shows under the form.

## Notes

- Tailwind v3 syntax. If you use Tailwind v4, move the colours, font and gradient from
  `tailwind.config.ts` into an `@theme` block in your CSS.
- The left panel hides below the `lg` breakpoint (1024px). On small screens the logo
  shows above the form.
- The `import logo from "../assets/logo.png"` line works with Vite and Next.js. With
  plain TypeScript, add `declare module "*.png";` to a `.d.ts` file.
- Your project may already use the class names `ink`, `muted`, `line` or `brand`. If so,
  rename them in the config and in the components.
