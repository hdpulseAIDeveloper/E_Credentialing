"use client";

/**
 * DataTable — canonical table primitive for the credentialing platform.
 *
 * History:
 *   - v1 was a hand-rolled wrapper around `components/ui/table.tsx` with
 *     a deliberately small column API so we could swap in TanStack later.
 *   - v2 (Wave 2.2 — ADR 0015) routes the same API through
 *     `@tanstack/react-table` and adds three opt-in capabilities:
 *       sortable    — click headers to sort
 *       globalFilter — case-insensitive substring across cells
 *       pageSize    — built-in pagination footer
 *
 * The legacy props (`columns`, `rows`, `rowKey`, `emptyState`, `loading`,
 * `caption`, `className`, `onRowClick`) are byte-identical so any current
 * call site keeps working unchanged.
 */

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<Row> {
  /** Stable key, also used for keyed rendering. */
  id: string;
  /** Column header text. */
  header: React.ReactNode;
  /** Renderer — receives the row and returns the cell content. */
  cell: (row: Row, index: number) => React.ReactNode;
  /** Optional text alignment. Defaults to left. */
  align?: "left" | "center" | "right";
  /** Optional column width hint (CSS width). */
  width?: string;
  /** Optional className for the cell. */
  className?: string;
  /**
   * Optional sort accessor. Required to make the column participate in
   * `sortable` mode. Must return a primitive (string | number | Date | bool)
   * so TanStack's default comparators work without configuration.
   */
  sortAccessor?: (row: Row) => string | number | boolean | Date | null | undefined;
  /**
   * Optional value used by `globalFilter` substring matching. Defaults to
   * the string form of `sortAccessor` if present, then `String(cell(row,i))`
   * as a last resort.
   */
  filterValue?: (row: Row) => string;
}

export interface DataTableProps<Row> {
  columns: ReadonlyArray<DataTableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  rowKey: (row: Row, index: number) => string;
  emptyState?: React.ReactNode;
  loading?: boolean;
  caption?: string;
  className?: string;
  onRowClick?: (row: Row) => void;
  /**
   * Opt-in: enable click-to-sort headers for any column that defines a
   * `sortAccessor`. Headers without an accessor stay non-interactive.
   */
  sortable?: boolean;
  /** Optional initial sort. Useful for "newest first" defaults. */
  defaultSort?: { columnId: string; desc?: boolean };
  /**
   * Opt-in: case-insensitive substring filter across all columns that
   * provide a `filterValue`. Pass an empty string to disable.
   */
  globalFilter?: string;
  /**
   * Opt-in: render a pagination footer with this page size. When omitted,
   * all rows render in a single page (legacy behavior).
   */
  pageSize?: number;
}

const alignClass = (a: DataTableColumn<unknown>["align"]) =>
  a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

function toFilterString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function DataTable<Row extends RowData>({
  columns,
  rows,
  rowKey,
  emptyState,
  loading = false,
  caption,
  className,
  onRowClick,
  sortable = false,
  defaultSort,
  globalFilter = "",
  pageSize,
}: DataTableProps<Row>) {
  const data = React.useMemo(() => rows as Row[], [rows]);

  const tanstackColumns = React.useMemo<ColumnDef<Row>[]>(() => {
    return columns.map((col, colIndex) => {
      const def: ColumnDef<Row> = {
        id: col.id,
        header: () => col.header,
        cell: (ctx) => col.cell(ctx.row.original, ctx.row.index),
        enableSorting: Boolean(sortable && col.sortAccessor),
        accessorFn: (row) => {
          if (col.sortAccessor) return col.sortAccessor(row);
          if (col.filterValue) return col.filterValue(row);
          return undefined;
        },
        meta: { colIndex, align: col.align, className: col.className, width: col.width },
      };
      return def;
    });
  }, [columns, sortable]);

  const [sorting, setSorting] = React.useState<SortingState>(
    defaultSort ? [{ id: defaultSort.columnId, desc: defaultSort.desc ?? false }] : [],
  );

  const globalFilterFn = React.useCallback(
    (row: { original: Row }, _columnId: string, filterValue: string) => {
      const needle = filterValue.trim().toLowerCase();
      if (!needle) return true;
      for (const col of columns) {
        let v: string;
        if (col.filterValue) v = col.filterValue(row.original);
        else if (col.sortAccessor) v = toFilterString(col.sortAccessor(row.original));
        else v = "";
        if (v.toLowerCase().includes(needle)) return true;
      }
      return false;
    },
    [columns],
  );

  const table = useReactTable<Row>({
    data,
    columns: tanstackColumns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    enableSorting: sortable,
    enableGlobalFilter: Boolean(globalFilter),
    globalFilterFn: globalFilterFn as never,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: pageSize ? getPaginationRowModel() : undefined,
    initialState: pageSize ? { pagination: { pageIndex: 0, pageSize } } : undefined,
    getRowId: (row, index) => rowKey(row, index),
  });

  const visibleRows = table.getRowModel().rows;
  const showEmpty = !loading && visibleRows.length === 0;
  const colCount = columns.length;

  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => {
                const meta = (h.column.columnDef.meta ?? {}) as {
                  colIndex?: number;
                  align?: DataTableColumn<unknown>["align"];
                  className?: string;
                  width?: string;
                };
                const col = (typeof meta.colIndex === "number" ? columns[meta.colIndex] : undefined) ?? columns[0];
                const canSort = h.column.getCanSort();
                const sortDir = h.column.getIsSorted();
                return (
                  <TableHead
                    key={h.id}
                    scope="col"
                    style={meta.width ?? col.width ? { width: meta.width ?? col.width } : undefined}
                    className={cn(alignClass(meta.align ?? col.align), meta.className ?? col.className)}
                    aria-sort={
                      sortDir === "asc"
                        ? "ascending"
                        : sortDir === "desc"
                          ? "descending"
                          : canSort
                            ? "none"
                            : undefined
                    }
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sortDir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                        ) : sortDir === "desc" ? (
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
                        )}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={colCount} className="text-center text-muted-foreground py-8">
                Loading…
              </TableCell>
            </TableRow>
          ) : showEmpty ? (
            <TableRow>
              <TableCell colSpan={colCount} className="text-center text-muted-foreground py-8">
                {emptyState ?? "No records found."}
              </TableCell>
            </TableRow>
          ) : (
            visibleRows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = (cell.column.columnDef.meta ?? {}) as {
                    align?: DataTableColumn<unknown>["align"];
                    className?: string;
                  };
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(alignClass(meta.align), meta.className)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {pageSize ? (
        <DataTablePagination
          pageIndex={table.getState().pagination.pageIndex}
          pageCount={table.getPageCount()}
          rowCount={table.getFilteredRowModel().rows.length}
          canPrev={table.getCanPreviousPage()}
          canNext={table.getCanNextPage()}
          onPrev={() => table.previousPage()}
          onNext={() => table.nextPage()}
        />
      ) : null}
    </div>
  );
}

interface DataTablePaginationProps {
  pageIndex: number;
  pageCount: number;
  rowCount: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

function DataTablePagination({
  pageIndex,
  pageCount,
  rowCount,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: DataTablePaginationProps) {
  return (
    <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
      <span data-testid="data-table-pagination-summary">
        {rowCount === 0
          ? "0 of 0"
          : `Page ${pageIndex + 1} of ${Math.max(1, pageCount)} · ${rowCount} ${rowCount === 1 ? "row" : "rows"}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Previous page"
          className="inline-flex h-7 w-7 items-center justify-center rounded border bg-background hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Next page"
          className="inline-flex h-7 w-7 items-center justify-center rounded border bg-background hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
