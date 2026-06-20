function resolveMode(apiKey, openaiKey) {
  if (!apiKey && !openaiKey) {
    return {
      mode: "offline",
      canAnalyze: false,
      canStore: false,
    };
  }

  if (apiKey) {
    return {
      mode: "paid",
      canAnalyze: true,
      canStore: true,
    };
  }

  return {
    mode: "free",
    canAnalyze: true,
    canStore: false,
  };
}

module.exports = { resolveMode };
