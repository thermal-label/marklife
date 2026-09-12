# Verification checklist — marklife

Hardware verification runs through the harness app. It pairs a
chassis, prints a diagnostic sized to the media you pick, and submits
a hardware report — no CLI transcription.

## Browser harness

Open <https://thermal-label.github.io/harness/marklife/> in a
Chromium-class browser, pick a transport, select your printer, and
follow the prompts.

- **BLE** reaches every chassis in the catalogue. The advertised name
  is the printer's Bluetooth name plus `_BLE`; if it matches nothing
  in the registry the harness asks which entry to use.
- **USB** reaches the P12 and P15.
- **Serial** reaches anything paired over Bluetooth SPP; you pick the
  entry yourself. Pairing PIN `1234` on the P12 / P15, none on the
  S2; on Linux bind the RFCOMM port first (see the
  [Node guide](./node#bluetooth-spp)).

## Fallback

Hand-rolled report? Open an issue at
<https://github.com/thermal-label/marklife/issues> with the model,
the registry key, the transport, the media loaded, and what the
printer did.

## Driver-specific notes for the verifier

- **Only three units have printed:** the P12 and P15 (USB, SPP, BLE)
  and the S2 (SPP, BLE). Everything marked `expected` is inferred
  from those and has not been driven; a failure there is the report
  we want, not a driver you are using wrong.
- **`marklife-yxq` varies per protocol id.** The S2 confirms id 2
  only. A P50 (id 3), D210 (id 5), X2 (ids 8 / 9) or S8 (id 1) print
  exercises a job shape nobody has seen work — say which chassis it
  was, and whether it fed, printed, or did nothing.
- **"Accepted the job, printed nothing"** is this family's signature
  failure, and it has five known causes: a wrong command prefix, no
  page advance, a deflate window larger than 1 KiB, packets over the
  chassis' ceiling, and unpaced writes. The driver handles all five
  on the S2; on another chassis, note whether the media moved at all.
- **Media is not detected.** Pick the roll that is actually loaded;
  the diagnostic is sized from your choice and the chassis cannot
  correct you.
- **Head width is a guess on most entries.** A diagnostic that prints
  clipped or with a blank margin on one side is telling you the
  `headDots` value — measure the printed width and report it.
- **Status pills** report link state only; "ready" means connected,
  nothing more.
