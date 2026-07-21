/** The required overpass-vs-acquisition disclaimer (mirrors the backend text). */
export default function Disclaimer() {
  return (
    <div
      className="border p-3 text-xs"
      style={{ borderColor: 'var(--accent-line)', background: 'var(--accent-soft)' }}
      role="note"
    >
      <strong style={{ color: 'var(--accent)' }}>Disclaimer&nbsp;·&nbsp;</strong>
      An orbital pass does not mean that the satellite acquired or can acquire imagery of the AOI.
      Actual SAR imaging depends on spacecraft attitude, look direction, incidence-angle limits,
      acquisition mode, operator scheduling, tasking constraints and data availability.
    </div>
  );
}
