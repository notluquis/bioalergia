# PWA Icons

Generate the required PWA icons using one of the following methods:

## Option 1: Online Generator (Recommended)

Use https://realfavicongenerator.net with the logo file

## Option 2: Manual Generation

Use your design tool to export the logo at these sizes:

- 72x72 px (icon-72.png)
- 96x96 px (icon-96.png)
- 128x128 px (icon-128.png)
- 144x144 px (icon-144.png)
- 152x152 px (icon-152.png)
- 192x192 px (icon-192.png) - _Required for manifest_
- 384x384 px (icon-384.png)
- 512x512 px (icon-512.png) - _Required for manifest_

## Option 3: Use Sharp (Node.js)

```bash
npm install -D sharp
node scripts/generate-icons.mjs
```

Save all icons in this directory (`public/icons/`)

Current icons needed:

- [ ] icon-72.png
- [ ] icon-96.png
- [ ] icon-128.png
- [ ] icon-144.png
- [ ] icon-152.png
- [ ] icon-192.png ⚠️ Required
- [ ] icon-384.png
- [ ] icon-512.png ⚠️ Required
