/**
 * أنواع وبيانات نظام التراخيص - CommessionalHal
 */

export interface LicensePayload {
  version: number;
  machineFingerprint: string;
  customerName: string;
  productName: string;
  issuedAt: string;
  expiresAt: string | null;
  features: string[];
}

export interface LicenseFileContent {
  payload: string;   // Base64 encoded JSON of LicensePayload
  signature: string; // Base64 encoded RSA-SHA256 signature
}

export interface LicenseVerificationResult {
  valid: boolean;
  reason?: string;
  license?: LicensePayload;
}

export interface MachineIdFileContent {
  fingerprint: string;
  createdAt: string;
  platform?: string;
  arch?: string;
}
