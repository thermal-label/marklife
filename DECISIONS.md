# DECISIONS — marklife

Decision log. Each entry is a "we chose X over Y because Z" record.
Update on a rolling basis as the implementation lands.

## D1 — `headDots` is best-guess per `physicalSizeClass`

**Decision.** Populate `engines[].headDots` from the physical-size
class hint per the plan (0.5″≈100, 2″≈384, 3″≈576, 4″≈832), and
mark each entry's `// TODO confirm against datasheet` until a real
print test confirms.

**Why.** The `@thermal-label/contracts` `PrintEngine.headDots` is a
required `number` field — we cannot ship `undefined`, and no
datasheet publishes the dot count. The physical-size class is
well-bounded (every chassis is 0.5/2/3/4 inch) and
gets us close enough that the encoder pads correctly to a multiple
of 8 dots. Same posture labelife took for its untested chassis.

**How to apply.** Encoders should not assume `headDots` is exact;
ESC/POS pads bitmap width to a multiple of 8 _within the bitmap_,
not to head width. YXQ tile encoding also runs off bitmap shape, not
head shape.

## D2 — `yxqZlibCompress` deflates with a 1 KiB window (`windowBits: 10`)

**Decision.** Deflate the YXQ (and CPCL) raster with
`windowBits: 10`, level 6.

**Why.** The original encoder deflated with zlib's default 32 KiB
window, and the S2 accepted a full job, buzzed, and printed nothing.
A printer of this class has every reason to run a 1 KiB inflate
window rather than 32 KiB, and the asymmetry is what makes it fatal
rather than cosmetic: a decoder with a **large** window can always
read a stream cut with a smaller one, but a decoder with a **small**
window cannot read a large-window stream. Emitting `windowBits: 10`
is therefore conservative in both directions — still standard zlib
for any decoder, and decodable by a constrained one.

It is visible on the wire: the zlib CMF byte packs windowBits into its
high nibble, so our payload now opens `0x28` where it used to open
`0x78`.

**Status. CONFIRMED** — twice, on 2026-09-11.

1. A bench probe sent a solid-black raster to the S2 with the payload
   compressed five different ways. Only `windowBits: 10` printed; the
   printer acked `0xAA`.
2. Two S2 job streams captured on the bench both carry payloads
   opening `28 91` — CMF `0x28`, windowBits 10 — and inflate to
   exactly `widthBytes × height`.

The same captures confirm `headDots: 384` for the S2 (`widthBytes` is
48) and the `1F 70 01 0A` normal-density level for the compressed ids.

Our deflate output is a few bytes longer than the captured job's for
the same input (436 vs 431) because two zlib implementations make
different entropy-coding choices. Both are valid streams that inflate
identically, so this is not a defect — byte-equality with the capture
is not the goal, decodability is.

**How to apply.** Tests assert the CMF byte, hold pako against
`node:zlib` byte for byte, and inflate through a real 1 KiB window.
The captures live outside the repo; the facts above are the citable
result of our own capture.

## D3 — the TSPL mode-3 payload is zlib, not LZO

**Decision.** Compress the `BITMAP …,3,…` payload with stock zlib
(level 6, `windowBits` 15) via `tsplZlibCompress`. `lzoCompress` is no
longer on any print path.

**Why.** The original decision assumed miniLZO because the published
TSPL spec defines mode 3 as LZO, and because a sibling driver in this
project uses miniLZO for a similar-looking field. Both were inference,
neither was evidence.

Our own analysis of the family shows this path carries a zlib
container at default settings, not LZO. A firmware inflate handed an
LZO stream rejects the first byte and drops the raster.

**Note the contrast with D2.** Two different native compressors are in
play: the YXQ raster uses a 1 KiB window (`windowBits` 10), this path
uses the zlib default of 15. They must not share a helper — one of the
two would silently get the wrong window.

**Status.** Not bench-confirmed: no chassis binds to
`marklife-tspl`. The T3 did until it turned out to speak CPCL. This
path has no hardware behind it today.

**On `lzoCompress`.** The implementation is retained and still
correct as an LZO1X-1 literal-run encoder — it is simply not what
this vendor uses. Keep it or retire it deliberately; do not wire it
back into a print path without evidence.

## D4 — JBIG encoder: WASM build of libjbigkit, deferred

