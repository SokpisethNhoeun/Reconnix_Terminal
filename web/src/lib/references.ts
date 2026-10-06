/* Short names for the OWASP and CWE references the Reconix templates and importers use,
   shown under each reference in the categories chart. Unknown ids show without a name. */
const NAMES: Record<string, string> = {
  "OWASP A01:2021": "Broken access control",
  "OWASP A02:2021": "Cryptographic failures",
  "OWASP A03:2021": "Injection",
  "OWASP A05:2021": "Security misconfiguration",
  "OWASP A06:2021": "Vulnerable and outdated components",
  "OWASP A07:2021": "Identification and authentication failures",
  "OWASP API1:2023": "Broken object-level authorization",
  "OWASP API4:2023": "Unrestricted resource consumption",
  "OWASP API5:2023": "Broken function-level authorization",
  "CWE-79": "Cross-site scripting",
  "CWE-89": "SQL injection",
  "CWE-200": "Exposure of sensitive information",
  "CWE-284": "Improper access control",
  "CWE-285": "Improper authorization",
  "CWE-307": "No limit on authentication attempts",
  "CWE-319": "Cleartext transmission",
  "CWE-327": "Broken or risky cryptography",
  "CWE-639": "Authorization bypass via user key",
  "CWE-798": "Hard-coded credentials",
  "CWE-1104": "Unmaintained third-party components",
  "CWE-1275": "Cookie with improper SameSite",
};

export const referenceName = (ref: string) => NAMES[ref] ?? "";
