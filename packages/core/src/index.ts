import type { ProductEngineCommand, ProductEngineReduction } from "@solo-superman/contracts";

export const CORE_PACKAGE_BOUNDARY = "pure-product-services-scaffold" as const;

export interface ProductEngineBoundary {
  readonly accepts: ProductEngineCommand;
  readonly returns: ProductEngineReduction;
  readonly implementation: "not_implemented_in_pr_01";
}