**Decision.** Stub `jbigEncode` with a clearly-documented
`UnsupportedOperationError` for `marklife-jbig` in v1. Devices that
declare `protocol: 'marklife-jbig'` (D100, X4, X8, AbleMark U210,
AbleMark L100) carry `support.status: 'unsupported'` until the
encoder ships.

**Why.** The JBIG arithmetic coder is fiddly, and shipping a JS port
of an unmaintained `jbig.js` is a multi-week tar pit. A WASM build of
`libjbigkit` is the right answer but requires a separate build
pipeline (Emscripten config, output binary, fixture round-trip).
That pipeline is the work; the rest of the driver lands first.

**How to apply.** `src/jbig/encode.ts` throws
`UnsupportedOperationError`. The `protocol/jbig.md` page documents
the byte stream and the WASM-build follow-up. Devices on this
protocol stay flagged `unsupported`.

## D5 — `marklife-l11` implemented; `marklife-cpcl` implemented, unverified

**Decision.** `marklife-l11` is **implemented** (`src/l11/`) — the L11
binary protocol: 15-byte wakeup → `10 FF F1 02` enable → `1D 76 30`
uncompressed `GS v 0` raster → `1B 4A` / `1D 0C` feed → `10 FF F1 45`
stop. `marklife-cpcl` is implemented (`src/cpcl/`) from our own
analysis of the family and binds the T3; nothing on it has been
driven.

**Why.** A bench P12 surfaced the gap: it had been mis-bound to
`marklife-yxq` (protocol id 4) and never rendered a raster — it fed
blank and skipped the `1D 10`+zlib block. Public prior art (the
`tomLadder/thermoprint` project's `REVERSE_ENGINEERING.md` § 3.2,
which documents the same family) identified the P12 — along with
P15/P11/P7/LP90/LP15 — as L11-protocol chassis. The L11 encoder was
ported from that prior art and bench-confirmed (the P12 ack's `0xAA`
on success over both SPP and BLE).

**Scope.** A registry-wide reconciliation against thermoprint's
device → protocol table (its `REVERSE_ENGINEERING.md` § 5) found nine
mis-bindings. Applied:

- **P12** — original rebind, bench-confirmed (USB + SPP + BLE).
- **R15, BARABOGOP12, LP25_BY_P12, LP90** — rebound to `marklife-l11`
  (the standard-density subset of the reconciliation; thermoprint §3.1
  protocol `#11` / §5 L11 `p112Print`). All four are on the standard
  L11 density opcode (`1F 70 02 DD`) — no encoder change needed. They
  keep their existing transports (`bluetooth-spp`); L11 is the byte
  protocol, transport is independent. BARABOGOP12 and LP25_BY_P12 are
  literal P12-hardware whitelabels and take the bench-confirmed
  `headDots: 96`; R15 and LP90 keep best-guess `headDots` pending a
  capture.
- **P15** — rebound to `marklife-l11` + a `usb` transport
  (`5958:0015`, bench-confirmed Printer-class). `headDots: 96` is
  **assumed** equal to the P12 (thermoprint's `p12`/`p15` profiles
  share label-size presets) — confirm by capture/bench. The P15's
  `thickness` density variant is **not** a blocker: density is
  opt-in and the diagnostic path emits none, so the rebind is sound
  for no-density jobs.

