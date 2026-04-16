// Cost estimation by model
function estimateCostForModel(model, input, output, cacheCreation, cacheRead) {
  const pricing = {
    'claude-opus-4-7': { input: 5, output: 25, cacheCreation: 6.25, cacheRead: 0.5 },
    'claude-opus-4-6': { input: 15, output: 75, cacheCreation: 18.75, cacheRead: 1.5 },
    'claude-sonnet-4-6': { input: 3, output: 15, cacheCreation: 3.75, cacheRead: 0.3 },
    'claude-haiku-4-5': { input: 0.8, output: 4, cacheCreation: 1, cacheRead: 0.08 },
  }

  // Try exact match, then prefix match
  let p = pricing[model]
  if (!p && model) {
    if (model.includes('opus')) p = pricing['claude-opus-4-6']
    else if (model.includes('haiku')) p = pricing['claude-haiku-4-5']
    else p = pricing['claude-sonnet-4-6']
  }
  if (!p) p = pricing['claude-sonnet-4-6']

  return (
    (input * p.input +
      output * p.output +
      cacheCreation * p.cacheCreation +
      cacheRead * p.cacheRead) / 1_000_000
  )
}

module.exports = { estimateCostForModel }
