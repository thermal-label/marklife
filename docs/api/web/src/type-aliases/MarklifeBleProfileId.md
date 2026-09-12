[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [web/src](../README.md) / MarklifeBleProfileId

# Type Alias: MarklifeBleProfileId

> **MarklifeBleProfileId** = `"A"` \| `"B"` \| `"C"` \| `"D"`

BLE GATT profile resolution for the marklife family.

Three facts make this necessary, all established by our own
on-the-wire analysis (BlueZ LE scan + GATT probe, 2026-09-10):

 1. **The chassis do not advertise the service they host.** A scan
    of the P12, P15 and S2 shows a vendor UUID
    (`e7810a71-73ae-499d-8c15-faa9aef0c3f2`) in the advertisement,
    never `ff00`. A Web Bluetooth filter of
    `{ services: ['0000ff00-…'] }` therefore matches nothing — the
    picker has to filter on the device name and every candidate
    service must be listed in `optionalServices` so the page is
    allowed to reach it after connecting.

 2. **A chassis hosts several profiles at once.** A GATT probe of
    the P12 (2026-09-10) returned five services: Profile A
    (`ff00`), the Microchip transparent UART, the generic printer
    service (`18f0`), the advertised vendor service, and Generic
    Attribute. So the profile cannot be declared per model — it is
    resolved by probing, and the order below is the preference
    order, not a guess about which one exists.

 3. **BLE names carry a `_BLE` suffix.** `P12_ZA15B` over Classic
    SPP advertises as `P12_ZA15B_BLE`, so a registry `namePrefix`
    matches both transports unchanged.

`PROFILES` is ordered: probe stops at the first service whose TX
and RX characteristics both resolve.
