import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); //

// Define strictly validated response schema
const queryResponseSchema = {
  type: Type.OBJECT,
  properties: {
    sql: { type: Type.STRING, description: "Standard DuckDB SQL SELECT query." },
    explanation: { type: Type.STRING, description: "Brief plain-text explanation of calculations." },
    chartConfig: {
      type: Type.OBJECT,
      properties: {
        recommendedType: { type: Type.STRING, enum: ["bar", "line", "pie", "table"] },
        xAxisKey: { type: Type.STRING, description: "Column name for X axis" },
        yAxisKeys: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "Column names for numerical Y axes" 
        },
        title: { type: Type.STRING }
      },
      required: ["recommendedType"]
    }
  },
  required: ["sql", "explanation", "chartConfig"]
};

export async function generateSqlAndChartSpec(schemaContext, userQuery) {
  const prompt = `
You are an expert Data Analyst and DuckDB SQL generator.
Database Schema and Sample Rows:
${JSON.stringify(schemaContext, null, 2)}

User Question: "${userQuery}"

Rules:
1. Return ONLY a single read-only SELECT query.
2. Form correct table joins using column names provided in the schema context.
3. Suggest the most sensible visualization based on the aggregate projections.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: queryResponseSchema
    }
  });

  return JSON.parse(response.text);
}

// Auto-Dashboard generator on upload
export async function generateAutoDashboardWidgets(schemaContext) {
  const prompt = `
Given this database schema:
${JSON.stringify(schemaContext, null, 2)}

Generate 3 diverse, insightful analytical metrics/charts (e.g. 1 KPI card, 1 breakdown bar chart, 1 time-trend line chart).
Provide the exact SQL and chart configuration for each widget.
`;

  const dashboardSchema = {
    type: Type.OBJECT,
    properties: {
      widgets: {
        type: Type.ARRAY,
        items: queryResponseSchema
      }
    },
    required: ["widgets"]
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: dashboardSchema
    }
  });

  return JSON.parse(response.text).widgets;
}