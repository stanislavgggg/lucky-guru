# Lucky Guru GTA 6 landing (LT)

Static Meta landing for the Lucky Guru Telegram channel, GTA 6 bonus campaign. Zero-dependency Node server.

## Before deploying
Put the portrait hero video at `public/assets/video/hero.mp4` (the `lucky-guru-hero-portrait.mp4` from the Lovable project).
Keep it under ~3 MB, H.264, no audio track. Without it, the hero shows the Lucky Guru logo instead.

## Deploy on Railway
1. Push this folder to a GitHub repo, then Railway: New Project, Deploy from GitHub repo.
2. Variables:
   - `TG_LINK` = Telegram invite or tracker link (required)
   - `GTM_ID` = optional, e.g. `GTM-PVHMWFVM` (the container the Lovable page uses)
   - `META_PIXEL_ID` = optional, digits only
3. Settings, Networking: Generate Domain or add a custom domain.
4. Check `https://<domain>/healthz` returns `ok`.

## Events
- Button clicks: Meta `Lead` (content_category = hero / sticky / final) and dataLayer `tg_subscribe_click` with `cta_position`.
- Copy code button: Meta custom `CopyCode` and dataLayer `copy_code`.

## Local
`TG_LINK=https://t.me/test node server.js` then open http://localhost:3000
