import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  FilterFn,
  getPaginationRowModel,
  PaginationState,
} from '@tanstack/react-table';
import { useState, useMemo } from 'react';
import { Input } from './Input';

type TableRow = {
  [key: string]: string | number | Date | null;
};

const fuzzyFilter: FilterFn<TableRow> = (row, columnId, value) => {
  const searchValue = value.toLowerCase();
  const cellValue = String(row.getValue(columnId) ?? '').toLowerCase();

  // Check for column-specific search (e.g., "name:john" or gender:"male")
  if (searchValue.includes(':')) {
    const [column, search] = searchValue.split(':');
    if (column.toLowerCase() === columnId.toLowerCase()) {
      // Convert both values to strings for comparison
      const searchStr = String(search.trim().toLowerCase());
      const cellStr = String(cellValue);

      // Check if search is wrapped in double quotes for exact match
      if (searchStr.startsWith('"') && searchStr.endsWith('"')) {
        // Remove quotes and do exact match
        const exactSearch = searchStr.slice(1, -1);
        return cellStr === exactSearch;
      }

      // Otherwise do partial match
      return cellStr.includes(searchStr);
    }
    return false;
  }

  // Global search
  return cellValue.includes(searchValue);
};

const defaultRenderCell = (value: string | number | Date | null) => {
  if (value === null) return null;
  if (value === undefined) return '';
  if (value instanceof Date) {
    return (
      <time dateTime={value.toISOString()} title={value.toISOString()}>
        {value.toLocaleDateString()}
      </time>
    );
  }
  return value;
};

export const Table = ({
  rows,
  search = false,
  renderCell = defaultRenderCell,
}: {
  rows: TableRow[];
  search?: boolean;
  renderCell?: (value: string | number | Date | null) => React.ReactNode;
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const columnHelper = createColumnHelper<TableRow>();

  const headers = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]);
  }, [rows]);

  const columns = useMemo(
    () =>
      headers.map((header) =>
        columnHelper.accessor(header, {
          header: () => (
            <div className="flex cursor-pointer items-center gap-2 select-none">
              {header}
              <span className="text-xs">
                {sorting.find((s) => s.id === header) ? (sorting.find((s) => s.id === header)?.desc ? '↓' : '↑') : '↕'}
              </span>
            </div>
          ),
          cell: (info) => renderCell(info.getValue()),
          filterFn: fuzzyFilter,
        }),
      ),
    [columnHelper, headers, sorting, renderCell],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    globalFilterFn: fuzzyFilter,
  });

  return (
    <div className="flex flex-col gap-2 text-sm">
      {search && (
        <Input
          label="Search"
          placeholder='(e.g., name:john or gender:"male")'
          value={globalFilter}
          onChangeValue={setGlobalFilter}
        />
      )}
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-primary border">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-primary border-r p-2 text-left"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-primary border">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="border-primary border-r p-2 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <div className="mt-2 flex items-center gap-2">
          <button className="rounded border p-1" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}>
            {'<<'}
          </button>
          <button className="rounded border p-1" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            {'<'}
          </button>
          <button className="rounded border p-1" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            {'>'}
          </button>
          <button className="rounded border p-1" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()}>
            {'>>'}
          </button>
          <span className="flex items-center gap-1">
            <div>Page</div>
            <strong>
              {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </strong>
          </span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            className="rounded border p-1"
          >
            {[10, 20, 30, 40, 50].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                Show {pageSize}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
