/**
 * Billing core — single import surface.
 *
 * Consumers should import from "@/lib/billing" rather than the
 * individual files so the internal layout stays free to change.
 */

export { effectivePlan, isOnGracePeriod } from "./effectivePlan";
export type { PlanResolutionInput } from "./effectivePlan";

export {
  incrementUsage,
  getUsage,
  currentMonthKey,
  computeStorageFromFiles,
} from "./usage";

export { withPlanLimit } from "./withPlanLimit";
export type { PlanCtx, WithPlanLimitOptions } from "./withPlanLimit";

export { noopGateway, getGateway } from "./gateway";
export type {
  Gateway,
  WebhookEvent,
  WebhookEventType,
  CheckoutOptions,
} from "./gateway";
