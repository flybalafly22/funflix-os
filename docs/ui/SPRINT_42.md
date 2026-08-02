# UI Sprint 42 — Chrome & nav (flagship prominence, site-wide)

**Shipped**
- **Flagship marker, site-wide.** `os.js` MODULES flags The Trainer (`flag:true`);
  both the desktop HUD nav and the mobile menu render its name in bolded ink with a
  small accent-green "live" dot (`.nav-flag` in `os.css`). Every sub-page's chrome
  now signals the flagship at a glance.
- **Homepage nav link.** Added "The Trainer" (emphasised, with the dot) after
  "Apps", smooth-scrolling to the `#flagship` band. Placed after Apps so the mobile
  nav keeps its short first-child and no horizontal overflow.

**Bug caught + fixed.** First attempt made "The Trainer" the first nav child, which
on 390px pushed the row to 404px (overflow). Reordered after "Apps" → back to
scrollW 391 = clientW 390.

**Gates.** site_qa 32/32 (console-clean, no h-overflow at 1280 & 390 after the fix);
HUD flag dot verified present; nav screenshots reviewed (premium, subtle). pytest 142.

**Next:** S43 — bring the sub-pages (Compute / Synthesis / Press / meme) to the
shared premium bar.
