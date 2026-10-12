declare module "gltf-validator" {
  export interface ValidationReport {
    issues: {
      numErrors: number;
      numWarnings: number;
      messages: {
        code: string;
        message: string;
        severity: number;
        pointer?: string;
      }[];
    };
  }
  export function validateBytes(
    bytes: Uint8Array,
    options?: { uri?: string; maxIssues?: number },
  ): Promise<ValidationReport>;
}
