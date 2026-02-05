import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { sendPushNotification, subscribeToPush } from "../services/notifications";
import { reply } from "../utils/reply";

const app = new Hono();

app.post("/subscribe", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { subscription } = body;

  if (!subscription || !subscription.endpoint) {
    return reply(c, { status: "error", message: "Missing subscription" }, 400);
  }

  await subscribeToPush(user.id, subscription);
  return reply(c, { message: "Subscribed successfully" });
});

app.post("/send-test", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Notification");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const result = await sendPushNotification(user.id, {
    title: "Test Notification",
    body: "This is a test from the new API!",
  });

  return reply(c, result);
});

export const notificationRoutes = app;