- **P15R, LP15, A1** — rebound to `marklife-l11` after our own
  analysis; the P15-family `thickness` density variant
  (`10 FF 10 00 TT`, per thermoprint's `p15` profile) is only needed
  for explicit-density jobs and is unimplemented. Head widths are
  unconfirmed.
- **T3** — rebound to `marklife-cpcl` after the same analysis.

The 5 JBIG devices await an encoder. The P80 / P80S / 365 are not
registered; nothing has been analysed for them.

## D6 — `buildSetGap` and `buildFormFeed` hosted locally pending upstream PRs

**Decision.** Host both builders in `marklife-core` (in
`src/tspl/protocol.ts` and `src/escpos/protocol.ts` respectively),
with a header comment marking each as an upstream-gap that should
be deleted once the corresponding PRs land in `tspl-core@0.3.0` /
`escpos-core@0.3.0`.

**Why.** Both are standard spec opcodes that belong in the protocol
core packages — but neither is in the published 0.2.x lines today.
Hosting locally unblocks marklife shipping; the cleanup is mechanical
once the cores release.

**How to apply.** Delete each local builder when the upstream core
ships it and switch the import.

## D7 — Bitmap rendering delegated to `@mbtech-nl/bitmap`

**Decision.** All RGBA → 1-bpp conversion, rotation, padding,
dithering, and text rendering goes through `@mbtech-nl/bitmap`'s
`renderImage` / `renderText` / `padBitmap` / `rotateBitmap`.
Marklife-core defines no rendering primitives of its own beyond
the wire-format byte builders.

**Why.** Same posture every other thermal-label driver in the org
uses (labelife, brother-ql, labelwriter, cat-printer). The bitmap
library already implements the LabelBitmap shape (1-bpp MSB-first,
1=dark) every wire format here consumes, so the mapping is
trivial — write `LabelBitmap.data` straight into the wire payload
under all four sub-engines (TSPL, ESC/POS, JBIG, YXQ).

**How to apply.** The encoder modules accept `LabelBitmap` from
`@mbtech-nl/bitmap` and emit wire bytes; rendering is the host
app's responsibility.

## D8 — `pack-bits.ts` not duplicated

**Decision.** Skip the standalone `src/pack-bits.ts` module that
labelife has. Instead, depend on `@mbtech-nl/bitmap`'s `LabelBitmap`
output directly — its data buffer is already MSB-first 1-bpp with
`1=dark` semantics, which is what every marklife sub-engine wants
on the wire.

**Why.** labelife's `pack-bits.ts` exists because labelife predates
the current `LabelBitmap` shape; since `@mbtech-nl/bitmap@1.3.0` the
library produces the exact bytes the wire needs. Re-implementing
the same packer here would be duplicated code.

**How to apply.** Encoders read `bitmap.data` and `bitmap.widthPx /
heightPx` directly. Width-padding (ESC/POS' `width / 8` truncating
requirement) is handled by calling `padBitmap({ widthMod: 8 })` on
the bitmap before encode.

## D9 — `printableArea` / `forcedTrailingFeedMm` default-zero pending measurement

Contracts `0.6.x` ships optional `PrintEngine.printableArea` and
`PrintEngine.forcedTrailingFeedMm` fields for modelling chassis
dead-zone and post-print feed. Marklife has no measurements yet —
neither the head-to-cutter geometry nor any fixed encoder-side
trailing pad. Until a maintainer or community contributor bench-tests
dead zones for a marklife chassis, both fields stay omitted /
default-zero on every engine entry, and `getPrintableArea` is not
consumed.

## D10 — pacing and chunking live in the printer class

**Decision.** `WebMarklifePrinter` and `MarklifePrinter` split a job
into registry-sized packets and pause between them, on every
transport. The packet ceiling comes from
`transports['bluetooth-gatt'].mtu`, the pause from
`engines[].capabilities.interChunkDelayMs` (family default 30 ms).
`MarklifeBleTransport` composes the stock `WebBluetoothTransport`
and adds only the Profile A credit gate.

**Why.** The inter-packet delay is a property of the firmware's
intake rate, not of the link: the S2 loses raster to back-to-back
packets whether or not credits say it has room. Keying the pacing on
the transport meant the node path — one unpaced write over RFCOMM or
USB — sent a job shape that has never printed, while the BLE path
duplicated ~200 lines of the shared transport to host a 30 ms timer.
Every other BLE driver in the org paces in the printer.

**Open.** Whether the credit gate is load-bearing on its own has not
been tested: every successful print had both the gate and the
pacing. If pacing alone suffices, `MarklifeBleTransport` goes and the
driver uses the stock transport outright.

## D11 — one compressor implementation, backed by pako

**Decision.** `yxqZlibCompress` deflates with pako in both runtimes.
There is no `node:zlib` path and no `browser` export condition.

**Why.** Two implementations of one compressor is how the harness
lost `windowBits`: a browser shim accepted only `level`, the 1 KiB
window silently became 32 KiB, and the S2 took the job and printed
nothing. With a single implementation the Node test suite exercises
the exact code the browser runs, and the suite holds pako against
`node:zlib` byte for byte. Core has no Node builtin import left, so
a browser consumer needs no alias.
