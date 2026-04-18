import * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

interface Provider {
  id: string;
  name: string;
  npi: string;
  status: string;
  daysOpen: number;
}

const ROWS: Provider[] = [
  { id: "1", name: "Alice Chen, MD", npi: "1234567890", status: "Approved", daysOpen: 4 },
  { id: "2", name: "Bob Patel, DO", npi: "2345678901", status: "In review", daysOpen: 12 },
  { id: "3", name: "Carol Lee, MD", npi: "3456789012", status: "Docs pending", daysOpen: 27 },
  { id: "4", name: "Dave Kim, NP", npi: "4567890123", status: "Approved", daysOpen: 2 },
  { id: "5", name: "Eve Johnson, PA", npi: "5678901234", status: "In review", daysOpen: 18 },
];

const COLS: DataTableColumn<Provider>[] = [
  { id: "name", header: "Name", cell: (r) => r.name, sortAccessor: (r) => r.name, filterValue: (r) => r.name },
  { id: "npi", header: "NPI", cell: (r) => r.npi, filterValue: (r) => r.npi },
  { id: "status", header: "Status", cell: (r) => r.status, sortAccessor: (r) => r.status, filterValue: (r) => r.status },
  { id: "daysOpen", header: "Days open", align: "right", cell: (r) => r.daysOpen, sortAccessor: (r) => r.daysOpen },
];

export default { title: "Primitives/DataTable" };

export const Basic = () => <DataTable columns={COLS} rows={ROWS} rowKey={(r) => r.id} />;

export const Empty = () => (
  <DataTable columns={COLS} rows={[]} rowKey={(r) => r.id} emptyState="No providers yet." />
);

export const Loading = () => <DataTable columns={COLS} rows={[]} rowKey={(r) => r.id} loading />;

export const Sortable = () => <DataTable columns={COLS} rows={ROWS} rowKey={(r) => r.id} sortable />;

export const Paginated = () => (
  <DataTable columns={COLS} rows={ROWS} rowKey={(r) => r.id} pageSize={2} sortable />
);

export const Filtered = () => (
  <DataTable columns={COLS} rows={ROWS} rowKey={(r) => r.id} globalFilter="approved" />
);
