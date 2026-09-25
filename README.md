# Up

A local TypeScript/Vite reconstruction of [Don't Look Up](https://www.dontlookup.app/).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` performs a TypeScript check and production build. The site is not deployed.

The original public assets are in `public/assets/`. The recovered production HTML/JavaScript and extracted CSS are retained in `reference/` for inspection only; the application runs from modular TypeScript in `src/`. See [the reverse engineering inventory](docs/REVERSE_ENGINEERING.md) for exact reference data, verification, and known gaps.
