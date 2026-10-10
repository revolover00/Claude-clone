---
name: presentations
description: "Generates modern 16:9 widescreen PowerPoint presentation slide decks (.pptx) with structured titles, bullet points, theme palettes, images, and speaker notes. Use when users ask to create slides, pitch decks, keynote presentations, or lectures in .pptx format. Supports RTL layout and Arabic text. Triggers: create presentation, powerpoint deck, generate pptx, make slides, pitch deck, عرض تقديمي, شرائح باوربوينت, ملف pptx, إنشاء عرض."
license: MIT
version: 1.0.0
---

# Presentations Creation (.pptx)

Use the server function `create_document({ format: "pptx", title, spec })` to generate a PowerPoint slide deck.

## How to fill the spec

1. **Structure First**: Plan a cohesive slide deck story:
   - Dedicated title slide
   - Content slides with punchy slide titles and concise subtitles
   - 3-5 bullet points per slide (`bullets: string[]`)
   - Speaker notes (`speakerNotes: string`) for presenter guidance
   - Optional image URL (`imageUrl: string`)

2. **Concise Text**: Keep slide copy tight, punchy, and impactful.

3. **Arabic & RTL Handling**:
   - For Arabic presentations, set `rtl: true` at the root spec or per slide.
   - Text boxes, titles, and layout columns will automatically align to the right with Arabic typography.

## Example Call

```json
{
  "format": "pptx",
  "title": "AI Product Launch Strategy",
  "spec": {
    "rtl": false,
    "theme": { "primaryColor": "1E3A8A", "textColor": "1F2937" },
    "slides": [
      {
        "title": "Market Opportunity",
        "subtitle": "Addressing core user bottlenecks",
        "bullets": [
          "Enterprise adoption of generative AI increased by 140%",
          "Key unmet need: deterministic document generation",
          "Competitive advantage: local data sovereignty"
        ],
        "speakerNotes": "Emphasize market expansion and customer retention data."
      }
    ]
  }
}
```
