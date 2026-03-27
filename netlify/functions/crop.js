export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY not set.' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body
  try { body = await request.json() }
  catch {
    return new Response(
      JSON.stringify({ error: { message: 'Invalid JSON body.' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { image, mime, width, height } = body
  if (!image || !width || !height) {
    return new Response(
      JSON.stringify({ error: { message: 'Missing image, width, or height.' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime || 'image/jpeg', data: image } },
            { type: 'text', text: `This image is ${width}x${height} pixels. Find the main clothing/shoe/accessory item in the image. Return a tight bounding box around JUST the item (not the person or background). Also suggest one solid background color (hex) that would make this item stand out well — contrasting but aesthetically pleasing.

Return ONLY a raw JSON object:
{"x":0,"y":0,"w":100,"h":100,"bgColor":"#F5F0EB"}

Where x,y is the top-left corner and w,h is the width/height of the bounding box, all in pixels. The bgColor should be a light, neutral, or complementary color that makes the item pop.` },
          ],
        }],
      }),
    })

    const data = await res.json()
    if (data.error) {
      return new Response(JSON.stringify({ error: data.error }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      })
    }

    const raw = data.content?.map(i => i.text || '').join('').trim()
    const match = raw?.match(/\{[\s\S]*\}/)
    if (!match) {
      return new Response(
        JSON.stringify({ error: { message: 'Could not parse AI response' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const parsed = JSON.parse(match[0])
    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: `Function error: ${err.message}` } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
