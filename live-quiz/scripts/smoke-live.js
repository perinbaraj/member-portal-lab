#!/usr/bin/env node
"use strict";

const { io } = require("socket.io-client");

const BASE = process.env.SMOKE_BASE_URL;
const PASS = process.env.HOST_PASSPHRASE;
if (!BASE || !PASS) {
  console.error("SMOKE_BASE_URL and HOST_PASSPHRASE are required, and the deployed app must explicitly enable the emergency fallback.");
  process.exit(2);
}

const socket = io(BASE, { transports: ["websocket"], timeout: 30000 });

function emit(event, payload, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timed out`)), timeoutMs);
    socket.emit(event, payload, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

function step(name, res) {
  const ok = res && res.ok !== false;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(res)}`);
  if (!ok) throw new Error(name);
  return res;
}

(async () => {
  await new Promise((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
  });
  console.log("PASS  socket connected");

  step("host:join", await emit("host:join", { type: "passphrase", passphrase: PASS }, 30000));
  step("host:select-brand github", await emit("host:select-brand", "github", 30000));

  const created = step("host:create-batch", await emit("host:create-batch", {
    label: "Deployment smoke quiz",
    tags: ["smoke"],
    questions: [{
      topic: "GitHub",
      prompt: "Which feature stores a project's files and history?",
      options: ["Repository", "Issue", "Milestone", "Discussion"],
      correctAnswerIndex: 0,
      explanation: "A repository stores project files and version history.",
    }],
  }, 60000));
  const batchId = created.batchId;
  step("host:select-batch", await emit("host:select-batch", batchId, 30000));
  console.log(`\nSMOKE OK  batchId=${batchId}`);
  socket.close();
  process.exit(0);
})().catch((err) => {
  console.error("SMOKE FAILED:", err.message);
  socket.close();
  process.exit(1);
});
