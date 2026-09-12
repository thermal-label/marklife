/**
 * BLE GATT profile resolution for the marklife family.
 *
 * Three facts make this necessary, all established by our own
 * on-the-wire analysis (BlueZ LE scan + GATT probe, 2026-09-10):
 *
 *  1. **The chassis do not advertise the service they host.** A scan
 *     of the P12, P15 and S2 shows a vendor UUID
 *     (`e7810a71-73ae-499d-8c15-faa9aef0c3f2`) in the advertisement,
 *     never `ff00`. A Web Bluetooth filter of
 *     `{ services: ['0000ff00-…'] }` therefore matches nothing — the
 *     picker has to filter on the device name and every candidate
 *     service must be listed in `optionalServices` so the page is
 *     allowed to reach it after connecting.
 *
 *  2. **A chassis hosts several profiles at once.** A GATT probe of
 *     the P12 (2026-09-10) returned five services: Profile A
 *     (`ff00`), the Microchip transparent UART, the generic printer
 *     service (`18f0`), the advertised vendor service, and Generic
 *     Attribute. So the profile cannot be declared per model — it is
 *     resolved by probing, and the order below is the preference
 *     order, not a guess about which one exists.
 *
 *  3. **BLE names carry a `_BLE` suffix.** `P12_ZA15B` over Classic
 *     SPP advertises as `P12_ZA15B_BLE`, so a registry `namePrefix`
 *     matches both transports unchanged.
 *
 * `PROFILES` is ordered: probe stops at the first service whose TX
 * and RX characteristics both resolve.
 */

export type ProfileId = 'A' | 'B' | 'C' | 'D';

/** One candidate GATT layout. */
export interface MarklifeBleProfile {
  /** Short tag recorded on the transport for triage. */
  id: ProfileId;
  serviceUuid: string;
  txCharacteristicUuid: string;
  rxCharacteristicUuid: string;
  /**
   * Optional flow-control characteristic. Profile A gates writes on
   * a credit counter published here; the other profiles are
   * unthrottled. See `MarklifeBleTransport`.
   */
  cxCharacteristicUuid?: string;
}

export const PROFILES: readonly MarklifeBleProfile[] = [
  {
    id: 'A',
    serviceUuid: '0000ff00-0000-1000-8000-00805f9b34fb',
    txCharacteristicUuid: '0000ff02-0000-1000-8000-00805f9b34fb',
    rxCharacteristicUuid: '0000ff01-0000-1000-8000-00805f9b34fb',
    cxCharacteristicUuid: '0000ff03-0000-1000-8000-00805f9b34fb',
  },
  {
    // Microchip transparent UART — a stock BLE-serial profile, not
    // marklife-specific.
    //
    // The service also carries Microchip's control-point
    // characteristic `49535343-aca3-481c-91ec-d85e28a60318`
    // (write+notify), confirmed present on the P12. It is
    // deliberately NOT wired as `cx`: no flow control has been
    // observed on this profile, and treating the control point as a
    // credit channel would park every write on a grant that never
    // arrives.
    id: 'B',
    serviceUuid: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    txCharacteristicUuid: '49535343-8841-43f4-a8d4-ecbe34729bb3',
    rxCharacteristicUuid: '49535343-1e4d-4bd9-ba61-23c647249616',
  },
  {
    id: 'C',
    serviceUuid: '0000fd00-0000-1000-8000-00805f9b34fb',
    txCharacteristicUuid: '0000fd01-0000-1000-8000-00805f9b34fb',
    rxCharacteristicUuid: '0000fd02-0000-1000-8000-00805f9b34fb',
  },
  {
    // Generic thermal-printer BLE service, common across low-cost
    // chassis. Confirmed present on the P12's GATT table and
    // advertised by the S2, so it is a real fallback for a chassis
    // that hosts neither A nor B.
    id: 'D',
    serviceUuid: '000018f0-0000-1000-8000-00805f9b34fb',
    txCharacteristicUuid: '00002af1-0000-1000-8000-00805f9b34fb',
    rxCharacteristicUuid: '00002af0-0000-1000-8000-00805f9b34fb',
  },
];

/**
 * Every service a marklife chassis might host or advertise. Web
 * Bluetooth blocks access to any service absent from
 * `optionalServices`, and the advertised vendor UUID has to be here
 * too so a service-based filter can fall back to it.
 */
export const OPTIONAL_SERVICES: readonly string[] = [
  ...PROFILES.map(p => p.serviceUuid),
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

export interface ResolvedProfile {
  profile: MarklifeBleProfile;
  tx: BluetoothRemoteGATTCharacteristic;
  rx: BluetoothRemoteGATTCharacteristic;
  cx?: BluetoothRemoteGATTCharacteristic;
}

/**
 * Probe a connected GATT server for the first profile it satisfies.
 *
 * A profile counts as satisfied only when TX and RX both resolve —
 * a chassis can expose a service shell with no usable characteristics.
 *
 * @throws when no candidate profile resolves, naming what was tried
 *   so a triage report says something actionable.
 */
export async function resolveProfile(server: BluetoothRemoteGATTServer): Promise<ResolvedProfile> {
  const tried: string[] = [];
  for (const profile of PROFILES) {
    try {
      const service = await server.getPrimaryService(profile.serviceUuid);
      const tx = await service.getCharacteristic(profile.txCharacteristicUuid);
      const rx = await service.getCharacteristic(profile.rxCharacteristicUuid);
      let cx: BluetoothRemoteGATTCharacteristic | undefined;
      if (profile.cxCharacteristicUuid !== undefined) {
        try {
          cx = await service.getCharacteristic(profile.cxCharacteristicUuid);
        } catch {
          // Flow control is optional even on Profile A — a chassis
          // without it is treated as always-credited.
          cx = undefined;
        }
      }
      return cx === undefined ? { profile, tx, rx } : { profile, tx, rx, cx };
    } catch (err) {
      tried.push(`${profile.id} (${profile.serviceUuid}): ${(err as Error).name}`);
    }
  }
  throw new Error(
    `No marklife BLE profile resolved on this device. Tried — ${tried.join('; ')}. ` +
      `Run the GATT probe and file the service table so the profile can be added.`,
  );
}
