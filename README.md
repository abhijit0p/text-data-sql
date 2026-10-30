# Text + Data to SQL Analytics Engine

An end-to-end analytical prototype that ingests multi-sheet Excel workbooks, dynamically infers schemas, runs analytical SQL aggregations using an embedded columnar engine (**DuckDB**), and uses **Gemini Structured Outputs** to generate executable SQL queries and UI dashboard specifications on the fly.

---

## Architecture Overview

```
[ React + Recharts UI ]
       │
       │ (Multipart File Upload / Natural Language Query)
       ▼
[ Node.js + Express Backend ]
       ├── 1. Ingestion: Parses multi-sheet Excel via xlsx and sanitizes column names
       ├── 2. Storage & Execution: Loads sheets as isolated relational tables in DuckDB
       ├── 3. Schema Introspection: Extracts table DDLs, types, and sample rows
       ├── 4. LLM Orchestration: Gemini generates DuckDB SQL + Chart configuration JSON
       └── 5. Guardrails: Validates read-only SELECT/CTE queries before execution
       │
       ▼
[ Returned Payload: Query Results + Recharts Configuration + Generated SQL ]

```

---

## Features

* **Dynamic Multi-Sheet Ingestion:** Upload an `.xlsx` file with arbitrary sheets. Each sheet is parsed and converted into an isolated relational table in DuckDB.
* **Embedded Columnar OLAP:** Uses DuckDB for fast analytical aggregations, group-bys, and joins without external database overhead.
* **Auto-Generated Dashboards:** Automatically inspects the uploaded schema and generates 3 starter analytical cards (KPI cards, categorical breakdown bar charts, and time-series line charts).
* **Natural Language to SQL:** Translates natural language prompts into syntactically valid DuckDB SQL queries with schema awareness and join detection.
* **Dynamic Visualization:** Uses Gemini Structured Outputs to return chart configurations (`recommendedType`, `xAxisKey`, `yAxisKeys`, `title`) that render directly via Recharts.
* **Read-Only Guardrails:** Enforces `SELECT` and `WITH` query constraints to prevent unauthorized state modifications.

---

## Project Structure

```
text-data-sql/
├── server/
│   ├── index.js          # Express server endpoints (/api/upload, /api/query)
│   ├── db.js             # DuckDB session database manager & Excel parser
│   ├── ai.js             # Gemini API client with JSON structured output schemas
│   ├── package.json
│   ├── Dockerfile        # Container specification for Cloud Run deployment
│   └── .env.example
├── client/
│   ├── src/
│   │   ├── App.jsx       # Single-page React dashboard & query UI
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
├── sample-data.xlsx      # Sample multi-sheet dataset for quick testing
├── .gitignore
└── README.md

```

---

## Prerequisites

* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **Gemini API Key**: Obtainable from Google AI Studio

---

## Getting Started Locally

### 1. Backend Setup

```bash
cd server
npm install

```

Create a `.env` file inside the `server/` folder:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000

```

Start the backend in development mode:

```bash
npm run dev

```

The server will be running on `http://localhost:5000`.

### 2. Frontend Setup

Open a separate terminal:

```bash
cd client
npm install
npm run dev

```

Open the Vite local server link (typically `http://localhost:5173`) in your browser.

---

## API Reference

### 1. Ingest Workbook

* **Endpoint:** `POST /api/upload`
* **Content-Type:** `multipart/form-data`
* **Body:** `file` (Excel `.xlsx` or `.xls`)
* **Response:**
```json
{
  "sessionId": "c40ed065-3bd0-4c70-9277-1944eab33b93",
  "schema": [
    {
      "tableName": "orders",
      "columns": ["order_id (BIGINT)", "customer_id (BIGINT)", "amount (DOUBLE)", "order_date (DATE)"],
      "sampleRows": [...]
    }
  ],
  "widgets": [
    {
      "sql": "SELECT c.city, ROUND(SUM(o.amount), 2) AS total_sales FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY 1",
      "explanation": "Calculates total spending grouped by customer location.",
      "chartConfig": {
        "recommendedType": "bar",
        "xAxisKey": "city",
        "yAxisKeys": ["total_sales"],
        "title": "Revenue by City"
      },
      "rows": [...]
    }
  ]
}

```



### 2. Natural Language Query

* **Endpoint:** `POST /api/query`
* **Content-Type:** `application/json`
* **Body:**
```json
{
  "sessionId": "c40ed065-3bd0-4c70-9277-1944eab33b93",
  "prompt": "Show top 3 customers by spending as a bar chart"
}

```


* **Response:**
```json
{
  "sql": "SELECT c.name, SUM(o.amount) AS total_spend FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY 1 ORDER BY total_spend DESC LIMIT 3",
  "explanation": "Aggregates order amounts per customer and orders by highest value.",
  "chartConfig": {
    "recommendedType": "bar",
    "xAxisKey": "name",
    "yAxisKeys": ["total_spend"],
    "title": "Top 3 Customers by Spending"
  },
  "rows": [...]
}

```



---

## Deployment

### Cloud Run (Backend)

Deploy directly from source inside the `server/` directory:

```bash
cd server
gcloud run deploy data-sql-backend \
  --source . \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --set-env-vars GEMINI_API_KEY="your-gemini-api-key"

```

### Static Hosting (Frontend)

Update `API_BASE` in `client/src/App.jsx` with your deployed Cloud Run URL, then build and deploy to Firebase Hosting or Google Cloud Storage:

```bash
cd client
npm run build

```

---

## License

MIT
