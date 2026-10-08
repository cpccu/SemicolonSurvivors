import type { IdentityFunctions, IdentityTables } from "@/modules/identity/db-types";
import type { EventFunctions, EventTables } from "@/modules/events/db-types";
import type { ContentFunctions, ContentTables } from "@/modules/content/db-types";
import type { CommunityFunctions, CommunityTables } from "@/modules/community/db-types";
import type { AdministrationFunctions } from "@/modules/administration/db-types";

// Module contracts map to versioned migrations; hosted deployment still needs explicit application.
export type CampusDatabase = {
  public: {
    Tables: IdentityTables & EventTables & ContentTables & CommunityTables;
    Views: Record<string, never>;
    Functions: IdentityFunctions & EventFunctions & ContentFunctions & CommunityFunctions & AdministrationFunctions;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
