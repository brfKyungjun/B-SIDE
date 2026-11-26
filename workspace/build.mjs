// src/ 를 번들해서 JS와 CSS를 모두 인라인한 dist/index.html 한 장을 만든다 (Netlify Drop에 그대로 올리는 파일).
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";

const bundle = async entry =>
  (await build({ entryPoints: [entry], bundle: true, minify: true, write: false })).outputFiles[0].text.trim();

const [js, css] = await Promise.all([bundle("src/App.jsx"), bundle("src/styles.css")]);

await mkdir("dist", { recursive: true });
await writeFile("dist/index.html",
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b1b33"><title>BRFrame Workspace · 사내 그룹웨어</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`);
console.log("dist/index.html");
