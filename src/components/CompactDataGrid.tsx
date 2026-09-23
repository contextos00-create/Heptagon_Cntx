import React, { useState, useMemo, useRef } from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  ArrowUpDown, 
  Search, 
  Plus, 
  Trash2, 
  Download, 
  Check, 
  X,
  FileSpreadsheet
} from 'lucide-react';
import { Badge, Tooltip, ActionIcon, TextInput } from '@mantine/core';
import { DataGridData, DataGridColumn, TableData } from '../types/surface';

interface CompactDataGridProps {
  dataGrid?: DataGridData;
  tableData?: TableData;
  title?: string;
  isCompact?: boolean;
  isEditable?: boolean;
  onUpdate?: (updated: { dataGrid?: DataGridData; tableData?: TableData }) => void;
  onInteractiveTextClick?: (text: string) => void;
}

export const CompactDataGrid: React.FC<CompactDataGridProps> = ({
  dataGrid,
  tableData,
  title,
  isCompact = true,
  isEditable = true,
  onUpdate,
  onInteractiveTextClick,
}) => {
  // Normalize columns and rows
  const { normalizedColumns, normalizedRows } = useMemo<{
    normalizedColumns: DataGridColumn[];
    normalizedRows: Record<string, any>[];
  }>(() => {
    if (dataGrid && dataGrid.columns && dataGrid.rows) {
      return {
        normalizedColumns: dataGrid.columns,
        normalizedRows: dataGrid.rows,
      };
    }

    if (tableData && tableData.headers && tableData.rows) {
      const cols: DataGridColumn[] = tableData.headers.map((h, idx) => {
        const sample = tableData.rows[0]?.[idx] || '';
        const isNumeric = /^[\d.,]+(%|ms|s|mb|gb|req\/s)?$/i.test(sample.trim());
        const isStatus = /^(online|offline|healthy|critical|degraded|active|inactive|error|warning|ok)$/i.test(sample.trim());
        return {
          id: `col_${idx}`,
          header: h,
          type: isStatus ? 'status' : isNumeric ? 'number' : 'text',
          sortable: true,
        };
      });

      const rows: Record<string, any>[] = tableData.rows.map((row) => {
        const obj: Record<string, any> = {};
        cols.forEach((col, cIdx) => {
          obj[col.id] = row[cIdx] ?? '';
        });
        return obj;
      });

      return { normalizedColumns: cols, normalizedRows: rows };
    }

    // Default sample fallback
    const defaultCols: DataGridColumn[] = [
      { id: 'node', header: 'Node', type: 'text', sortable: true },
      { id: 'status', header: 'Status', type: 'status', sortable: true },
      { id: 'p99', header: 'P99 Latency', type: 'number', sortable: true },
      { id: 'uptime', header: 'Uptime', type: 'number', sortable: true },
    ];
    const defaultRows: Record<string, any>[] = [
      { node: 'us-west-1', status: 'Healthy', p99: '1.4ms', uptime: '99.99%' },
      { node: 'eu-central-1', status: 'Healthy', p99: '2.1ms', uptime: '99.98%' },
      { node: 'ap-southeast-1', status: 'Degraded', p99: '8.4ms', uptime: '99.82%' },
    ];
    return {
      normalizedColumns: defaultCols,
      normalizedRows: defaultRows,
    };
  }, [dataGrid, tableData]);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // Search filter query
  const [filterQuery, setFilterQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Cell editing state
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colId: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement | null>(null);

  // Handle column header click for sorting
  const handleSort = (colId: string) => {
    if (sortColumn !== colId) {
      setSortColumn(colId);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortColumn(null);
      setSortDirection(null);
    }
  };

  // Helper parser for sorting numeric and unit values (e.g. "1.2ms", "99.9%", "45k")
  const parseSortValue = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    const cleanNum = str.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleanNum);
    if (!isNaN(num) && /[\d]/.test(str)) {
      return num;
    }
    return str.toLowerCase();
  };

  // Process rows: filter then sort
  const processedRows = useMemo(() => {
    let result = [...normalizedRows];

    // Filter
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((val) =>
          String(val).toLowerCase().includes(q)
        )
      );
    }

    // Sort
    if (sortColumn && sortDirection) {
      result.sort((a, b) => {
        const valA = parseSortValue(a[sortColumn]);
        const valB = parseSortValue(b[sortColumn]);

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        const strA = String(valA);
        const strB = String(valB);
        return sortDirection === 'asc'
          ? strA.localeCompare(strB)
          : strB.localeCompare(strA);
      });
    }

    return result;
  }, [normalizedRows, filterQuery, sortColumn, sortDirection]);

  // Commit cell edit
  const commitEdit = () => {
    if (!editingCell || !onUpdate) {
      setEditingCell(null);
      return;
    }

    const { rowIdx, colId } = editingCell;
    const targetRow = processedRows[rowIdx];
    if (!targetRow) {
      setEditingCell(null);
      return;
    }

    // Find original index in normalizedRows
    const origIndex = normalizedRows.indexOf(targetRow);
    if (origIndex === -1) {
      setEditingCell(null);
      return;
    }

    const newRows = [...normalizedRows];
    newRows[origIndex] = {
      ...newRows[origIndex],
      [colId]: editValue,
    };

    // Propagate changes
    if (dataGrid) {
      onUpdate({
        dataGrid: {
          ...dataGrid,
          rows: newRows,
        },
      });
    } else if (tableData) {
      const updatedTableRows = newRows.map((r) =>
        normalizedColumns.map((c) => r[c.id] ?? '')
      );
      onUpdate({
        tableData: {
          headers: tableData.headers,
          rows: updatedTableRows,
        },
      });
    }

    setEditingCell(null);
  };

  // Add new row
  const handleAddRow = () => {
    if (!onUpdate) return;
    const emptyRow: Record<string, any> = {};
    normalizedColumns.forEach((col, idx) => {
      emptyRow[col.id] = idx === 0 ? `Item ${normalizedRows.length + 1}` : '-';
    });

    const newRows = [...normalizedRows, emptyRow];

    if (dataGrid) {
      onUpdate({
        dataGrid: {
          ...dataGrid,
          rows: newRows,
        },
      });
    } else if (tableData) {
      const updatedTableRows = newRows.map((r) =>
        normalizedColumns.map((c) => r[c.id] ?? '')
      );
      onUpdate({
        tableData: {
          headers: tableData.headers,
          rows: updatedTableRows,
        },
      });
    }
  };

  // Delete row
  const handleDeleteRow = (rowObj: Record<string, any>, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdate) return;
    const newRows = normalizedRows.filter((r) => r !== rowObj);

    if (dataGrid) {
      onUpdate({
        dataGrid: {
          ...dataGrid,
          rows: newRows,
        },
      });
    } else if (tableData) {
      const updatedTableRows = newRows.map((r) =>
        normalizedColumns.map((c) => r[c.id] ?? '')
      );
      onUpdate({
        tableData: {
          headers: tableData.headers,
          rows: updatedTableRows,
        },
      });
    }
  };

  // Export to CSV
  const handleExportCsv = (e: React.MouseEvent) => {
    e.stopPropagation();
    const headers = normalizedColumns.map((c) => `"${c.header}"`).join(',');
    const rowsCsv = processedRows
      .map((r) =>
        normalizedColumns
          .map((c) => `"${String(r[c.id] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const blob = new Blob([`${headers}\n${rowsCsv}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'datagrid-export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render cell badge for status or numeric metrics
  const renderCellContent = (val: any, col: DataGridColumn) => {
    const str = String(val ?? '');

    // Status format
    const lower = str.toLowerCase();
    if (
      col.type === 'status' ||
      ['healthy', 'online', 'active', 'ok'].includes(lower)
    ) {
      return (
        <Badge size="xs" variant="light" color="teal" className="font-mono text-[9px] px-1 py-0 uppercase">
          {str}
        </Badge>
      );
    }
    if (['degraded', 'warning', 'warn'].includes(lower)) {
      return (
        <Badge size="xs" variant="light" color="yellow" className="font-mono text-[9px] px-1 py-0 uppercase">
          {str}
        </Badge>
      );
    }
    if (['critical', 'down', 'error', 'offline', 'high'].includes(lower)) {
      return (
        <Badge size="xs" variant="light" color="red" className="font-mono text-[9px] px-1 py-0 uppercase">
          {str}
        </Badge>
      );
    }

    // Interactive location tag if applicable
    if (onInteractiveTextClick && /singapore|tokyo|london|frankfurt|austin|berlin/i.test(str)) {
      return (
        <span 
          onClick={(e) => {
            e.stopPropagation();
            onInteractiveTextClick(str);
          }}
          className="underline decoration-dotted decoration-blue-500 cursor-pointer hover:text-blue-500 font-medium"
        >
          {str}
        </span>
      );
    }

    return <span className={col.type === 'number' ? 'font-mono' : ''}>{str}</span>;
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden text-xs select-none">
      {/* Header controls bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-zinc-50/80 dark:bg-zinc-900/60 border-b border-zinc-200/80 dark:border-zinc-800/80 shrink-0 gap-1 text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileSpreadsheet className="w-3 h-3 text-orange-500 shrink-0" />
          <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
            {title || 'Compact Data Grid'}
          </span>
          <Badge size="xs" variant="light" color="gray" className="font-mono text-[8px] px-1">
            {processedRows.length} {processedRows.length === 1 ? 'row' : 'rows'}
          </Badge>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {showSearch ? (
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 px-1 py-0.5 rounded border border-zinc-300 dark:border-zinc-700">
              <Search className="w-2.5 h-2.5 text-zinc-400" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter..."
                autoFocus
                className="w-16 sm:w-24 text-[10px] bg-transparent outline-none text-zinc-800 dark:text-zinc-200"
              />
              <button
                onClick={() => {
                  setFilterQuery('');
                  setShowSearch(false);
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <Tooltip label="Filter rows">
              <ActionIcon
                onClick={() => setShowSearch(true)}
                variant="subtle"
                color="gray"
                size="xs"
              >
                <Search className="w-2.5 h-2.5" />
              </ActionIcon>
            </Tooltip>
          )}

          {isEditable && (
            <Tooltip label="Add row">
              <ActionIcon
                onClick={handleAddRow}
                variant="subtle"
                color="orange"
                size="xs"
              >
                <Plus className="w-2.5 h-2.5" />
              </ActionIcon>
            </Tooltip>
          )}

          <Tooltip label="Export CSV">
            <ActionIcon
              onClick={handleExportCsv}
              variant="subtle"
              color="gray"
              size="xs"
            >
              <Download className="w-2.5 h-2.5" />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {/* Grid container with sticky headers and compact scrolling */}
      <div className="flex-1 overflow-auto bg-white dark:bg-[#121316]">
        <table className="w-full border-collapse text-left text-[10px]">
          <thead className="sticky top-0 bg-zinc-100/95 dark:bg-zinc-900/95 backdrop-blur-xs z-10 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
            <tr>
              {normalizedColumns.map((col) => {
                const isSorted = sortColumn === col.id;
                return (
                  <th
                    key={col.id}
                    onClick={() => col.sortable !== false && handleSort(col.id)}
                    className={`px-2 py-1.5 select-none font-semibold truncate transition-colors ${
                      col.sortable !== false
                        ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-100'
                        : ''
                    } ${isSorted ? 'text-orange-600 dark:text-orange-400 bg-orange-500/5' : ''}`}
                    style={{ width: col.width ? `${col.width}px` : undefined }}
                    title={col.sortable !== false ? 'Click to sort' : undefined}
                  >
                    <div className="flex items-center gap-1">
                      <span className="truncate">{col.header}</span>
                      {col.sortable !== false && (
                        <span className="shrink-0 text-zinc-400">
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-2.5 h-2.5 text-orange-500" />
                            ) : (
                              <ArrowDown className="w-2.5 h-2.5 text-orange-500" />
                            )
                          ) : (
                            <ArrowUpDown className="w-2 h-2 opacity-40 hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              {isEditable && <th className="w-5 px-1 py-1.5"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-sans">
            {processedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={normalizedColumns.length + (isEditable ? 1 : 0)}
                  className="px-3 py-6 text-center text-zinc-400 font-mono text-[10px]"
                >
                  No matching data rows found.
                </td>
              </tr>
            ) : (
              processedRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="group hover:bg-orange-500/[0.03] dark:hover:bg-orange-400/[0.04] transition-colors"
                >
                  {normalizedColumns.map((col) => {
                    const isEditing =
                      editingCell?.rowIdx === rIdx && editingCell?.colId === col.id;
                    const cellVal = row[col.id];

                    return (
                      <td
                        key={col.id}
                        onDoubleClick={() => {
                          if (isEditable) {
                            setEditingCell({ rowIdx: rIdx, colId: col.id });
                            setEditValue(String(cellVal ?? ''));
                          }
                        }}
                        className={`px-2 py-1 truncate text-zinc-800 dark:text-zinc-200 transition-colors ${
                          col.type === 'number' ? 'text-right' : ''
                        }`}
                        title="Double-click to edit cell"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-0.5">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={commitEdit}
                              autoFocus
                              className="w-full bg-white dark:bg-zinc-800 border border-orange-500 rounded px-1 py-0 text-[10px] text-zinc-900 dark:text-zinc-100 outline-none font-mono"
                            />
                          </div>
                        ) : (
                          renderCellContent(cellVal, col)
                        )}
                      </td>
                    );
                  })}

                  {/* Row delete action */}
                  {isEditable && (
                    <td className="w-5 px-1 py-1 text-right">
                      <button
                        onClick={(e) => handleDeleteRow(row, e)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-opacity p-0.5"
                        title="Delete row"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
