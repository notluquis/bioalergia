import { Hono } from "hono";
import { getSessionUser } from "../auth";
import {
  sendPushNotification,
  subscribeToPush,
} from "../services/notifications";

const app = new Hono();

app.post("/subscribe", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const body = await c.req.json();
  const { subscription } = body;

  if (!subscription || !subscription.endpoint) {
    return c.json({ status: "error", message: "Missing subscription" }, 400);
  }

  await subscribeToPush(user.id, subscription);
  return c.json({ message: "Subscribed successfully" });
});

app.post("/send-test", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const result = await sendPushNotification(user.id, {
    title: "Test Notification",
    body: "This is a test from the new API!",
  });

  return c.json(result);
});

export default app;
