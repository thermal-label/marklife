# PROGRESS — marklife

Step-by-step implementation log. Each step gates on `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
green; only Step 9 enforces the 90% coverage floor.

## Step 1 — Scaffold

- [x] Root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- [x] `eslint.config.js`, `.prettierignore`, `.gitignore`
- [x] `.changeset/config.json`
- [x] `.github/FUNDING.yml`, `workflows/{ci,release,docs}.yml`,
      `ISSUE_TEMPLATE/hardware_verification.md`
- [x] `.githooks/pre-push`
- [x] `scripts/build-hardware-table.mjs`
- [x] `LICENSE`, `README.md`, `HARDWARE.md`, `INTEROPERABILITY.md`,
      `PROGRESS.md`, `DECISIONS.md`
- [x] `git init` + initial commit
- [x] `pnpm install` clean

## Step 2 — core: data + primitives

- [x] `packages/core/package.json` + `tsconfig.json` + vitest config
- [x] `data/devices/<KEY>.json5` — 6 representative entries:
      S8 (yxq id 1), D210 (yxq id 5), X2_BLE (yxq id 8 BLE-C), D100
      (jbig id 12 — broken), P15 (tspl), LP15 (escpos)
- [x] `data/media.json5` — 6 entries across 4 head-size classes
- [x] `scripts/compile-data.mjs` with marklife-specific validators
      (no USB/MDL handling; protocols / compression / BLE-profile-vs-
      service-UUID consistency)
- [x] `src/types.ts` (MarklifeProtocol enum, capabilities, MarklifeStatus)
- [x] `src/orientation.ts` (ROTATE_DIRECTION = 90)
- [x] `src/lzo.ts` (single-literal-run LZO1X-1 encoder + decoder, vendored
      from labelife pattern)
- [x] `src/zlib.ts` (yxqZlibCompress — see DECISIONS.md § D2)
- [x] `src/jbig.ts` (stubbed — throws UnsupportedOperationError per § D4)
- [x] `src/status.ts` (parseYxqStatus best-effort decoder)
- [x] `src/preview.ts` (createPreviewOffline)
- [x] `src/encode.ts` (encodeJobForEngine dispatcher placeholder; throws
      until sub-engines come online in steps 3–5)
- [x] `src/devices.ts` (registry + findDevice + findDeviceByName with
      longest-prefix-first dispatch)
- [x] `src/media.ts` (registry + findMediaByDimensions)
- [x] `src/index.ts` (full public API surface)
- [x] Skipped `pack-bits.ts` per DECISIONS.md § D8 — bitmap library
      already produces wire-ready 1-bpp MSB-first bytes
- [x] Vitest: 47 tests across 9 suites — all passing
- [x] Gate green: typecheck + lint + test + build

## Step 3 — core: marklife-yxq

- [x] `src/yxq/{protocol,encode,index}.ts`
- [x] Per-protocol-id dispatch covering ids 1, 2, 3, 4, 5, 8, 9, 11.
      `protocol.ts` implements the wakeup / enable / stop /
      density / density-gear / paper-type / print-line-dots / raster-
      header builders.
- [x] `encode.ts` composes the standard 5-stage job: prelude (id 5
      paper-type + density-gear), density, wakeup, enable, raster
      (`0x1D 0x10 …` + zlib payload), trailing ESC J (ids 1/4/5/11),
      stop. Bitmap polarity is `1=dark`; the
      `LabelBitmap.data` is wire-format-ready (D8) so we hand it
      directly to `yxqZlibCompress`.
- [x] Tests:
      - 22 unit tests on protocol.ts byte builders
      - 21 integration tests on encode.ts covering S8/D210/X2_BLE
      - density override (densityLevel + 'light'/'normal'/'dark')
      - decompressed-payload-equals-bitmap round-trip
- [x] Added 12 more YXQ-stream chassis: P12, P50, S2, X2, R15, plus
      AbleMark whitelabel rebrands M50_BY_S2, M57_BY_P50, M60_BY_X2,
      and other rebrands (T2, JAMMUK_S2, LP25_BY_P12, BARABOGOP12,
      ETZ0535, LPW40). 18 device entries total.
- [x] Gate green: 93 tests passing.

**Open recon:**
- Fine-grained positioning commands on the D210 are not emitted;
  precise label-edge alignment may drift on long jobs. Verify on
  hardware.
- `densityLevel` is forwarded to the firmware as sent (clamped only
  on ids with a known window); see the per-id scales in
  `docs/protocol/yxq.md`.

## Step 4 — core: marklife-jbig

- [x] `src/jbig/{protocol,encode,index}.ts`. The wrapper byte
      builders (`GS ( s`, `GS L`, `GS W`, `ESC a`, `FF`, `GS FF`,
      `GS ( J`, `0x12 0x23 d` density) are implemented and unit-
      tested against Epson spec values + the per-vendor extension
      patterns from the D100 chassis.
- [x] `encodeJbigJob` composes the full job structure (density →
      margin/width/justify prelude → `GS ( J` raster wrapper →
      page-mode-select speed) but throws `UnsupportedOperationError`
      from the `jbigEncode` step pending the WASM build of
      libjbigkit (DECISIONS.md § D4).
- [x] Added 5 JBIG-bound chassis: D100 (id 12), X4 (id 7), X8 (id 10),
      AbleMark U210_BY_D210 (id 10), AbleMark L100_BY_X4 (id 7). All
      carry `support.status: 'broken'` with a quirks note pointing
      at D4. 23 device entries total.
- [x] Tests: 10 protocol unit tests, 5 encode tests; 108 tests
      total. All passing.
- [x] Gate green: typecheck + lint + test + build.

**Open recon (D4 follow-up):**
- WASM build of `libjbigkit` is the recommended payload encoder.
  Once it lands, replace the `jbigEncode` stub and lift D100/X4/X8/
  U210/L100 from `'broken'` to `'untested'`.
- The JBIG path renders at threshold 135; confirm on hardware.

## Step 5 — core: marklife-tspl + marklife-escpos

- [x] `src/tspl/protocol.ts` — local-only `buildSetGap` /
      `buildSetGapAuto` / `buildSetGapDistances` (D6 upstream gap).
- [x] `src/tspl/encode.ts` — encodeMarklifeTsplJob composes
      CLS → SIZE → (GAP+SET GAP for die-cut) → DENSITY → SPEED →
      BITMAP …,3,<lzoLen>,<lzo bytes>\r\n → PRINT 1,<copies>. The
      mode-3 LZO bytes come from `lzoCompress`. Re-exports the
      spec-aligned tspl-core builders for one-stop import.
- [x] `src/escpos/protocol.ts` — local-only `buildFormFeed`
      (D6 upstream gap) + vendor `buildPrinterWake` (six NULs).
- [x] `src/escpos/encode.ts` — encodeMarklifeEscposJob composes
      ESC @ → printerWake → GS L 0 → GS W head-dots →
      ESC 3 0 → ESC N 7 d → GS v 0 widthBytes heightDots →
      raster → FF → ESC d 4. Re-exports escpos-core builders.
      The wire format uses `widthBytes = floor(widthPx / 8)` —
      caller pads to multiple of 8 first.
- [x] Tests: 15 TSPL + 12 ESC/POS encoder tests; 134 tests total.
- [x] Added 5 more chassis: P15R, A1, T3, LP90 (escpos),
      plus the existing P15 and LP15. 28 device entries total.
- [x] Gate green: typecheck + lint + test + build.

**Open recon:**
- These entries were best-guesses based on naming hints; the later
  rebinding (Step 10) moved all of them to L11 or CPCL.
- D6 upstream PRs: contribute `buildSetGap` to tspl-core@0.3.0 and
  `buildFormFeed` to escpos-core@0.3.0; delete the local stubs once
  they ship.

## Step 6 — web

- [x] `WebMarklifePrinter` — implements PrinterAdapter; renderImage
      via @mbtech-nl/bitmap; encodes via encodeJobForEngine; writes
      to caller-supplied Transport.
- [x] `requestPrinterBluetooth(modelKey)` — builds a Web Bluetooth
      transport from the registry's per-device GATT config (Profile
      A / B / C dispatched via serviceUuid).
- [x] `requestPrinterSerial({ deviceKey, baudRate? })` — Web Serial
      generic picker; deviceKey binds the protocol.
- [x] `fromSerialPort(port, modelKey, baudRate?)` — convenience for
      pre-picked Web Serial ports.
- [x] `MARKLIFE_BLE_SERVICE_UUIDS` — deduplicated Set for hosts that
      want to call `navigator.bluetooth.requestDevice` directly.
- [x] jsdom + fake-Transport tests (13 tests): factories
      error-path coverage; WebMarklifePrinter happy-path for yxq /
      tspl / escpos paths; cross-runtime byte-parity for yxq.
- [x] Gate green: 147 tests across packages.

## Step 7 — node

- [x] `MarklifePrinter` mirrors `LabelifePrinter` — accepts a Transport
      from `@thermal-label/transport/node`, encodes via
      `encodeJobForEngine`, writes to the transport.
- [x] `MarklifeDiscovery`:
      - `listPrinters()` returns `[]` (no auto-enumeration in v1).
      - `openPrinter(...)` honours `serialPath`, throws on `host`
        (no TCP) or `vid+pid` (no USB).
      - `openBluetoothSpp({ serialPath, deviceKey, baudRate? })` —
        opens an OS-paired RFCOMM port via `SerialTransport.open`.
      - `openBluetoothGatt(...)` always throws (Node BLE deferred).
      - `discovery` singleton for the cli allowlist.
- [x] Mocked tests (14 across 2 files): printer happy-path for
      yxq/tspl, deferred-encoder rejection for D100, discovery
      error paths.
- [x] Gate green: 161 tests across all 3 packages.

## Step 8 — Docs site

- [x] `docs/.vitepress/config.ts` — VitePress wiring with sidebar
      for guide / hardware / protocol / API; `markdown.html=false`.
- [x] `docs/index.md` — VitePress home (hero + 3 features).
- [x] `docs/getting-started.md` — install + browser/Node hello-label
      examples + media catalogue + scope notes.
- [x] `docs/node.md` — discovery API, OS pairing instructions,
      BLE-deferred caveat, MarklifePrintOptions table.
- [x] `docs/web.md` — Web Bluetooth + Web Serial factories, BLE
      profile dispatch table, browser support matrix.
- [x] `docs/hardware.md` — family overview, transport reachability,
      BLE profiles, verification policy.
- [x] Per-family table + whitelabel graph (since folded into
      `docs/hardware.md`).
- [x] `docs/protocol/{yxq,jbig,tspl,escpos}.md` — pre-existing from
      planning phase; left as-is.
- [x] Typedoc API generated at `docs/api/{core,node,web}/src/`.
- [x] Gate: `pnpm docs:build` green.

## Step 9 — Final

- [x] `pnpm test:coverage` — coverage thresholds enforced per
      package:
      - core: 90 / 90 / 90 / 85 (achieved 91.59 / 91.59 / 93.87 /
        90.79). JBIG encoder body excluded (deferred per D4).
      - node: 85 / 85 / 85 / 70 (achieved 87.74 / 87.74 / 94.11 /
        71.42).
      - web: 70 / 70 / 70 / 70 (achieved 77.24 / 77.24 / 73.33 /
        72.22). Web Bluetooth + Web Serial happy paths require a
        real browser — flagged for a future Playwright pass.
- [x] `scripts/build-hardware-table.mjs` regenerated README.md and
      docs/hardware.md tables: 28 devices · 0 verified · 0 partial
      · 5 broken (JBIG-deferred chassis) · 23 untested.
- [x] All packages green on `pnpm typecheck && pnpm lint && pnpm
      test && pnpm build && pnpm test:coverage && pnpm docs:build`.
- [x] **173 tests** across 3 packages.

## Open recon items still pending (carried from plan § 11)

1. ~~`yxqZlibCompress` window~~ — confirmed on the S2 (DECISIONS.md § D2).
2. ~~`lzoCompress`~~ — off every print path (DECISIONS.md § D3).
3. **JBIG WASM build of libjbigkit** — D100 / X4 / X8 / U210 /
   L100 unblock (DECISIONS.md § D4).
4. **Per-model head dot count** — populate from datasheets;
   replace each `// TODO confirm against datasheet` line.
5. ~~`marklife-cpcl` and `marklife-l11`~~ — both implemented; L11
   bench-confirmed, CPCL not (DECISIONS.md § D5).
6. **AbleMark `S15` / `M1`, `S12` / `P15R`** — wire-capture to
   confirm the protocol routing.
7. **Upstream PRs** for `tspl-core@0.3.0` (`buildSetGap`) and
   `escpos-core@0.3.0` (`buildFormFeed`) — delete the local stubs
   once they ship (DECISIONS.md § D6).
8. **LuckP_D1** — not registered; capture before adding.

## Step 10 — pre-publish review (2026-09-12)

- [x] Registry pins for contracts / transport; lockfile regenerated;
      compiled data shipped from core; vitest aliases; `docs.yml`
      removed.
- [x] `MediaNotSpecifiedError`, `pickRotation` override,
      `WriteSerializer`, `pollingOnStatus`; broken BLE factory
      deleted.
- [x] Pacing and chunking moved into both printer classes
      (DECISIONS.md § D10); `MarklifeBleTransport` reduced to a
      credit-gate wrapper over the stock transport.
- [x] Bench verifications filed for P12, P15, S2; hardware-table
      generator ported to the registry-backed version.
- [x] Docs rewritten from the encoders: six protocol pages, hardware,
      guides, core API, verification checklist.
- [x] Re-bench P12, P15, S2 through the harness after the pacing move
      — every declared transport prints (BLE, SPP; USB on P12 / P15).
- [ ] Credit-gate experiment: does 30 ms pacing print without the
      credit gate, and do credits print without pacing?
- [ ] First print through `marklife-node` (`SerialTransport` /
      `UsbTransport`).

## Step 11 — 0.1.0 published (2026-09-13)

- [x] Repository public; CI on Node 20 / 22 / 24 with Codecov.
- [x] `0.0.1` published by hand to create the packages; `0.1.0`
      released from the `v0.1.0` tag through npm trusted publishing
      with provenance.
- [x] `harness-marklife-v0.1.0` released; docs live at
      <https://thermal-label.github.io/marklife/>.
