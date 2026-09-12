---
layout: home

hero:
  name: '@thermal-label/marklife'
  text: Marklife / Deli / AbleMark label printing without the app
  tagline: The P12, P15, S2, X2, P50, D210 and their whitelabels — over USB, Bluetooth SPP and BLE, from Node.js or the browser, in TypeScript.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/thermal-label/marklife

features:
  - icon: 🟢
    title: Node.js
    details: Bluetooth SPP through the OS-paired RFCOMM port, or USB Printer-class on the P12 and P15. Any Transport from @thermal-label/transport.
    link: /node
    linkText: Node.js guide
  - icon: 🌐
    title: Browser
    details: Web Bluetooth with the family's credit-gated BLE profile, WebUSB, and Web Serial for OS-paired SPP. One requestPrinters() call, identification from the advertised name.
    link: /web
    linkText: Web guide
  - icon: 📡
    title: Six wire protocols
    details: L11 and the YXQ command stream are bench-confirmed; CPCL, the JBIG wrapper, TSPL and ESC/POS are documented from analysis and say so. Every page states what a real unit has confirmed.
    link: /protocol/
    linkText: Protocol reference
  - icon: 🖨️
    title: Hardware harness
    details: Pair a chassis in the browser, fire a diagnostic print, and submit a verification report — straight from the harness app.
    link: https://thermal-label.github.io/harness/marklife/
    linkText: Open the harness
---

<div class="home-extra">

<div class="ref-links">
  <a href="./hardware.html" class="ref-link">
    <span class="ref-icon">🖨️</span>
    <span class="ref-body">
      <strong>Supported hardware</strong>
      <span>28 chassis, BLE profiles, packet pacing, whitelabel map</span>
    </span>
    <span class="ref-arrow">→</span>
  </a>
  <a href="./protocol/" class="ref-link">
    <span class="ref-icon">📡</span>
    <span class="ref-body">
      <strong>Protocol reference</strong>
      <span>L11, YXQ, CPCL, JBIG, TSPL, ESC/POS — opcodes, job streams, what is confirmed</span>
    </span>
    <span class="ref-arrow">→</span>
  </a>
</div>

::: warning Verified on three units
The P12, P15 and S2 print. The other 25 registry entries are inferred
from those three and from our own analysis of the family; the
[hardware page](./hardware) says which is which. A print that fails
on an `expected` chassis is a report worth filing, not a surprise.
:::

<div class="ecosystem">
  <p class="ecosystem-label">Also in this ecosystem</p>
  <div class="ecosystem-links">
    <a href="https://thermal-label.github.io/brother-ql/" class="ecosystem-link" target="_blank" rel="noopener">
      <span class="eco-name">brother-ql</span>
      <span class="eco-desc">Brother QL / PT series</span>
    </a>
    <a href="https://thermal-label.github.io/labelwriter/" class="ecosystem-link" target="_blank" rel="noopener">
      <span class="eco-name">labelwriter</span>
      <span class="eco-desc">DYMO LabelWriter series</span>
    </a>
    <a href="https://thermal-label.github.io/labelmanager/" class="ecosystem-link" target="_blank" rel="noopener">
      <span class="eco-name">labelmanager</span>
      <span class="eco-desc">DYMO LabelManager PnP</span>
    </a>
  </div>
</div>

</div>
