const patterns = [
  { pattern: /ModuleNotFoundError:.*['"](.+)['"]/i, signature: "missing_module" },
  { pattern: /Cannot find module ['"](.+)['"]/i, signature: "missing_module" },
  { pattern: /ImportError:.*['"](.+)['"]/i, signature: "import_error" },
  { pattern: /Timeout.*exceeded/i, signature: "timeout_error" },
  { pattern: /jest.*timeout/i, signature: "jest_timeout_error" },
  { pattern: /Error: connect ECONNREFUSED/i, signature: "connection_refused" },
  { pattern: /ENOENT.*no such file or directory/i, signature: "file_not_found" },
  { pattern: /Environment variable ['"]?(\w+)['"]? is not set/i, signature: "env_var_missing" },
  { pattern: /missing.*environment.*variable/i, signature: "env_var_missing" },
  { pattern: /TypeError:/i, signature: "type_error" },
  { pattern: /ReferenceError:/i, signature: "reference_error" },
  { pattern: /SyntaxError:/i, signature: "syntax_error" },
  { pattern: /ENOMEM/i, signature: "out_of_memory" },
  { pattern: /ENOSPC/i, signature: "disk_full" },
  { pattern: /npm ERR! code E404/i, signature: "npm_package_not_found" },
  { pattern: /npm ERR! code ERESOLVE/i, signature: "npm_dependency_conflict" },
  { pattern: /docker.*not found/i, signature: "docker_not_available" },
  { pattern: /permission denied/i, signature: "permission_denied" },
  { pattern: /authentication.*failed/i, signature: "auth_failed" },
  { pattern: /rate limit/i, signature: "rate_limited" },
  { pattern: /AssertionError/i, signature: "assertion_failed" },
  { pattern: /test.*failed/i, signature: "test_failure" },
  { pattern: /build.*failed/i, signature: "build_failure" },
  { pattern: /compilation.*error/i, signature: "compilation_error" },
];

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}

function generateSignature(logs) {
  const normalizedLogs = logs.toLowerCase();

  for (const { pattern, signature } of patterns) {
    const match = normalizedLogs.match(new RegExp(pattern.source, "i"));
    if (match) {
      if (match[1]) {
        const detail = match[1]
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase()
          .substring(0, 30);
        return `${signature}_${detail}`;
      }
      return signature;
    }
  }

  const hash = simpleHash(normalizedLogs.substring(0, 500));
  return `unknown_${hash}`;
}

module.exports = { generateSignature };
