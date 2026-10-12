/** Inspect central-directory budgets before dependency inflation. ZIP64/multipart archives are outside this subset. */
export function checkZipBudget(
  bytes: Uint8Array,
  limits = {
    compressed: 250_000_000,
    expanded: 700_000_000,
    file: 100_000_000,
    entries: 32000,
  },
): void {
  if (bytes.length > limits.compressed || bytes.length < 22)
    throw new Error("Archive exceeds application budget or is truncated.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("Missing ZIP central directory.");
  const count = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    offset = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    view.getUint16(end + 8, true) !== count ||
    count === 65535 ||
    count > limits.entries ||
    offset + size !== end
  )
    throw new Error(
      "Multipart/ZIP64 archive or excessive entry count is unsupported.",
    );
  let cursor = offset,
    total = 0;
  const names = new Set<string>(),
    decoder = new TextDecoder("utf-8", { fatal: true });
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error("Invalid ZIP directory entry.");
    const flags = view.getUint16(cursor + 8, true),
      method = view.getUint16(cursor + 10, true),
      compressed = view.getUint32(cursor + 20, true),
      expanded = view.getUint32(cursor + 24, true),
      nameLength = view.getUint16(cursor + 28, true),
      extraLength = view.getUint16(cursor + 30, true),
      commentLength = view.getUint16(cursor + 32, true),
      local = view.getUint32(cursor + 42, true),
      next = cursor + 46 + nameLength + extraLength + commentLength;
    if (
      next > end ||
      flags & 1 ||
      ![0, 8].includes(method) ||
      local + 30 > offset ||
      compressed > limits.compressed ||
      expanded > limits.file ||
      expanded === 0xffffffff
    )
      throw new Error("Unsupported or oversized ZIP entry.");
    total += expanded;
    if (total > limits.expanded)
      throw new Error("Expanded archive exceeds application budget.");
    const name = decoder.decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    if (
      !name ||
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").some((part) => part === "..") ||
      names.has(name.toLowerCase())
    )
      throw new Error("Unsafe or colliding archive path.");
    names.add(name.toLowerCase());
    cursor = next;
  }
  if (cursor !== end) throw new Error("ZIP directory size mismatch.");
}
