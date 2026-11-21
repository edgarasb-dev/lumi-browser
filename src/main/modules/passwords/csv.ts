export interface CsvPasswordRecord {
  title: string | null;
  url: string;
  username: string;
  password: string;
  note: string | null;
}

function parseCsvRows(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r") {
      if (input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

export function parsePasswordsCsv(csvContent: string): CsvPasswordRecord[] {
  const rows = parseCsvRows(csvContent).filter((r) => r.some((cell) => cell.trim().length > 0));
  if (rows.length === 0) return [];

  const first = rows[0]!.map((h) => h.trim().toLowerCase());
  const urlCol = first.findIndex((h) => ["url", "origin", "origin_url", "website", "hostname"].includes(h));
  const userCol = first.findIndex((h) => ["username", "username_value", "user", "login", "email"].includes(h));
  const passCol = first.findIndex((h) => ["password", "password_value", "pass"].includes(h));
  const nameCol = first.findIndex((h) => ["name", "title", "display_name"].includes(h));
  const noteCol = first.findIndex((h) => ["note", "notes", "comment"].includes(h));

  const hasHeader = urlCol !== -1 && passCol !== -1;
  const startIdx = hasHeader ? 1 : 0;

  const effectiveUrlCol = hasHeader ? urlCol : 1;
  const effectiveUserCol = hasHeader ? (userCol !== -1 ? userCol : 2) : 2;
  const effectivePassCol = hasHeader ? passCol : 3;
  const effectiveNameCol = hasHeader ? nameCol : 0;
  const effectiveNoteCol = hasHeader ? noteCol : 4;

  const records: CsvPasswordRecord[] = [];
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i]!;
    const url = (r[effectiveUrlCol] ?? "").trim();
    const password = r[effectivePassCol] ?? "";
    const username = (r[effectiveUserCol] ?? "").trim();
    const title = effectiveNameCol >= 0 ? (r[effectiveNameCol] ?? "").trim() || null : null;
    const note = effectiveNoteCol >= 0 ? (r[effectiveNoteCol] ?? "").trim() || null : null;
    if (!url || !password) continue;
    records.push({ title, url, username, password, note });
  }

  return records;
}

function escapeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  if (/[",\r\n]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
}

export function serializePasswordsCsv(records: CsvPasswordRecord[]): string {
  const header = "name,url,username,password,note";
  const lines = records.map((r) =>
    [r.title ?? "", r.url, r.username, r.password, r.note ?? ""].map(escapeCsvCell).join(",")
  );
  return [header, ...lines].join("\n");
}
