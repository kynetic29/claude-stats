const https = require('https')

async function httpsGet(urlPath, apiKey) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: urlPath,
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (res.statusCode >= 400) {
            reject(new Error(`API ${res.statusCode}: ${body.error?.message ?? JSON.stringify(body)}`))
          } else {
            resolve(body)
          }
        } catch (e) {
          reject(new Error(`Failed to parse API response: ${e.message}`))
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

async function fetchDay(apiKey, dateStr) {
  const records = []
  let page = null

  do {
    const params = new URLSearchParams({ starting_at: dateStr, limit: '1000' })
    if (page) params.set('page', page)

    const body = await httpsGet(
      `/v1/organizations/usage_report/claude_code?${params}`,
      apiKey,
    )

    records.push(...(body.data || []))
    page = body.has_more ? body.next_page : null
  } while (page)

  return records
}

async function fetchRecentDays(apiKey, days = 30) {
  const today = new Date()
  const dates = []
  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }

  const all = []
  for (let i = 0; i < dates.length; i += 5) {
    const batch = dates.slice(i, i + 5)
    const settled = await Promise.allSettled(batch.map(date => fetchDay(apiKey, date)))
    for (const r of settled) {
      if (r.status === 'fulfilled') all.push(...r.value)
      else console.error('[usage-api] fetch error:', r.reason?.message)
    }
  }

  return all
}

module.exports = { fetchDay, fetchRecentDays }
