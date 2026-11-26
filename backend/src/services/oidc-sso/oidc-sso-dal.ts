import { TDbClient } from "@app/db";
import { TableName } from "@app/db/schemas";
import { ormify } from "@app/lib/knex";

export type TOidcSsoDALFactory = ReturnType<typeof oidcSsoDALFactory>;

export const oidcSsoDALFactory = (db: TDbClient) => ormify(db, TableName.OidcConfig);
