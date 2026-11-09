# Reports and exports

## Report screen

`/reports` is available to Super Admin, Managing Director and Merchandiser. Each role sees exactly the data its order scope allows: merchandisers only their own orders; Super Admin and MD the whole book.

Four report types are available through a tab selector:

| Type | Rows | Key columns |
| --- | --- | --- |
| `production` | Every update in the period, including offline-synced entries | Date, PO, buyer, style, stage, quantity, supervisor, source |
| `orders` | Live order status | PO, buyer, style, quantity, ex-factory, current stage, progress, health, open issues |
| `delays` | Active delay alerts with the calculation | PO, stage, risk, window, planned date, remaining, required/actual daily, projection |
| `buyers` | Buyer-level totals | Orders, ordered/produced pieces, delay exposure, on-time percentage |

The page shows the report title, subtitle (range, row count, totals, generation date and business timezone) and a preview table. The selected type and dates are preserved in the URL.

## Date range

`resolveReportRange` behaves as follows:

1. Missing or malformed dates are replaced: `to` defaults to the business date, `from` defaults to 29 days before `to` (a 30-day inclusive window).
2. If `from` is after `to`, they are swapped.
3. The range is capped at 365 days by moving `from` forward.
4. Only `YYYY-MM-DD` strings are accepted; anything else is ignored.

Production rows filter `update_date` between `from` and `to` inclusive. Order, delay and buyer reports use the current live state, with the selected range shown in the subtitle and used where the underlying data is date-based.

## Excel export

`GET /api/reports/[type]?format=xlsx&from=YYYY-MM-DD&to=YYYY-MM-DD`

- Built with ExcelJS on the server.
- Landscape page setup, fit-to-width, frozen header.
- Branded title row and subtitle, formatted header, alternating row shading, right-aligned numeric columns.
- Worksheet name sanitised to 31 characters.
- Filename: `<type>-<from>-to-<to>.xlsx`.

## PDF export

`GET /api/reports/[type]?format=pdf&from=...&to=...`

- Built with pdf-lib using standard Helvetica fonts (no external font files).
- A4 landscape, branded header, wrapped subtitle, repeated table header on new pages, page numbering and clipped long values.
- Filename: `<type>-<from>-to-<to>.pdf`.

## Endpoint rules

| Check | Behaviour |
| --- | --- |
| Not signed in | 401 JSON |
| Signed in but not internal | 403 JSON |
| Unknown report type | 400 JSON |
| Format other than `xlsx`/`pdf` | 400 JSON |
| Valid request | Binary attachment with `Content-Disposition`, `Content-Length` and `Cache-Control: private, no-store` |
| Response | `X-Content-Type-Options: nosniff` |

The endpoint calls `buildReport` with the session user, so the export is scoped at query time. There is no pre-generated public file to guess.

## Verification

- Playwright downloads the Excel file through the **Excel** link and verifies the `.xlsx` filename.
- The PDF endpoint is requested directly and checked for `Content-Type: application/pdf` and a size over 1 KB.
- The unauthenticated reports endpoint returns 401 in the E2E suite.

## Operational notes

- Very large ranges are capped at 365 days; split exports if you need a longer history.
- Excel generation is memory-bound for extremely large sets; the intended range is monthly/quarterly operational reporting.
- PDF fonts use the standard Helvetica encoding, which covers the Latin report labels. Tamil text in free-text fields may not render in PDF; use the Excel export for Tamil content.

## Related reading

- [Orders & TNA](orders-and-tna.md)
- [Delay engine](delay-engine.md)
- [Roles & security](roles-and-security.md)
