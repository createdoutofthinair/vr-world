import { Vec3 } from "./project";
// AWG3 field order: syntax-tool author's published grammar, corroborated by AW's
// original headerless-propdump tutorial. Centimeter positions remain a native-test gate.
export interface AWGObject {
  model: string;
  description: string;
  action: string;
  position: Vec3;
}
const ascii = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/[^\x20-\x7e]/g, "?");
export function serializeAWG(
  objects: AWGObject[],
  unitsPerMeter = 100,
): string {
  if (!Number.isFinite(unitsPerMeter) || unitsPerMeter <= 0)
    throw new Error("Invalid AWG position scale.");
  return (
    objects
      .map((object) => {
        if (
          !/^c3-[a-z0-9-]+\.rwx$/.test(object.model) ||
          object.position.some(
            (n) =>
              !Number.isFinite(n) || Math.abs(n * unitsPerMeter) > 2147483647,
          )
        )
          throw new Error("Unsafe AWG object.");
        const model = object.model,
          description = ascii(object.description).slice(0, 128),
          action = ascii(object.action);
        if (action.length > 1024)
          throw new Error("Action exceeds conservative AWG probe limit.");
        const coords = object.position.map((v) =>
          Math.round(v * unitsPerMeter),
        );
        return (
          [
            0,
            946684800,
            ...coords,
            0,
            0,
            0,
            0,
            model.length,
            description.length,
            action.length,
            0,
          ].join(" ") +
          " " +
          model +
          description +
          action
        );
      })
      .join("\n") + "\n"
  );
}
export function parseAWG(text: string, unitsPerMeter = 100): AWGObject[] {
  if (
    text.length > 20000000 ||
    !Number.isFinite(unitsPerMeter) ||
    unitsPerMeter <= 0
  )
    throw new Error("Invalid AWG input limit/scale.");
  const result: AWGObject[] = [];
  for (const line of text.split(/\r?\n/).filter((l) => l.trim())) {
    const match = /^((?:-?\d+\s+){13})([\s\S]*)$/.exec(line);
    if (!match) throw new Error("Invalid AWG3 numeric fields.");
    const values = match[1].trim().split(/\s+/).map(Number);
    if (
      values.some((n) => !Number.isSafeInteger(n)) ||
      values.slice(5, 9).some((n) => n !== 0) ||
      values.slice(9).some((n) => n < 0)
    )
      throw new Error("Unsupported AWG type/rotation/length.");
    const [modelLength, descriptionLength, actionLength, dataLength] =
        values.slice(9),
      payload = match[2];
    if (
      dataLength !== 0 ||
      payload.length !== modelLength + descriptionLength + actionLength
    )
      throw new Error("AWG concatenated payload lengths do not agree.");
    const model = payload.slice(0, modelLength),
      description = payload.slice(modelLength, modelLength + descriptionLength),
      action = payload.slice(modelLength + descriptionLength);
    if (!/^c3-[a-z0-9-]+\.rwx$/.test(model) || /[^\x20-\x7e]/.test(payload))
      throw new Error("Unsafe AWG namespace/encoding.");
    result.push({
      model,
      description,
      action,
      position: values.slice(2, 5).map((v) => v / unitsPerMeter) as Vec3,
    });
  }
  return result;
}
