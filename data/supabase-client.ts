// Cliente de Supabase tipado con el esquema del proyecto de pruebas.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.ts";

export type TkSupabaseClient = SupabaseClient<Database>;

type Functions = Database["public"]["Functions"];
export type RpcName = keyof Functions;

// Los tipos generados no reflejan que en Postgres todos los argumentos de una funcion
// admiten null (aqui se usa para "sin grupo", "sin nota", "hijo nuevo"...). Se permite null
// en cada argumento sin perder la comprobacion de nombres de funcion y de argumentos.
export type RpcArgs<N extends RpcName> = {
  [K in keyof Functions[N]["Args"]]: Functions[N]["Args"][K] | null;
};

export function callRpc<N extends RpcName>(supabase: TkSupabaseClient, name: N, args: RpcArgs<N>) {
  return supabase.rpc(name, args as Functions[N]["Args"]);
}
