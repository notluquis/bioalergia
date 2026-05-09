import { OpenAPIHandler as BaseOpenAPIHandler } from "@orpc/openapi/fetch";
import { onError, type Context, type Router } from "@orpc/server";
import { toORPCError } from "./error.ts";

export class OpenAPIHandler<T extends Context> extends BaseOpenAPIHandler<T> {
  constructor(router: Router<Record<never, never>, T>, options: ConstructorParameters<typeof BaseOpenAPIHandler<T>>[1] = {}) {
    options.interceptors ??= [];
    options.interceptors.push(
      onError((error) => {
        throw toORPCError(error);
      }),
    );

    super(router, options);
  }
}
