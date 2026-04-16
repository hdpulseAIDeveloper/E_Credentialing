"use client";

/**
 * DataTable — lightweight table primitive that consolidates how the app
 * renders list/grid views. Built on top of `components/ui/table.tsx`.
 *
 * Goals:
 *   - One place to standardize column alignment, empty-state, and loading
 *     states across every module (providers, enrollments, expirables, ...).
 *   - Zero dependency on `@tanstack/react-table` for now; the columns API
 *     is deliberately small so we can swap in TanStack later without
 *     rewriting every call site.
 *   - Accessible: real `<table>` with `<caption>` + scope attributes.
 */

import * as React from "react";
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
}

export interface DataTableProps<Row> {
  /** Columns. Order = rendering order. */
  columns: ReadonlyArray<DataTableColumn<Row>>;
  /** Rows. */
  rows: ReadonlyArray<Row>;
  /** Called to get a stable key per row. Required — forces callers to think. */
  rowKey: (row: Row, index: number) => string;
  /** Shown when `rows` is empty. */
  emptyState?: React.ReactNode;
  /** Shown instead of rows while loading. */
  loading?: boolean;
  /** Caption text (screen-reader friendly). */
  caption?: string;
  className?: string;
  onRowClick?: (row: Row) => void;
}

const alignClass = (a: DataTableColumn<unknown>["align"]) =>
  a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  emptyState,
  loading = false,
  caption,
  className,
  onRowClick,
}: DataTableProps<Row>) {
  const showEmpty = !loading && rows.length === 0;

  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.id}
                scope="col"
                style={c.width ? { width: c.width } : undefined}
                className={cn(alignClass(c.align), c.className)}
              >
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                Loading…
              </TableCell>
            </TableRow>
          ) : showEmpty ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                {emptyState ?? "No records found."}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => (
              <TableRow
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
              >
                {columns.map((c) => (
                  <TableCell
                    key={c.id}
                    className={cn(alignClass(c.align), c.className)}
                  >
                    {c.cell(row, i)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
