// @vitest-environment jsdom
/**
 * Tests for src/components/ui/data-table.tsx (TanStack-backed v2).
 *
 * Coverage:
 *   - Renders rows with the provided columns and rowKey.
 *   - Empty state is shown when there are zero rows.
 *   - Loading state is shown while loading.
 *   - onRowClick fires with the original row.
 *   - sortable: clicking a sortable header toggles asc → desc → asc.
 *   - globalFilter: substring narrows visible rows.
 *   - pageSize: pagination footer + Next button advance the page.
 */
import { describe, it, expect } from "vitest";
import * as React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

interface Row {
  id: string;
  name: string;
  age: number;
}

const ROWS: Row[] = [
  { id: "1", name: "Alice", age: 30 },
  { id: "2", name: "Bob", age: 25 },
  { id: "3", name: "Carol", age: 41 },
  { id: "4", name: "Dave", age: 19 },
  { id: "5", name: "Eve", age: 35 },
];

const COLS: DataTableColumn<Row>[] = [
  {
    id: "name",
    header: "Name",
    cell: (r) => r.name,
    sortAccessor: (r) => r.name,
    filterValue: (r) => r.name,
  },
  {
    id: "age",
    header: "Age",
    align: "right",
    cell: (r) => r.age,
    sortAccessor: (r) => r.age,
    filterValue: (r) => String(r.age),
  },
];

function getDataRowNames(): string[] {
  const tbody = document.querySelector("tbody")!;
  const trs = within(tbody).queryAllByRole("row");
  return trs.map((tr) => tr.querySelector("td")?.textContent?.trim() ?? "");
}

describe("DataTable v2", () => {
  it("renders rows with the provided columns", () => {
    render(<DataTable columns={COLS} rows={ROWS} rowKey={(r) => r.id} />);
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Carol")).toBeTruthy();
    expect(getDataRowNames()).toEqual(["Alice", "Bob", "Carol", "Dave", "Eve"]);
  });

  it("shows an empty state when rows are empty", () => {
    render(<DataTable columns={COLS} rows={[]} rowKey={(r) => r.id} emptyState="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeTruthy();
  });

  it("shows a loading state while loading=true", () => {
    render(<DataTable columns={COLS} rows={[]} rowKey={(r) => r.id} loading />);
    expect(screen.getByText(/Loading/)).toBeTruthy();
  });

  it("invokes onRowClick with the original row", () => {
    const calls: Row[] = [];
    render(
      <DataTable
        columns={COLS}
        rows={ROWS}
        rowKey={(r) => r.id}
        onRowClick={(r) => calls.push(r)}
      />,
    );
    fireEvent.click(screen.getByText("Carol"));
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe("3");
  });

  it("sortable: clicking a header sorts asc and desc (number columns desc-first)", () => {
    render(<DataTable columns={COLS} rows={ROWS} rowKey={(r) => r.id} sortable />);
    const ageHeader = screen.getByRole("button", { name: /age/i });

    // TanStack defaults numeric columns to desc-first: first click = desc.
    act(() => { fireEvent.click(ageHeader); });
    expect(getDataRowNames()).toEqual(["Carol", "Eve", "Alice", "Bob", "Dave"]);

    // Second click = asc.
    act(() => { fireEvent.click(ageHeader); });
    expect(getDataRowNames()).toEqual(["Dave", "Bob", "Alice", "Eve", "Carol"]);

    // String columns default asc-first.
    const nameHeader = screen.getByRole("button", { name: /name/i });
    act(() => { fireEvent.click(nameHeader); });
    expect(getDataRowNames()).toEqual(["Alice", "Bob", "Carol", "Dave", "Eve"]);
  });

  it("globalFilter: narrows visible rows by substring", () => {
    function Wrapper() {
      const [filter, setFilter] = React.useState("");
      return (
        <>
          <input
            data-testid="filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <DataTable
            columns={COLS}
            rows={ROWS}
            rowKey={(r) => r.id}
            globalFilter={filter}
          />
        </>
      );
    }
    render(<Wrapper />);
    const input = screen.getByTestId("filter") as HTMLInputElement;

    act(() => { fireEvent.change(input, { target: { value: "ar" } }); });
    expect(getDataRowNames()).toEqual(["Carol"]);

    act(() => { fireEvent.change(input, { target: { value: "" } }); });
    expect(getDataRowNames()).toHaveLength(5);
  });

  it("pageSize: paginates and Next button advances", () => {
    render(<DataTable columns={COLS} rows={ROWS} rowKey={(r) => r.id} pageSize={2} />);
    expect(getDataRowNames()).toEqual(["Alice", "Bob"]);
    const next = screen.getByLabelText("Next page");
    act(() => { fireEvent.click(next); });
    expect(getDataRowNames()).toEqual(["Carol", "Dave"]);
    act(() => { fireEvent.click(next); });
    expect(getDataRowNames()).toEqual(["Eve"]);
    expect(screen.getByTestId("data-table-pagination-summary").textContent).toMatch(/Page 3 of 3/);
  });

  it("aria-sort attribute reflects sort state", () => {
    render(<DataTable columns={COLS} rows={ROWS} rowKey={(r) => r.id} sortable defaultSort={{ columnId: "age", desc: true }} />);
    const headers = screen.getAllByRole("columnheader");
    const ageHeader = headers.find((h) => h.textContent?.toLowerCase().includes("age"))!;
    expect(ageHeader.getAttribute("aria-sort")).toBe("descending");
  });
});
