import request from "supertest";
import app from "./index";

describe("GET /health", () => {
  it("returns ok status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("POST /triage", () => {
  it("triages a payment issue correctly", async () => {
    const res = await request(app)
      .post("/triage")
      .send({ issue: "my RFID card is being refused", station_id: "EV-042" });
    expect(res.status).toBe(200);
    expect(res.body.diagnosis.escalate_to_l2).toBe(false);
    expect(res.body.diagnosis.likely_cause).toMatch(/payment/i);
  });

  it("escalates a connector stuck issue", async () => {
    const res = await request(app)
      .post("/triage")
      .send({ issue: "connector is stuck and won't release", station_id: "EV-007" });
    expect(res.status).toBe(200);
    expect(res.body.diagnosis.escalate_to_l2).toBe(true);
  });

  it("returns 400 when issue field is missing", async () => {
    const res = await request(app).post("/triage").send({ station_id: "EV-001" });
    expect(res.status).toBe(400);
  });

  it("handles unknown issues with escalation", async () => {
    const res = await request(app)
      .post("/triage")
      .send({ issue: "something very strange is happening" });
    expect(res.status).toBe(200);
    expect(res.body.diagnosis.escalate_to_l2).toBe(true);
  });
});
