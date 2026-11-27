import { createNotification } from "@app/components/notifications";

export const createIntegrationMissingEnvVarsNotification = () =>
  createNotification({
    type: "error",
    text: "This integration requires server environment variables that are not configured.",
    title: "Missing Environment Variables"
  });
