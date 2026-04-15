import express, { Request, Response } from "express";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// Triage logic: maps keywords to likely causes and actions
const triageRules: {
  keywords: string[];
  cause: string;
  action: string;
  escalate: boolean;
}[] = [
  {
    keywords: ["won't start", "won't charge", "not starting", "no power", "dead"],
    cause: "Charger or vehicle handshake failure",
    action: "Ask driver to unplug, wait 30s, and re-plug. Check for OCPP status on station.",
    escalate: false,
  },
  {
    keywords: ["payment", "card", "rfid", "tap", "refused", "declined"],
    cause: "Payment or authentication issue",
    action: "Verify RFID card is registered. Ask driver to retry payment or use app.",
    escalate: false,
  },
  {
    keywords: ["connector", "stuck", "locked", "won't release", "can't unplug"],
    cause: "Connector locking mechanism fault",
    action: "Attempt remote unlock via CPMS. If unresolved, escalate to L2.",
    escalate: true,
  },
  {
    keywords: ["slow", "speed", "rate", "kw", "kilowatt"],
    cause: "Charging speed below expected rate",
    action: "Check station load balancing. Verify vehicle max charge rate. Log for L2 review.",
    escalate: true,
  },
  {
    keywords: ["error", "fault", "broken", "offline", "unavailable"],
    cause: "Station fault or offline status",
    action: "Check station heartbeat in CPMS. Attempt remote reset. Escalate if unresponsive.",
    escalate: true,
  },
];

function triage(issue: string): {
  cause: string;
  action: string;
  escalate: boolean;
} {
  const lower = issue.toLowerCase();
  for (const rule of triageRules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return { cause: rule.cause, action: rule.action, escalate: rule.escalate };
    }
  }
  return {
    cause: "Unknown issue",
    action: "Collect driver details and station ID. Escalate to L2 for manual review.",
    escalate: true,
  };
}

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Main triage endpoint
app.post("/triage", (req: Request, res: Response) => {
  const { issue, station_id, driver_id } = req.body;

  if (!issue || typeof issue !== "string") {
    res.status(400).json({ error: "Missing required field: issue (string)" });
    return;
  }

  const result = triage(issue);

  res.json({
    station_id: station_id || "unknown",
    driver_id: driver_id || "anonymous",
    issue_received: issue,
    diagnosis: {
      likely_cause: result.cause,
      recommended_action: result.action,
      escalate_to_l2: result.escalate,
    },
    triaged_at: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`EV Support API running on port ${PORT}`);
});

export default app;
