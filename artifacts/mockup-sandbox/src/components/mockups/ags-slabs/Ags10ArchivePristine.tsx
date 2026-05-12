import { SlabBase } from "./_SlabBase";

export function Ags10ArchivePristine() {
  return <SlabBase tier={{
    id: "AGS_10", numeric: "10", label: "ARCHIVE PRISTINE", className: "tier-ags-10",
    serial: "AGS-004921", service: "PRESTIGE ARCHIVE", turnaround: "30 MIN", date: "MAY 20, 2025",
    subgrades: { centering: 10, surface: 10, edges: 10, corners: 10, print: 10 }
  }} />;
}
