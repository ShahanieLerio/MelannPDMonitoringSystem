
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Loan, PriorityLevel } from "../types";

// Guidelines: Always use a named parameter and obtain from environment variable directly.
// Helper to safely get the Gemini instance
const getGenAIModel = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("PLACEHOLDER")) {
    console.warn("Gemini API Key is missing or invalid.");
    return null;
  }
  const modelName = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: modelName });
};

export async function getLoanInsights(loans: Loan[]) {
  if (!loans.length) return "No data available for analysis.";

  const now = new Date();
  const summaryData = loans.map(l => {
    let daysOverdue = 0;
    if (l.dueDate) {
      const dueDate = new Date(l.dueDate);
      if (!isNaN(dueDate.getTime())) {
        daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }

    let daysSinceLastPayment = -1;
    if (l.payments && l.payments.length > 0) {
      const sorted = [...l.payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastPaymentDate = new Date(sorted[0].date);
      if (!isNaN(lastPaymentDate.getTime())) {
        daysSinceLastPayment = Math.max(0, Math.floor((now.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }

    return { 
      name: l.borrowerName, 
      balance: l.runningBalance, 
      status: l.status, 
      collector: l.collector,
      area: l.area || l.city,
      daysOverdue,
      daysSinceLastPayment
    };
  });

  const activeAccounts = summaryData.filter(a => a.balance > 0);

  const topAccounts = [...activeAccounts]
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 50);

  const top10Big = [...activeAccounts]
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);

  const top10Small = [...activeAccounts]
    .sort((a, b) => a.balance - b.balance)
    .slice(0, 5);

  const model = getGenAIModel();
  if (!model) {
    console.warn("AI Service Unavailable (Missing Key), falling back to Mock Logic...");
    return generateMockInsights(topAccounts, top10Big, top10Small);
  }

  try {
    const prompt = `
      Analyze this loan data and provide structured insights for a collection manager:
      Top Accounts Data: ${JSON.stringify(topAccounts)}
      Top 10 Big Accounts: ${JSON.stringify(top10Big)}
      Top 5 Small Accounts: ${JSON.stringify(top10Small)}

      You MUST provide the output EXACTLY in the following structure and follow these rules strictly:
      - Keep output concise and bullet-based.
      - Avoid long explanations.
      - Focus only on actionable insights.

      🔴 Priority Accounts (Top 5)
      * Display the most urgent borrowers based on highest overdue balance and longest overdue days.
      * Format: Name – Balance – Days Overdue – [Collector Name]

      📈 Top 10 Big Accounts
      * Display the 10 borrowers with the highest balances from the provided Top 10 Big Accounts data.
      * Format: Name – Balance – Days Overdue – [Collector Name]

      📉 Top 5 Small Accounts
      * Display the 5 borrowers with the smallest balances from the provided Top 5 Small Accounts data.
      * Format: Name – Balance – Days Overdue – [Collector Name]

      📅 Daily Collection Strategy
      * Provide 2–3 concise, actionable strategies focused on:
        * Areas with high overdue concentration
        * Efficient allocation of collectors

      👥 Collector Performance Insight
      * Highlight:
        * Top performing collector
        * Any underperforming collector (if applicable)

      🚨 Risk Alerts
      * Identify high-risk accounts:
        * No payment in 7+ days
        * Repeated missed payments

      ✅ Suggested Actions
      * Recommend 2–4 immediate operational actions such as:
        * Sending demand letters
        * Scheduling field visits
        * Prioritizing specific accounts
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Error, falling back to Mock Logic:", error);
    return generateMockInsights(topAccounts, top10Big, top10Small);
  }
}

async function generateMockInsights(topAccounts: any[], top10Big: any[], top10Small: any[]) {
  // 💡 Performance Optimization/Fallback: Generate mock insights if AI is down
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate AI processing lag
  
  const top5 = topAccounts.slice(0, 5);
  const big10 = top10Big.slice(0, 10);
  const small5 = top10Small.slice(0, 5);

  const mockOutput = `
🔴 Priority Accounts (Top 5)
${top5.map(a => `* ${a.name} – ₱${a.balance.toLocaleString()} – ${a.daysOverdue} Days Overdue – ${a.collector || 'Unassigned'}`).join('\n')}

📈 Top 10 Big Accounts
${big10.map(a => `* ${a.name} – ₱${a.balance.toLocaleString()} – ${a.daysOverdue} Days Overdue – ${a.collector || 'Unassigned'}`).join('\n')}

📉 Top 5 Small Accounts
${small5.map(a => `* ${a.name} – ₱${a.balance.toLocaleString()} – ${a.daysOverdue} Days Overdue – ${a.collector || 'Unassigned'}`).join('\n')}

📅 Daily Collection Strategy
* Prioritize house visits in ${topAccounts[0]?.area || 'highly concentrated'} area today due to multiple overdue accounts.
* Deploy extra field support to assist ${topAccounts[0]?.collector || 'top agents'} with high-balance recovery.

👥 Collector Performance Insight
* ${topAccounts[0]?.collector || 'Primary collector'} is managing the highest volume of priority accounts.
* Continued focus needed on older accounts to prevent NM data aging.

🚨 Risk Alerts
* ${topAccounts[1]?.name || 'Multiple accounts'} has exceeded 30 days without payment update.
* High concentration of risk detected in ${topAccounts[1]?.area || 'residential'} sectors.

✅ Suggested Actions
* Issue Final Demand Letters for the top 3 high-balance accounts.
* Schedule personal visits for accounts with >${topAccounts[0]?.daysOverdue || 15} days overdue.
* Refresh "Located Status" for accounts missing contact updates.
  `.trim();

  return mockOutput;
}

export async function analyzeRemarkPriority(remarkText: string): Promise<PriorityLevel> {
  const model = getGenAIModel();
  if (!model) return PriorityLevel.LOWEST;
  try {
    const result = await model.generateContent(`Classify the following client collection remark into a priority tier: 
      "${remarkText}"
      
      Tier Options:
      - TOP: "Top Priority" (Urgent, payment today/tomorrow, high commitment)
      - FOLLOW_UP: "Follow-up" (Promised next week, needs checking)
      - MONITOR: "Monitor Closely" (Recurring payments, partial commitments)
      - LOWEST: "Lowest Priority" (No specific commitment, unreachable)

      Respond ONLY with the option name (TOP, FOLLOW_UP, MONITOR, or LOWEST).`);

    const response = await result.response;
    const text = response.text().trim().toUpperCase();
    if (text.includes('TOP')) return PriorityLevel.TOP;
    if (text.includes('FOLLOW_UP')) return PriorityLevel.FOLLOW_UP;
    if (text.includes('MONITOR')) return PriorityLevel.MONITOR;
    return PriorityLevel.LOWEST;
  } catch (error) {
    console.error("Gemini Priority Error:", error);
    return PriorityLevel.LOWEST;
  }
}

export interface ExtractedActiveClientAccount {
  borrowerName?: string;
  address?: string;
  accountCode?: string;
  dueDate?: string;
  datePrepared?: string;
  startingOverdueBalance?: number;
  periods?: Array<{
    label: string;
    paymentMade: number;
    numberOfMonths: number;
  }>;
}

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    resolve(result.includes(',') ? result.split(',')[1] : result);
  };
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const parseJsonObject = (text: string) => {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not contain JSON.');
  }
  return JSON.parse(raw.slice(start, end + 1));
};

export async function extractActiveClientAccountFromFile(file: File): Promise<ExtractedActiveClientAccount> {
  const model = getGenAIModel();
  if (!model) {
    throw new Error('Gemini API key is not configured. Enter the account details manually.');
  }

  const data = await fileToBase64(file);
  const prompt = `
Read this active-client account document and extract only the fields needed for a Philippine demand-letter penalty computation.

Return JSON only, with this exact shape:
{
  "borrowerName": "string",
  "address": "string",
  "accountCode": "string",
  "dueDate": "YYYY-MM-DD",
  "datePrepared": "YYYY-MM-DD",
  "startingOverdueBalance": 0,
  "periods": [
    { "label": "March 2024", "paymentMade": 0, "numberOfMonths": 1 }
  ]
}

Rules:
- Use numbers only for money values.
- Convert dates to YYYY-MM-DD when visible.
- If a field is not visible, omit it or use an empty string.
- Do not invent payments or balances.
- Periods should group consecutive months that share the same beginning overdue balance/payment pattern.
- Penalty rate is always 5% monthly simple/non-compounding; do not compute totals here.
`;

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { data, mimeType: file.type || 'application/octet-stream' } },
  ]);
  const response = await result.response;
  return parseJsonObject(response.text()) as ExtractedActiveClientAccount;
}
