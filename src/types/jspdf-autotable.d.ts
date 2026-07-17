// jspdf-autotable v5 sets `doc.lastAutoTable` at runtime (the plugin assigns the
// finished Table to it) but, unlike earlier majors, its index.d.ts no longer augments
// the jsPDF interface with that property. This restores exactly the one field the CRM
// reads — `lastAutoTable.finalY` — matching the plugin's real runtime contract. It is
// only reachable after an autoTable() call has run (which the callers guarantee before
// reading finalY), so it is declared non-optional to avoid an unfounded null guard.
import "jspdf";

declare module "jspdf" {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}
