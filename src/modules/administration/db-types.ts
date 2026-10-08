export type AdministrationJson = string | number | boolean | null | { [key: string]: AdministrationJson | undefined } | AdministrationJson[];

type Rpc<Args> = { Args: Args; Returns: AdministrationJson };

export type AdministrationFunctions = {
  administration_lookup: Rpc<{ p_scope_id: string; p_query: string }>;
  administration_create_club: Rpc<{ p_scope_id: string; p_name: string; p_description: string }>;
};
